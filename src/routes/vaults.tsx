import { createFileRoute, Link } from "@tanstack/react-router";
import { chainVaults } from "@/lib/protocol/stats";
import { formatUsd } from "@/lib/protocol/format";
import { CHAIN_META } from "@/lib/protocol/types";
import { useEscrowStore } from "@/lib/protocol/store";

export const Route = createFileRoute("/vaults")({ component: VaultsPage });

function VaultsPage() {
  const escrows = useEscrowStore((s) => s.escrows);
  const rows = chainVaults(escrows);

  return (
    <div>
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Source-chain custody</p>
      <h1 className="font-display mt-2 text-4xl tracking-tight text-fg">Vaults</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Every dollar in Meridian sits in a dumb vault on another chain. GenLayer never holds a balance. After a
        post-appeal verdict, a settlement message is the only thing that can move it.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <article key={row.chain} className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-[0.16em] text-muted uppercase">{CHAIN_META[row.chain].eip155}</p>
            <h2 className="font-display mt-2 text-2xl tracking-tight text-fg">{row.label}</h2>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs tracking-[0.14em] text-faint uppercase">Locked</dt>
                <dd className="mt-1 tabular-nums text-fg">{formatUsd(row.locked)}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-[0.14em] text-faint uppercase">Settled</dt>
                <dd className="mt-1 tabular-nums text-fg">{formatUsd(row.settled)}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-[0.14em] text-faint uppercase">Vaults</dt>
                <dd className="mt-1 tabular-nums text-fg">{row.vaults}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-[0.14em] text-faint uppercase">Messages</dt>
                <dd className="mt-1 tabular-nums text-fg">{row.messages}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        Open a case from the{" "}
        <Link to="/escrows" className="text-fg underline-offset-4 hover:underline">
          docket
        </Link>{" "}
        to inspect a vault address and lock transaction.
      </p>
    </div>
  );
}
