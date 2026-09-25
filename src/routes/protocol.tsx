import { createFileRoute, Link } from "@tanstack/react-router";
import { Architecture } from "@/components/protocol/architecture";
import { Button } from "@/components/ui/button";
import { deployment } from "@/lib/protocol/deployment";

export const Route = createFileRoute("/protocol")({ component: ProtocolPage });

const ESCALATION = [
  { n: "5", d: "First round. One leader. Optimistic if majority equivalent." },
  { n: "11", d: "Validator appeal. Fresh committee, same proposal. 2n+1." },
  { n: "23", d: "Second appeal. Set roughly doubles. Bond 2.5× if you win." },
  { n: "47", d: "Further appeal. Schelling point: honest judgment is cheaper." },
  { n: "~1k", d: "Maximum set. Majority stands. Then — and only then — a message." },
];

function ProtocolPage() {
  const linked = deployment();
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">How Meridian is wired</p>
      <h1 className="font-display mt-2 text-4xl tracking-tight text-fg sm:text-5xl">
        Adjudication on GenLayer. Custody everywhere else.
      </h1>
      <p className="mt-5 text-base leading-relaxed text-muted">
        Payments rails (x402), identity (ERC-8004) and interoperability (A2A) are shipping. Dispute resolution is
        the missing layer. Meridian uses GenLayer for that layer only: Intelligent Contracts, Optimistic Democracy,
        appeals, then an external message that a vault on another chain can trust.
      </p>

      <Architecture className="mt-10" />

      <section className="mt-14">
        <h2 className="font-display text-3xl tracking-tight text-fg">Why the vault is not on GenLayer</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          If the same chain both holds the money and judges the dispute, every appeal is also a custody event.
          Meridian keeps those jobs apart. The source-chain vault is dumb: lock, then release or refund when it
          receives a settlement message that proves post-appeal finality. GenLayer never sees the private keys.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl tracking-tight text-fg">Optimistic Democracy, as used here</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <li>First round always draws 5 validators. One leader proposes. The rest test the Equivalence Principle.</li>
          <li>More than 50% equivalent → optimistic accept. An appeal window opens (minutes on the network; 90s in this console).</li>
          <li>A validator appeal reseats a fresh committee of 2n+1 (11, then 23, then 47) against the same proposal.</li>
          <li>A successful appellant receives 2.5× the posted bond. Honest judgment is the profitable strategy.</li>
          <li>Only after the window closes with no valid appeal is the verdict final — and only then is a message dispatched.</li>
        </ul>
        <ol className="mt-8 grid gap-3 sm:grid-cols-5">
          {ESCALATION.map((row) => (
            <li key={row.n} className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="font-display text-2xl tracking-tight text-fg tabular-nums">{row.n}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{row.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl tracking-tight text-fg">The settlement message</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Type <span className="text-fg">meridian.settlement.v1</span>. It names the vault, the instruction
          (release, refund, or split), the recipient, the finality hash, the committee root, and the number of
          appeal rounds. The vault contract verifies that proof. If the message is missing any of it, funds stay put.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl tracking-tight text-fg">Linked contracts</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Studio addresses are public. Set them on Vercel, then redeploy. Vite inlines <span className="text-fg">VITE_</span> values at build time, so a saved variable does nothing until the next build.
        </p>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">VITE_MERIDIAN_ADJUDICATOR</dt>
            <dd className="mt-1 break-all font-mono text-fg">{linked.adjudicator ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">VITE_MERIDIAN_OUTBOX</dt>
            <dd className="mt-1 break-all font-mono text-fg">{linked.outbox ?? "Not set"}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl tracking-tight text-fg">What this console is</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          A working model of the resolution-layer flow. The addresses above are the deployed contracts. Vault locks
          and source-chain receipts are still not executed from this page.
        </p>
        <Button asChild className="mt-6">
          <Link to="/escrows">Open the docket</Link>
        </Button>
      </section>
    </div>
  );
}
