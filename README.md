# Meridian

## Project summary

Cross-chain escrows need a judge that isn't also the custodian: if the chain
holding the funds also decides the dispute, every appeal is a custody event.
Meridian solves this by splitting the two jobs. Real funds are locked in
[`Vault.sol`](contracts/Vault.sol), a Solidity contract on Arc Testnet
(Circle's USDC-native L1) — Meridian itself never holds the money. The case is
judged by a real, deployed [GenLayer](https://genlayer.com) Intelligent
Contract, which fetches the submitted evidence and reaches a verdict through
genuine LLM-backed leader/validator consensus (`gl.eq_principle.prompt_comparative`),
not a fixed rule or a single model call taken on faith. Once GenLayer
finalizes, a relayer reads its real settlement message and submits it to the
vault, which pays out — the only step where money moves. GenLayer's advantage
here is exactly this: a natural-language spec and an "equivalence principle"
replace a rigid on-chain oracle format, so the dispute can turn on meaning
("was the brief substantively complete?") instead of a boolean flag, while
consensus across independent validators keeps any single model's mistake from
becoming the final word.

## Live demo

https://meridian-relayer.vercel.app/

## Contract details

| | Network | Chain ID | Explorer |
|---|---|---|---|
| Vault (`Vault.sol`) | Arc Testnet | `5042002` | https://testnet.arcscan.app |
| MeridianAdjudicator / SettlementOutbox | GenLayer Studio (`studionet`) | `61999` | https://explorer-studio.genlayer.com |

- Arc Testnet RPC: `https://rpc.testnet.arc.network`
- GenLayer Studio RPC: `https://studio.genlayer.com/api`
- Vault address: [`0xa012e6ce7d96c82399d43e12b9af1265178edfa5`](https://testnet.arcscan.app/address/0xa012e6ce7d96c82399d43e12b9af1265178edfa5)
- MeridianAdjudicator address: [`0x92f4cceA07B1168273Fb44eD607835e622a2C43F`](https://explorer-studio.genlayer.com/address/0x92f4cceA07B1168273Fb44eD607835e622a2C43F)
- SettlementOutbox address: [`0x41eBd14D0ec72C9bf186A636828BDD4432162961`](https://explorer-studio.genlayer.com/address/0x41eBd14D0ec72C9bf186A636828BDD4432162961)

> **A steward review identified a real fund-safety issue** (see "Known
> limitations" below for the full writeup): the vault's and GenLayer's escrow
> ids were independently tracked rather than one canonical identifier, so a
> mismatched pairing could apply one case's verdict to a different case's
> locked funds. Fixed by making the vault's id the single identifier
> everywhere and verifying the finalized message's fields against the vault's
> own on-chain state before ever settling (`src/lib/chain/vault.ts`'s
> `verifyMessageAgainstVaultEscrow`, tested in `vault.test.ts`). The addresses
> above are the redeployed contracts, verified on-chain to use the new
> `create_escrow(vault_escrow_id, ...)` and `settle(..., expectedAmount)`
> signatures — confirmed via a real `create_escrow` call
> ([tx](https://explorer-studio.genlayer.com/tx/0x2e85f2bda9aa388dab686527e389216bb3d443a1f31d2425d691b6a2df156574))
> whose return value echoes back the exact canonical id it was given.

Arc's native currency **is** USDC, but accounted with 18 decimals (ether-style)
at the native/`msg.value` layer — a separate ERC-20 view of the same balance
uses 6 decimals. See [`circlefin/arc-node` #95](https://github.com/circlefin/arc-node/issues/95)
and [#453](https://github.com/circlefin/arc-node/issues/453).

Arc's native currency **is** USDC, but accounted with 18 decimals (ether-style)
at the native/`msg.value` layer — a separate ERC-20 view of the same balance
uses 6 decimals. See [`circlefin/arc-node` #95](https://github.com/circlefin/arc-node/issues/95)
and [#453](https://github.com/circlefin/arc-node/issues/453).

## Tech stack

- **Frontend:** React 19, TanStack Start / Router / Query, Tailwind v4, Zustand
- **Wallet / chain:** `viem` (Arc Testnet, injected wallet connection)
- **GenLayer contract:** Python Intelligent Contracts (`meridian_adjudicator.py`,
  `settlement_outbox.py`) via `genlayer-js`, called from TanStack Start server
  functions so the signing key never reaches the browser
- **Vault contract:** Solidity (`Vault.sol`), compiled with `solc` and deployed
  with `viem`
- **Backend/database (optional):** Postgres/Neon if `DATABASE_URL` is set,
  otherwise an embedded PGLite (Postgres-in-WASM) instance with zero config —
  used only for future off-chain indexing, not for case state today

## How it works

1. **Connect a wallet** on the "New vault" page (the app prompts it to
   add/switch to Arc Testnet if needed).
2. **Deposit** — submitting the form sends a real transaction to `Vault.sol`,
   locking the deposited USDC.
3. **Register on GenLayer** — the app calls the real, deployed
   `MeridianAdjudicator.create_escrow()` with the same case facts (payer,
   payee, amount, spec, equivalence principle).
4. **Adjudicate** — "Run adjudication" calls the real `adjudicate()` write.
   GenLayer's leader fetches the submitted evidence URLs and prompts its
   model; every validator independently re-runs the same check, and
   `gl.eq_principle.prompt_comparative` decides via NLP whether their answers
   agree under the stated equivalence principle.
5. **Relay settlement** — once finalized, GenLayer's contract has written a
   message to `SettlementOutbox`. "Relay settlement" reads that message and
   submits it to `Vault.sol`, which releases or refunds the locked funds.

Every transaction hash shown in the UI links to Arc's or GenLayer's own block
explorer — nothing is simulated or fabricated at any step.

## How to run locally

```bash
npm install
npm run dev
```

The app renders immediately, but creating a case needs both contract systems
deployed first — there is no zero-setup demo mode, by design (see "Contract
details" above for what to deploy).

**Environment variables** (see `.env.example`):

```
# GenLayer Studio
VITE_MERIDIAN_ADJUDICATOR=0x...
VITE_MERIDIAN_OUTBOX=0x...
GENLAYER_DEPLOYER_KEY=0x...        # server-only, never sent to the browser

# Vault on Arc Testnet
VITE_VAULT_ADDRESS=0x...
VAULT_RELAYER_KEY=0x...            # server-only

# Optional
DATABASE_URL=postgres://...
```

**Deploying the GenLayer contracts** (gasless on Studio — no faucet needed):

```bash
npm install -g genlayer
genlayer init
genlayer network set studionet
node scripts/gen-testnet-key.mjs        # generate GENLAYER_DEPLOYER_KEY
genlayer deploy --contract contracts/settlement_outbox.py
genlayer deploy --contract contracts/meridian_adjudicator.py --args <outbox_address>
# then call set_adjudicator(<adjudicator_address>) on the outbox, as its deployer
```

**Deploying the vault** (needs testnet USDC from https://faucet.circle.com,
select Arc Testnet):

```bash
node scripts/deploy-vault.mjs
```

```bash
npm run typecheck   # tsc --noEmit
npm run build       # vite build + migrations
npm test            # domain logic + tooling scripts
npm run lint
```

## Demo evidence

Paste these into "New vault" to test quickly:

- **Payee address:** any valid `0x...` testnet address you control (to see a
  real payout land)
- **Amount:** `1`
- **Spec:** `Pay the research agent if the weekly brief is published at a public URL, covers the named protocols, and cites at least five primary sources from the last quarter.`
- **Equivalence principle:** `A substantively complete brief is equivalent even if section order or page count differs, provided the named protocols are treated and unique primaries ≥ 5.`
- **Evidence URL (for "Run adjudication"):** any public URL — try a real
  research page for a `release_to_payee` verdict, or an unrelated page (e.g. a
  marketing site) for `refund_to_payer`

## Known limitations

- **Resolved via steward review: one canonical case identifier, verified
  before settlement.** Previously, the vault's `bytes32` escrow id and
  GenLayer's own auto-incrementing `escrow_id` were two independently-tracked
  identifiers, linked only by client-side bookkeeping — the relayer trusted
  whatever `vaultEscrowId` a caller supplied when settling, with nothing
  on-chain tying a specific GenLayer verdict to a specific vault deposit. That
  meant a mismatched or malicious pairing could, in principle, apply one
  case's verdict to a different case's locked funds. Fixed by making the
  vault's id the canonical identifier everywhere: it's now passed into
  `create_escrow` and used as GenLayer's own storage key (so the two systems
  share one identity by construction, not by a mapping that could drift), the
  relayer cross-checks the finalized message's vault/amount/recipient against
  the vault's own on-chain record before ever signing a `settle()` call
  (`src/lib/chain/vault.ts`'s `verifyMessageAgainstVaultEscrow`), and
  `settle()` itself re-checks the amount as a second, independent guard. See
  `src/lib/chain/vault.test.ts` for tests proving a verdict cannot be applied
  to a mismatched escrow or replayed after settlement.
- **AI judgment is not deterministic in the strict sense.** Verdicts come
  from an LLM reading real web evidence; consensus (independent validators
  agreeing via NLP) catches disagreement, but a genuinely ambiguous case can
  still land on a defensible verdict a human might have called differently.
- **Latency is real, not simulated.** Adjudication has to clear GenLayer's own
  appeal window before finalizing, and the resulting settlement message is a
  separate, downstream transaction with its own finalization delay — the full
  create → adjudicate → relay path can take several minutes end to end.
- **Evidence is fetched live, in-band.** The leader's `gl.nondet.web.get(url)`
  call depends on the target page being publicly reachable and stable between
  the leader's and each validator's independent fetch; a page that changes
  mid-adjudication or blocks the fetch can produce an inconsistent or failed
  round.
- **Testnet-only, single chain today.** Only Arc Testnet is wired for real
  deposits; `GenLayer Studio` (`studionet`) is a shared, rate-limited
  environment (60 req/min, 1000/hr, 10000/day per IP) meant for demos, not
  durable production state.
- **Long-running server calls don't fit typical serverless timeouts.** The
  adjudication/relay wait loops can run for minutes; on platforms like Vercel
  this needs a raised `maxDuration` (or, eventually, moving to client-side
  polling of a status endpoint instead of one long server call).
- **No multi-chain vaults yet.** Every case settles on the same Arc vault
  contract; supporting another source chain means deploying and wiring a new
  vault, not a config flag.

## Future roadmap

- **Phase 2:** additional source chains (each needs its own deployed vault
  contract and wallet-network switching support); ERC-20 asset support
  alongside native USDC; move the adjudicate/relay wait from a blocking server
  call to client-side polling of a status endpoint, removing the serverless
  timeout constraint entirely.
- **Phase 3:** a background relayer service (polling finalized cases and
  settling automatically, instead of a manual "Relay settlement" click);
  richer evidence types (signed API responses, oracle attestations, not just
  fetched URLs); a persisted off-chain index (the optional Postgres/Neon
  connection already scaffolded in `src/lib/db.ts`) so case history survives
  clearing browser storage.
