import { createFileRoute, Link } from "@tanstack/react-router";
import { SettlementCard } from "@/components/protocol/settlement-card";
import { useEscrowStore } from "@/lib/protocol/store";

export const Route = createFileRoute("/settlements")({ component: SettlementsPage });

function SettlementsPage() {
  const escrows = useEscrowStore((s) => s.escrows);
  const rows = escrows
    .filter((e) => e.settlement)
    .map((e) => ({ escrow: e, message: e.settlement! }))
    .sort((a, b) => b.message.dispatchedAt - a.message.dispatchedAt);

  return (
    <div>
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Message bus</p>
      <h1 className="font-display mt-2 text-4xl tracking-tight text-fg">Settlements</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Each item is an external message from GenLayer to a source-chain vault. Nothing here is a GenLayer
        transfer — the vault pays only after a post-appeal verdict.
      </p>

      <div className="mt-8 space-y-4">
        {rows.length === 0 ? (
          <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-[var(--shadow-border)]">
            No settlement messages yet. Finalize a case first.
          </p>
        ) : (
          rows.map(({ escrow, message }) => (
            <div key={message.id} className="space-y-2">
              <Link
                to="/escrows/$id"
                params={{ id: escrow.id }}
                className="inline-flex h-11 items-center text-sm text-muted hover:text-fg"
              >
                {escrow.id} · {escrow.title}
              </Link>
              <SettlementCard escrow={escrow} message={message} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
