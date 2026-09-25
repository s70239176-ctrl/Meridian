# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Meridian adjudicator.

GenLayer only judges. The source-chain vault keeps the funds.
`adjudicate` writes a verdict and schedules `SettlementOutbox.record`
with emit(on="finalized"). That child message is not created until
this transaction is past the appeal window, so an optimistic result
cannot pay out.

Appeals are protocol appeals on the `adjudicate` transaction
(genlayer / client appeal). Do not add a second in-contract appeal
that would pay early.

Deploy to GenLayer Studio (studionet — hosted, gasless; see
docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio).
Deploy the outbox first, then:

    genlayer network set studionet
    genlayer deploy --contract contracts/meridian_adjudicator.py --args <outbox>

Then on the outbox, as its deployer:

    set_adjudicator(<this contract address>)

Open a case (amount is raw token units, as a decimal string):

    create_escrow <payer> <payee> <eip155:1> <vault> <USDC> <amount> <spec> <equivalence>

Judge it (evidence URLs separated by newlines):

    adjudicate <escrow_id> <evidence_blob>
"""

from genlayer import *
from dataclasses import dataclass


@allow_storage
@dataclass
class Escrow:
    payer: Address
    payee: Address
    source_chain: str
    vault: str
    asset: str
    amount: str
    spec: str
    equivalence: str
    status: str
    verdict: str
    payee_bps: str
    reasoning: str


_ZERO = "0x" + "00" * 20
_VERDICTS = ("release_to_payee", "refund_to_payer", "split")


def _blank() -> Escrow:
    z = Address(_ZERO)
    return Escrow(z, z, "", "", "", "", "", "", "", "", "", "")


def _hex(addr: Address) -> str:
    raw = getattr(addr, "as_hex", None)
    if isinstance(raw, str) and raw:
        return raw
    return str(addr)


def _bucket(bps: int) -> int:
    if bps < 0:
        bps = 0
    if bps > 10000:
        bps = 10000
    return ((bps + 500) // 1000) * 1000


def _normalize(raw: object) -> dict:
    if not isinstance(raw, dict):
        raise gl.vm.UserError("model did not return a JSON object")
    verdict = str(raw.get("verdict", "")).strip()
    if verdict not in _VERDICTS:
        raise gl.vm.UserError("verdict must be release_to_payee, refund_to_payer, or split")
    try:
        bps = int(raw.get("payee_bps", 0))
    except (TypeError, ValueError):
        raise gl.vm.UserError("payee_bps is not an integer")
    if verdict == "release_to_payee":
        bps = 10000
    elif verdict == "refund_to_payer":
        bps = 0
    else:
        bps = _bucket(bps)
    reasoning = str(raw.get("reasoning", "")).strip()
    if len(reasoning) > 800:
        reasoning = reasoning[:800]
    return {"verdict": verdict, "payee_bps": bps, "reasoning": reasoning}


class MeridianAdjudicator(gl.Contract):
    owner: Address
    outbox: Address
    next_id: str
    escrows: TreeMap[str, Escrow]

    def __init__(self, outbox: str):
        if not outbox.startswith("0x") or len(outbox) != 42:
            raise gl.vm.UserError("outbox must be a 20-byte hex address")
        self.owner = gl.message.sender_address
        self.outbox = Address(outbox)
        self.next_id = "1"

    @gl.public.write
    def create_escrow(
        self,
        payer: str,
        payee: str,
        source_chain: str,
        vault: str,
        asset: str,
        amount: str,
        spec: str,
        equivalence: str,
    ) -> str:
        sender = gl.message.sender_address
        if sender != self.owner and _hex(sender).lower() not in (payer.lower(), payee.lower()):
            raise gl.vm.UserError("only owner, payer, or payee can open an escrow")
        if not payer.startswith("0x") or len(payer) != 42:
            raise gl.vm.UserError("payer must be a 20-byte hex address")
        if not payee.startswith("0x") or len(payee) != 42:
            raise gl.vm.UserError("payee must be a 20-byte hex address")
        if payer.lower() == payee.lower():
            raise gl.vm.UserError("payer and payee must differ")
        if not source_chain.startswith("eip155:"):
            raise gl.vm.UserError("source_chain must look like eip155:1")
        if not vault.startswith("0x") or len(vault) != 42:
            raise gl.vm.UserError("vault must be the source-chain vault address")
        if not asset or not amount or not spec or not equivalence:
            raise gl.vm.UserError("asset, amount, spec, and equivalence are required")
        if not amount.isdigit() or int(amount) <= 0:
            raise gl.vm.UserError("amount must be a positive integer in raw token units")

        escrow_id = self.next_id
        self.next_id = str(int(escrow_id) + 1)
        self.escrows[escrow_id] = Escrow(
            payer=Address(payer),
            payee=Address(payee),
            source_chain=source_chain,
            vault=vault,
            asset=asset,
            amount=amount,
            spec=spec,
            equivalence=equivalence,
            status="open",
            verdict="",
            payee_bps="",
            reasoning="",
        )
        return escrow_id

    @gl.public.write
    def adjudicate(self, escrow_id: str, evidence_blob: str) -> str:
        if escrow_id not in self.escrows:
            raise gl.vm.UserError("unknown escrow")
        case = self.escrows[escrow_id]
        if case.status != "open":
            raise gl.vm.UserError("escrow is not open")

        sender = gl.message.sender_address
        allowed = (
            sender == self.owner
            or sender == case.payer
            or sender == case.payee
        )
        if not allowed:
            raise gl.vm.UserError("only owner, payer, or payee can adjudicate")

        urls = [line.strip() for line in evidence_blob.split("\n") if line.strip()]
        if not urls:
            raise gl.vm.UserError("at least one evidence URL is required")
        if len(urls) > 4:
            raise gl.vm.UserError("at most 4 evidence URLs")
        for url in urls:
            if not (url.startswith("https://") or url.startswith("http://")):
                raise gl.vm.UserError("evidence must be an http(s) URL")

        # Copy out of storage before the nondet block. Nondet cannot read storage.
        spec = case.spec
        equivalence = case.equivalence
        captured = list(urls)

        def evaluate() -> dict:
            pages = []
            for url in captured:
                try:
                    res = gl.nondet.web.get(url)
                    body = getattr(res, "body", res)
                    if isinstance(body, bytes):
                        body = body.decode("utf-8", "replace")
                    text = str(body)
                except Exception as exc:
                    text = "[fetch failed: " + str(exc) + "]"
                if len(text) > 6000:
                    text = text[:6000]
                pages.append("URL " + url + "\n" + text)

            prompt = (
                "You are a GenLayer validator. Judge only. Do not invent a transfer.\n"
                "Apply the Equivalence Principle to the evidence.\n"
                "Two answers can differ in wording and still be the same verdict.\n\n"
                "SPEC:\n" + spec + "\n\n"
                "EQUIVALENCE:\n" + equivalence + "\n\n"
                "EVIDENCE:\n" + "\n\n".join(pages) + "\n\n"
                "Return JSON with keys verdict, payee_bps, reasoning.\n"
                "verdict is exactly one of: release_to_payee, refund_to_payer, split.\n"
                "payee_bps is an integer 0..10000 (share of amount owed to the payee; "
                "the rest returns to the payer). Use 10000 or 0 unless verdict is split.\n"
                "reasoning is at most 4 sentences and must cite what the pages showed."
            )
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            return _normalize(raw)

        # Every validator independently re-runs `evaluate` (re-fetching the same
        # evidence URLs and re-prompting its own model) and an NLP comparison
        # decides whether the two answers are equivalent under `principle` —
        # the standard GenLayer consensus primitive for a leader/validator flow
        # with a custom (non-strict) equivalence check, in place of a hand-rolled
        # gl.vm.run_nondet_unsafe leader/validator pair.
        agreed = gl.eq_principle.prompt_comparative(
            evaluate,
            principle=(
                "Both answers must state the same verdict field: one of "
                "release_to_payee, refund_to_payer, or split. When verdict is "
                "split, payee_bps must be within 1000 of each other. The "
                "reasoning text may differ in wording."
            ),
        )
        verdict = str(agreed["verdict"])
        bps = str(int(agreed["payee_bps"]))
        reasoning = str(agreed["reasoning"])

        if verdict == "refund_to_payer":
            recipient = _hex(case.payer)
        else:
            # release: recipient is the payee.
            # split: recipient is the payee; payee_bps tells the vault
            # how much of `amount` they receive. The remainder refunds the payer.
            recipient = _hex(case.payee)

        case.status = "adjudicated"
        case.verdict = verdict
        case.payee_bps = bps
        case.reasoning = reasoning
        self.escrows[escrow_id] = case

        # External message. Not sent on accept. Created only after finality,
        # so a successful appeal recomputes this call instead of paying the
        # optimistic result. This contract never transfers the escrow.
        outbox = gl.get_contract_at(self.outbox)
        outbox.emit(on="finalized").record(
            escrow_id,
            verdict,
            bps,
            case.source_chain,
            case.vault,
            case.asset,
            case.amount,
            recipient,
        )
        return verdict

    @gl.public.view
    def get_escrow(self, escrow_id: str) -> str:
        if escrow_id not in self.escrows:
            return ""
        case = self.escrows[escrow_id]
        return "\n".join(
            [
                "escrow_id=" + escrow_id,
                "status=" + case.status,
                "payer=" + _hex(case.payer),
                "payee=" + _hex(case.payee),
                "source_chain=" + case.source_chain,
                "vault=" + case.vault,
                "asset=" + case.asset,
                "amount=" + case.amount,
                "verdict=" + case.verdict,
                "payee_bps=" + case.payee_bps,
                "spec=" + case.spec,
                "equivalence=" + case.equivalence,
                "reasoning=" + case.reasoning,
            ]
        )
