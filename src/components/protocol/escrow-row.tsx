import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/protocol/status-badge";
import { chainLabel, formatAmount, shortAddr } from "@/lib/protocol/format";
import type { Escrow } from "@/lib/protocol/types";

export function EscrowRow({ escrow }: { escrow: Escrow }) {
  return (
    <Link
      to="/escrows/$id"
      params={{ id: escrow.id }}
      className="grid grid-cols-1 gap-2 rounded-xl bg-surface px-4 py-4 shadow-[var(--shadow-border)] transition-[box-shadow] duration-[var(--motion-quick)] hover:shadow-[var(--shadow-border-hover)] sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:gap-6"
    >
      <p className="font-mono text-xs tracking-wide text-muted">{escrow.id}</p>
      <div className="min-w-0">
        <p className="truncate text-sm text-fg">{escrow.title}</p>
        <p className="mt-1 text-xs text-muted">
          {chainLabel(escrow.sourceChain)} · {formatAmount(escrow.amount, escrow.asset)} · vault {shortAddr(escrow.vaultAddress)}
        </p>
      </div>
      <StatusBadge status={escrow.status} />
    </Link>
  );
}
