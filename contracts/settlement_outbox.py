# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Settlement outbox.

This contract does not hold funds and does not move them.
MeridianAdjudicator calls `record` with emit(on="finalized"), so the
message is created only after that adjudication transaction is past
its appeal window. A source-chain relayer reads `get_message` and
submits the instruction to the vault. The vault must ignore anything
that is not this finalized message.

Deploy to GenLayer Studio (studionet — hosted, gasless):
    genlayer network set studionet
    genlayer deploy --contract contracts/settlement_outbox.py
Then, after the adjudicator is deployed:
    set_adjudicator(<adjudicator address>)
"""

from genlayer import *
from dataclasses import dataclass


@allow_storage
@dataclass
class Settlement:
    escrow_id: str
    verdict: str
    payee_bps: str
    source_chain: str
    vault: str
    asset: str
    amount: str
    recipient: str


class SettlementOutbox(gl.Contract):
    owner: Address
    adjudicator: Address
    bound: bool
    messages: TreeMap[str, Settlement]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.adjudicator = Address("0x" + "00" * 20)
        self.bound = False

    @gl.public.write
    def set_adjudicator(self, adjudicator: str):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("only owner")
        if self.bound:
            raise gl.vm.UserError("adjudicator already set")
        if not adjudicator.startswith("0x") or len(adjudicator) != 42:
            raise gl.vm.UserError("adjudicator must be a 20-byte hex address")
        self.adjudicator = Address(adjudicator)
        self.bound = True

    @gl.public.write
    def record(
        self,
        escrow_id: str,
        verdict: str,
        payee_bps: str,
        source_chain: str,
        vault: str,
        asset: str,
        amount: str,
        recipient: str,
    ):
        # Idempotent: a finalized message must not be rewritten, and a
        # duplicate delivery from consensus must not change the instruction.
        if gl.message.sender_address != self.adjudicator:
            raise gl.vm.UserError("only the adjudicator")
        if escrow_id in self.messages:
            return
        if verdict not in ("release_to_payee", "refund_to_payer", "split"):
            raise gl.vm.UserError("unknown verdict")
        self.messages[escrow_id] = Settlement(
            escrow_id=escrow_id,
            verdict=verdict,
            payee_bps=payee_bps,
            source_chain=source_chain,
            vault=vault,
            asset=asset,
            amount=amount,
            recipient=recipient,
        )

    @gl.public.view
    def has_message(self, escrow_id: str) -> bool:
        return escrow_id in self.messages

    @gl.public.view
    def get_message(self, escrow_id: str) -> str:
        if escrow_id not in self.messages:
            return ""
        m = self.messages[escrow_id]
        # Stable, line-oriented payload. The source-chain vault (or its
        # relayer) parses these fields. No GEN and no token moves here.
        return "\n".join(
            [
                "type=meridian.settlement.v1",
                "escrow_id=" + m.escrow_id,
                "verdict=" + m.verdict,
                "payee_bps=" + m.payee_bps,
                "source_chain=" + m.source_chain,
                "vault=" + m.vault,
                "asset=" + m.asset,
                "amount=" + m.amount,
                "recipient=" + m.recipient,
            ]
        )
