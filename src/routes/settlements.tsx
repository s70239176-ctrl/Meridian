import { createFileRoute, Link } from "@tanstack/react-router";
import { SettlementCard } from "@/components/protocol/settlement-card";
import { allSettlements } from "@/lib/protocol/store";

export const Route = createFileRoute("/settlements")({ component: SettlementsPage });

function SettlementsPage() {
  const rows = allSettlements();

  return (
    <div>
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Message bus</p>
      <h1 className="font-display mt-2 text-4xl tracking-tight text-fg">Settlements</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Each item is a real settlement, relayed from GenLayer's outbox to the vault on Arc Testnet. Nothing here is a
        GenLayer transfer — the vault pays only after the relayer submits a finalized verdict.
      </p>

      <div className="mt-8 space-y-4">
        {rows.length === 0 ? (
          <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-[var(--shadow-border)]">
            No settlements yet. Adjudicate and relay a case first.
          </p>
        ) : (
          rows.map((escrow) => (
            <div key={escrow.id} className="space-y-2">
              <Link
                to="/escrows/$id"
                params={{ id: escrow.id }}
                className="inline-flex h-11 items-center text-sm text-muted hover:text-fg"
              >
                {escrow.id} · {escrow.title}
              </Link>
              <SettlementCard escrow={escrow} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
