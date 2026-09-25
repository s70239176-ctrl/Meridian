# Meridian

Meridian is a cross-chain **resolution layer** for escrows: funds stay locked in a
vault on the source chain (Ethereum, Base, Arbitrum, Optimism, BNB Chain — pick
one at escrow creation), and [GenLayer](https://genlayer.com) — a blockchain
whose Intelligent Contracts run LLM-backed validator consensus — only
**judges** whether the deal's spec was met. GenLayer never touches the funds.
Once a verdict is final (past its appeal window), the resolution layer emits a
settlement *message*; a relayer on the source chain reads that message and
tells the vault who gets paid. Meridian itself never moves money — it decides
who should be paid, and lets the vault chain do the paying.

## What's real vs. simulated here

This matters, so we're upfront about it:

- **The escrow lifecycle UI** (create → dispute → committee proposes a verdict
  → commit/reveal votes → appeal window → finalize → dispatch settlement) is a
  fully working **client-side simulation**, driven by [`src/lib/protocol/store.ts`](src/lib/protocol/store.ts).
  It runs entirely in your browser (Zustand + `localStorage`) so you can try
  every path — including a full appeal — in under a minute, with zero setup.
  The "validator committee" in this mode is a deterministic, seeded set of
  fake addresses (`src/lib/protocol/validators.ts`) — it demonstrates the
  *shape* of GenLayer's growing-committee-on-appeal scheme (5 → 11 → 23 → …
  validators), not real validator behavior.
- **`contracts/meridian_adjudicator.py`** and **`contracts/settlement_outbox.py`**
  are real, deployable [GenLayer Intelligent Contracts](https://docs.genlayer.com) —
  Python contracts that use GenLayer's actual leader/validator consensus
  primitives (`gl.vm.run_nondet_unsafe`, `gl.nondet.exec_prompt`,
  `gl.nondet.web.get`) to fetch evidence URLs and have an LLM judge the case
  against a natural-language spec and "equivalence principle." Appeals on a
  live deployment are GenLayer's own protocol-level appeals on the
  `adjudicate` transaction — there is no separate in-contract appeal.
- **The "Verify on GenLayer" button** on any case page is the bridge between
  the two: once you've deployed the contracts (see below) and set the env
  vars, this button calls the *real* deployed `MeridianAdjudicator` contract
  on GenLayer's public **Testnet Bradbury** with that case's actual facts, and
  shows you the genuine on-chain verdict and transaction hash — independent of
  (and alongside) the simulated committee above.

## Quickstart (simulation only, zero setup)

```bash
npm install
npm run dev
```

Open the app, go to **Docket**, and walk a case from *Locked* through *Run
first round → Commit and reveal → (optionally) File appeal → Finalize and
dispatch → Confirm receipt*. No env vars, no accounts, no blockchain.

## Deploying the contracts (optional, for live testnet mode)

This turns on the real "Verify on GenLayer" button. It needs a funded
**testnet-only** wallet — never your real one.

1. Install the GenLayer CLI and Studio components:
   ```bash
   npm install -g genlayer
   genlayer init
   ```
2. Generate a fresh, throwaway keypair for this project (do **not** use an
   existing wallet key):
   ```bash
   node scripts/gen-testnet-key.mjs
   ```
   This prints an address and a private key. Copy the private key into a
   local `.env` (never commit it):
   ```
   GENLAYER_DEPLOYER_KEY=0x...
   ```
3. Fund that address at the [GenLayer Testnet Faucet](https://testnet-faucet.genlayer.foundation/)
   (claims 100 GEN, once per 7 days). **Note:** the faucet requires the
   claiming wallet to hold ≥0.01 ETH on Ethereum mainnet as a Sybil check —
   if your fresh throwaway address has none, claim from a wallet that does
   and send the GEN to the deployer address instead.
4. Deploy the outbox first, then the adjudicator (which needs the outbox's
   address), then bind them:
   ```bash
   genlayer deploy --contract contracts/settlement_outbox.py --network testnetBradbury
   genlayer deploy --contract contracts/meridian_adjudicator.py --args <outbox_address> --network testnetBradbury
   # then, calling the outbox as its deployer:
   # set_adjudicator(<adjudicator_address>)
   ```
5. Put both deployed addresses in `.env`:
   ```
   VITE_MERIDIAN_ADJUDICATOR=0x...
   VITE_MERIDIAN_OUTBOX=0x...
   ```
6. Restart `npm run dev`. Open any case with at least one evidence URL and
   click **Verify on GenLayer** — this calls `create_escrow` and `adjudicate`
   for real on Testnet Bradbury and shows the live verdict, escrow id, and a
   link to [GenLayer's explorer](https://explorer-bradbury.genlayer.com/).

See `.env.example` for the full list of optional environment variables
(a real Postgres/Neon `DATABASE_URL` and an `XAI_API_KEY` for LLM-backed
adjudication in the *simulated* flow are both optional too — everything has a
working fallback).

## Project layout

- [`src/lib/protocol/`](src/lib/protocol) — the domain model: escrow/round/settlement
  types, the committee-selection and majority-vote math, the seeded demo
  cases, and the Zustand state machine driving the simulation.
- [`src/lib/protocol/genlayer.server.ts`](src/lib/protocol/genlayer.server.ts) —
  server-only bridge to the real deployed contracts (never bundled to the
  browser; the deployer key stays server-side).
- [`contracts/`](contracts) — the two GenLayer Intelligent Contracts.
- [`src/routes/`](src/routes) — `escrows` (docket + case detail), `vaults`,
  `settlements`, `protocol` (architecture explainer), `new` (create a case).
- [`screenshots/`](screenshots) — the UI, for a quick look without running it.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run build       # vite build + migrations
npm test            # protocol logic + tooling scripts
npm run lint
```
