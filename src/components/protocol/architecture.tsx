import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    kicker: "01 · Custody",
    title: "Source-chain vault",
    body: "USDC, USDT or ETH is locked in a vault on Ethereum, Base, Arbitrum, Optimism or BNB Chain. Meridian never takes possession.",
  },
  {
    kicker: "02 · Judgment",
    title: "GenLayer only adjudicates",
    body: "An Intelligent Contract reads evidence and natural language. Optimistic Democracy starts with 5 validators and grows 2n+1 on appeal.",
  },
  {
    kicker: "03 · Settlement",
    title: "Message after finality",
    body: "When the appeal window closes, an external settlement message instructs the vault to release or refund. Not before.",
  },
];

export function Architecture({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch", className)}>
      {STEPS.map((step, i) => (
        <li key={step.kicker} className="contents">
          <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">{step.kicker}</p>
            <h3 className="font-display mt-3 text-2xl leading-snug tracking-tight text-fg">{step.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
          </article>
          {i < STEPS.length - 1 ? (
            <div className="flex items-center justify-center text-faint" aria-hidden="true">
              <ArrowRight className="hidden size-4 md:block" />
              <ArrowDown className="size-4 md:hidden" />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
