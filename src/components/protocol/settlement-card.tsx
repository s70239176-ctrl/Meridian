import { formatAmount, formatClock, shortAddr, verdictLabel } from "@/lib/protocol/format";
import { CHAIN_META, type Escrow, type SettlementMessage } from "@/lib/protocol/types";
import { Badge } from "@/components/ui/badge";

export function SettlementCard({ escrow, message }: { escrow?: Escrow; message: SettlementMessage }) {
  const chain = CHAIN_META[message.toChain];
  return (
    <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Settlement message</p>
        <Badge tone={message.status === "confirmed" ? "paid" : message.status === "posted" ? "live" : "muted"}>
          {message.status}
        </Badge>
      </div>
      <p className="font-display mt-3 text-2xl tracking-tight text-fg">
        {verdictLabel(message.payload.verdict, message.payload.splitBps)}
      </p>
      <p className="mt-1 text-sm text-muted">
        {formatAmount(message.payload.amount, message.payload.asset)} → {shortAddr(message.payload.recipient)} on {chain.label}
      </p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs tracking-[0.14em] text-faint uppercase">From</dt>
          <dd className="mt-1 text-fg">GenLayer (adjudication only)</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.14em] text-faint uppercase">Vault</dt>
          <dd className="mt-1 font-mono text-xs text-fg">{shortAddr(message.vault, 6)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.14em] text-faint uppercase">Finality hash</dt>
          <dd className="mt-1 font-mono text-xs text-fg">{shortAddr(message.payload.finalityHash, 6)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.14em] text-faint uppercase">Appeal rounds</dt>
          <dd className="mt-1 tabular-nums text-fg">{message.payload.appealRounds}</dd>
        </div>
      </dl>
      <pre className="mt-5 overflow-x-auto rounded-lg bg-bg p-4 font-mono text-xs leading-relaxed text-muted">
        {JSON.stringify(
          {
            type: message.type,
            from: message.from,
            to: { chain: chain.eip155, vault: message.vault },
            instruction: {
              action: message.payload.verdict,
              amount: message.payload.amount,
              asset: message.payload.asset,
              recipient: message.payload.recipient,
            },
            proof: {
              escrow: message.payload.escrowId,
              finality: message.payload.finalityHash,
              committee: message.payload.committeeRoot,
              appeals: message.payload.appealRounds,
              window_closed_at: formatClock(message.payload.windowClosedAt),
            },
            title: escrow?.title,
          },
          null,
          2,
        )}
      </pre>
      {message.sourceTx ? (
        <p className="mt-3 text-xs text-faint">
          Source-chain tx {shortAddr(message.sourceTx, 8)} · confirmed {message.confirmedAt ? formatClock(message.confirmedAt) : ""}
        </p>
      ) : (
        <p className="mt-3 text-xs text-faint">Queued until post-appeal finality. Funds have not moved.</p>
      )}
    </article>
  );
}
