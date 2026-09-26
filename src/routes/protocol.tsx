import { createFileRoute, Link } from "@tanstack/react-router";
import { Architecture } from "@/components/protocol/architecture";
import { Button } from "@/components/ui/button";
import { deployment } from "@/lib/protocol/deployment";
import { arcExplorerAddressUrl } from "@/lib/chain/explorer";

export const Route = createFileRoute("/protocol")({ component: ProtocolPage });

function ProtocolPage() {
  const linked = deployment();
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">How Meridian is wired</p>
      <h1 className="font-display mt-2 text-4xl tracking-tight text-fg sm:text-5xl">
        Adjudication on GenLayer. Custody on Arc Testnet.
      </h1>
      <p className="mt-5 text-base leading-relaxed text-muted">
        Payments rails (x402), identity (ERC-8004) and interoperability (A2A) are shipping. Dispute resolution is
        the missing layer. Meridian uses GenLayer for that layer only: a real deployed Intelligent Contract judges
        the case, then a relayer submits the real verdict to a real vault on Arc Testnet.
      </p>

      <Architecture className="mt-10" />

      <section className="mt-14">
        <h2 className="font-display text-3xl tracking-tight text-fg">Why the vault is not on GenLayer</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          If the same chain both holds the money and judges the dispute, every appeal is also a custody event.
          Meridian keeps those jobs apart. Vault.sol is dumb: lock, then release or refund only when the relayer
          submits a verdict signed off by GenLayer. GenLayer never sees the vault's funds or private keys.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl tracking-tight text-fg">How a verdict is actually reached</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <li>The deployed MeridianAdjudicator contract's leader fetches the case's evidence URLs and prompts its model for a verdict.</li>
          <li>Every validator independently re-fetches the same evidence and re-runs the same prompt with its own model.</li>
          <li><code className="text-fg">gl.eq_principle.prompt_comparative</code> — GenLayer's real consensus primitive — decides via NLP whether the leader's and each validator's answers agree under the stated equivalence principle.</li>
          <li>Appeals on a live case are GenLayer's own protocol-level appeals on the adjudicate transaction, not a separate in-app step.</li>
          <li>Only once GenLayer finalizes does <code className="text-fg">SettlementOutbox.record</code> get called, producing the real payout instruction the relayer reads.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl tracking-tight text-fg">The settlement message</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          <code className="text-fg">SettlementOutbox.get_message</code> returns the real, finalized instruction: verdict, payee share, source chain, vault address, asset, amount, and recipient. The relayer parses this and calls Vault.sol's <code className="text-fg">settle()</code> — the only step where funds actually move.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl tracking-tight text-fg">Linked contracts</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          These addresses are read from environment variables at build time. Vite inlines <span className="text-fg">VITE_</span> values, so a saved variable does nothing until the next build.
        </p>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">VITE_MERIDIAN_ADJUDICATOR (GenLayer Studio)</dt>
            <dd className="mt-1 break-all font-mono text-fg">{linked.adjudicator ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">VITE_MERIDIAN_OUTBOX (GenLayer Studio)</dt>
            <dd className="mt-1 break-all font-mono text-fg">{linked.outbox ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">VITE_VAULT_ADDRESS (Arc Testnet)</dt>
            <dd className="mt-1 break-all font-mono text-fg">
              {linked.vault ? (
                <a className="underline" href={arcExplorerAddressUrl(linked.vault)} target="_blank" rel="noreferrer">
                  {linked.vault}
                </a>
              ) : (
                "Not set"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl tracking-tight text-fg">What this console is</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          A real client for the resolution-layer flow above. The addresses shown are the actual deployed contracts;
          opening a vault deposits real testnet funds and every subsequent action is a real transaction.
        </p>
        <Button asChild className="mt-6">
          <Link to="/escrows">Open the docket</Link>
        </Button>
      </section>
    </div>
  );
}
