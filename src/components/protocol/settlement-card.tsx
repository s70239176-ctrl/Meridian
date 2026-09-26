import { formatAmount, shortAddr, verdictLabel, verdictRecipient } from "@/lib/protocol/format";
import { arcExplorerTxUrl } from "@/lib/chain/explorer";
import { CHAIN_META, type Escrow } from "@/lib/protocol/types";
import { Badge } from "@/components/ui/badge";

export function SettlementCard({ escrow }: { escrow: Escrow }) {
  if (!escrow.verdict) return null;
  const chain = CHAIN_META[escrow.sourceChain];
  const recipient = verdictRecipient(escrow, escrow.verdict);
  return (
    <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Settlement</p>
        <Badge tone={escrow.settleTx ? "paid" : "live"}>{escrow.settleTx ? "settled" : "pending relay"}</Badge>
      </div>
      <p className="font-display mt-3 text-2xl tracking-tight text-fg">
        {verdictLabel(escrow.verdict, escrow.payeeBps)}
      </p>
      <p className="mt-1 text-sm text-muted">
        {formatAmount(escrow.amount, escrow.asset)} → {shortAddr(recipient)} on {chain.label}
      </p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs tracking-[0.14em] text-faint uppercase">From</dt>
          <dd className="mt-1 text-fg">GenLayer (adjudication only)</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.14em] text-faint uppercase">Vault</dt>
          <dd className="mt-1 font-mono text-xs text-fg">{shortAddr(escrow.vaultAddress, 6)}</dd>
        </div>
      </dl>
      {escrow.reasoning ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">{escrow.reasoning}</p>
      ) : null}
      {escrow.settleTx ? (
        <a
          className="mt-3 block text-xs text-faint underline"
          href={arcExplorerTxUrl(escrow.settleTx)}
          target="_blank"
          rel="noreferrer"
        >
          Source-chain settlement tx {shortAddr(escrow.settleTx, 8)}
        </a>
      ) : (
        <p className="mt-3 text-xs text-faint">Verdict is final. Waiting for the relayer to submit it to the vault.</p>
      )}
    </article>
  );
}
