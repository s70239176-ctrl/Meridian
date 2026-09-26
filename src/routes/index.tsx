import { createFileRoute, Link } from "@tanstack/react-router";
import { Architecture } from "@/components/protocol/architecture";
import { EscrowRow } from "@/components/protocol/escrow-row";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/protocol/format";
import { protocolStats } from "@/lib/protocol/stats";
import { useEscrowStore } from "@/lib/protocol/store";

export const Route = createFileRoute("/")({ component: Home });

const USE_CASES = [
  {
    k: "Agentic commerce",
    d: "Did the delivered brief, API, or SLA match the contract in meaning — not just a boolean flag?",
  },
  {
    k: "Marketplace disputes",
    d: "Lock on Arc. Judge on GenLayer. Pay only after a real, on-chain settlement message hits the vault.",
  },
  {
    k: "Parametric conditions",
    d: "A public evidence page decides the case. The vault does not move until GenLayer finalizes.",
  },
  {
    k: "Grants & retro funding",
    d: "Natural-language milestones. If evidence shows the milestone was missed, the message refunds the payer.",
  },
];

function Home() {
  const escrows = useEscrowStore((s) => s.escrows);
  const live = escrows.slice(0, 3);
  const stats = protocolStats(escrows);

  return (
    <div>
      <section className="hairline-grid -mx-4 rounded-none px-4 py-10 sm:-mx-6 sm:px-6 sm:py-16">
        <div className="stagger-in max-w-3xl">
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Resolution layer · escrow</p>
          <h1 className="font-display mt-5 text-4xl leading-[1.12] tracking-tight text-fg sm:text-6xl">
            Hold funds on Arc Testnet. Adjudicate on GenLayer. Pay out only after a real verdict.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Meridian is built the way GenLayer is positioned: as an adjudication layer, not a payments chain. Every
            deposit, verdict, and settlement here is a real transaction — connect a wallet, lock real testnet funds,
            and watch GenLayer's deployed Intelligent Contract judge the case for real.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/new">Open a vault</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link to="/protocol">How it works</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Locked in vaults", v: formatUsd(stats.locked) },
          { k: "Live cases", v: String(stats.live) },
          { k: "Settlement messages", v: String(stats.messages) },
          { k: "Custody chains", v: String(stats.chains) },
        ].map((s) => (
          <article key={s.k} className="rounded-xl bg-surface px-4 py-4 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-[0.14em] text-muted uppercase">{s.k}</p>
            <p className="font-display mt-2 text-2xl tracking-tight text-fg tabular-nums">{s.v}</p>
          </article>
        ))}
      </section>

      <section className="mt-16">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">The split</p>
        <h2 className="font-display mt-3 text-3xl tracking-tight text-fg">GenLayer never holds the funds.</h2>
        <Architecture className="mt-8" />
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {[
          { k: "Committee", v: "Real GenLayer consensus", d: "The deployed contract's leader/validator run decides every verdict — no fabricated votes." },
          { k: "Appeal", v: "Protocol-level", d: "Appeals happen on GenLayer's own adjudicate transaction, not a second in-app step." },
          { k: "Payout", v: "After finality", d: "The vault ignores anything short of a real, relayed settlement message." },
        ].map((stat) => (
          <article key={stat.k} className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-[0.16em] text-muted uppercase">{stat.k}</p>
            <p className="font-display mt-3 text-3xl tracking-tight text-fg">{stat.v}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{stat.d}</p>
          </article>
        ))}
      </section>

      <section className="mt-16">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Why the split</p>
        <h2 className="font-display mt-3 text-3xl tracking-tight text-fg">Judgment is not custody.</h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs tracking-[0.14em] text-muted uppercase">
                <th className="py-3 pr-4 font-medium"> </th>
                <th className="py-3 pr-4 font-medium">If GenLayer held the funds</th>
                <th className="py-3 font-medium">Resolution layer</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              {[
                ["Where money sits", "On the judgment chain", "On Arc Testnet (Vault.sol)"],
                ["What GenLayer does", "Judge and pay", "Judge only"],
                ["Appeal", "Also a custody event", "GenLayer's protocol appeal. Vault stays locked"],
                ["Payout trigger", "Same-chain transfer", "A relayed settlement message after finality"],
              ].map(([k, a, b]) => (
                <tr key={k} className="border-b border-border">
                  <th className="py-3 pr-4 font-medium text-fg">{k}</th>
                  <td className="py-3 pr-4">{a}</td>
                  <td className="py-3 text-fg">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Built for judgment</p>
        <h2 className="font-display mt-3 text-3xl tracking-tight text-fg">Cases code cannot close alone.</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {USE_CASES.map((c) => (
            <div key={c.k} className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
              <p className="text-xs tracking-[0.16em] text-muted uppercase">{c.k}</p>
              <p className="mt-3 text-sm leading-relaxed text-fg">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Live dockets</p>
            <h2 className="font-display mt-2 text-3xl tracking-tight text-fg">Walk a case to payout</h2>
          </div>
          <Button asChild variant="ghost">
            <Link to="/escrows">All cases</Link>
          </Button>
        </div>
        {live.length === 0 ? (
          <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-[var(--shadow-border)]">
            No cases yet.{" "}
            <Link to="/new" className="underline">
              Open a vault
            </Link>{" "}
            to create the first real one.
          </p>
        ) : (
          <div className="space-y-2">
            {live.map((escrow) => (
              <EscrowRow key={escrow.id} escrow={escrow} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
