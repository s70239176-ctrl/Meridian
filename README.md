# Meridian

Meridian is a cross-chain **resolution layer** for escrows: real funds are
locked in a real vault contract on the source chain (currently
[Arc Testnet](https://docs.arc.io)), and [GenLayer](https://genlayer.com) — a
blockchain whose Intelligent Contracts run LLM-backed validator consensus —
only **judges** whether the deal's spec was met. GenLayer never touches the
funds. Once a verdict is final, GenLayer's own contract emits a settlement
*message*; a relayer reads that message and tells the vault who gets paid.
Meridian itself never moves money — it decides who should be paid, and lets
the vault do the paying.

**Everything here is real — no mocked or simulated state.** Depositing,
adjudicating, and settling are all real transactions on Arc Testnet and
GenLayer Studio, driven by a real connected wallet.

## The real flow

1. **Connect a wallet** (any injected wallet, e.g. MetaMask) on the "New
   vault" page. The app prompts it to add/switch to Arc Testnet if needed.
2. **Deposit** — submitting the form sends a real transaction to
   [`contracts/Vault.sol`](contracts/Vault.sol), a deployed Solidity contract
   that locks the deposited USDC (Arc's native currency) until settled.
3. **Register on GenLayer** — the app then calls the real, deployed
   `MeridianAdjudicator.create_escrow()` on GenLayer Studio with the same
   case facts.
4. **Adjudicate** — from the case page, "Run adjudication" calls the real
   `adjudicate()` write. GenLayer's leader fetches your evidence URLs and
   prompts its model; every validator independently re-runs the same check
   and `gl.eq_principle.prompt_comparative` — GenLayer's real consensus
   primitive — decides via NLP whether their answers agree. This is genuine
   leader/validator consensus, not a local heuristic or canned response.
5. **Relay settlement** — once finalized, GenLayer's contract has already
   written a message to `contracts/settlement_outbox.py`. Clicking "Relay
   settlement" reads that real message and submits it to `Vault.sol`, which
   actually releases or refunds the locked funds. This is the only step
   where money moves.

Every transaction hash shown in the UI links to a real block explorer
(Arc's [ArcScan](https://testnet.arcscan.app) or
[GenLayer Studio's explorer](https://genlayer-explorer.vercel.app)).

## Quickstart

```bash
npm install
npm run dev
```

The app renders immediately, but creating a case needs both contract systems
deployed first (below) — there is no zero-setup demo mode, by design.

## Deploying the GenLayer contracts

Uses [GenLayer Studio](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio)
(`studionet`) — GenLayer's stable, hosted, **gasless** network. A 0 GEN
balance is expected and doesn't block anything, so there's no faucet step —
you still need a keypair, just to sign the calls.

1. Install the GenLayer CLI and point it at Studio:
   ```bash
   npm install -g genlayer
   genlayer init
   genlayer network set studionet
   ```
2. Generate a fresh keypair for this project (do **not** use an existing
   wallet key):
   ```bash
   node scripts/gen-testnet-key.mjs
   ```
   Copy the printed private key into a local `.env` (never commit it):
   ```
   GENLAYER_DEPLOYER_KEY=0x...
   ```
3. Deploy the outbox first, then the adjudicator (which needs the outbox's
   address), then bind them:
   ```bash
   genlayer deploy --contract contracts/settlement_outbox.py
   genlayer deploy --contract contracts/meridian_adjudicator.py --args <outbox_address>
   # then, calling the outbox as its deployer:
   # set_adjudicator(<adjudicator_address>)
   ```
4. Put both deployed addresses in `.env`:
   ```
   VITE_MERIDIAN_ADJUDICATOR=0x...
   VITE_MERIDIAN_OUTBOX=0x...
   ```

Note: `studionet` is a shared, rate-limited environment (60 req/min, 1000/hr,
10000/day per IP) meant for demos and collaboration, not durable storage —
GenLayer also offers `testnetBradbury`/`testnetAsimov` (funded via a faucet)
for longer-lived public testnet deployments, and `localnet` for fully local
development.

## Deploying the vault (Arc Testnet)

1. Fund a keypair with testnet USDC from the [Circle faucet](https://faucet.circle.com)
   (select Arc Testnet). This same key can act as both deployer and relayer,
   or you can split them.
   ```
   VAULT_DEPLOYER_KEY=0x...
   VAULT_RELAYER_KEY=0x...
   ```
2. Deploy:
   ```bash
   node scripts/deploy-vault.mjs
   ```
   This compiles [`contracts/Vault.sol`](contracts/Vault.sol) with `solc` and
   deploys it via `viem`, printing the deployed address.
3. Put it in `.env`:
   ```
   VITE_VAULT_ADDRESS=0x...
   ```

**A note on decimals:** Arc's native currency (what a wallet's `msg.value`
means) is USDC accounted with **18 decimals**, ether-style — not the 6
decimals its separate ERC-20 view uses. Same underlying funds, two
precisions. See [`circlefin/arc-node` issues #95](https://github.com/circlefin/arc-node/issues/95)
and [#453](https://github.com/circlefin/arc-node/issues/453). Everything in
this repo (`Vault.sol`, `src/lib/chain/vault.ts`, `scripts/deploy-vault.mjs`)
already accounts for this — just don't assume 6 decimals if you extend it.

Restart `npm run dev` once all four env vars are set, and "New vault" will
let you create a real case end to end.

See `.env.example` for the full list of environment variables (a real
Postgres/Neon `DATABASE_URL` is optional too — the app falls back to an
embedded PGLite instance with zero config).

## Project layout

- [`contracts/Vault.sol`](contracts/Vault.sol) — the source-chain vault:
  locks a deposit, and only the configured relayer can trigger a payout.
- [`contracts/meridian_adjudicator.py`](contracts/meridian_adjudicator.py) +
  [`contracts/settlement_outbox.py`](contracts/settlement_outbox.py) — the
  GenLayer Intelligent Contracts that judge cases and record verdicts.
- [`src/lib/protocol/genlayer.ts`](src/lib/protocol/genlayer.ts) — real
  create/adjudicate/read calls to the deployed GenLayer contracts, each
  wrapped in a `createServerFn`; TanStack Start extracts the handler into a
  server-only chunk, so `GENLAYER_DEPLOYER_KEY` never reaches the browser.
- [`src/lib/chain/`](src/lib/chain) — Arc Testnet wallet connection
  (`wallet.ts`), the vault's ABI and deposit helper (`vault.ts`), and the
  relayer that submits GenLayer's verdict to the vault (`relay.ts` /
  `relay.server.ts`).
- [`src/lib/protocol/store.ts`](src/lib/protocol/store.ts) — a thin local
  index of cases this browser has created (id, tx hashes). It is a
  convenience cache, not the source of truth: the real state lives on Arc
  and on GenLayer.
- [`src/routes/`](src/routes) — `new` (connect + deposit + register),
  `escrows` (docket + case detail with the real adjudicate/relay actions),
  `vaults`, `settlements`, `protocol` (architecture explainer).

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run build       # vite build + migrations
npm test            # domain logic + tooling scripts
npm run lint
```
