import { formatClock } from "@/lib/protocol/format";
import { arcExplorerTxUrl } from "@/lib/chain/explorer";
import { genlayerExplorerTxUrl } from "@/lib/protocol/genlayer-explorer";
import type { Escrow, EscrowStatus } from "@/lib/protocol/types";

type Step = { title: string; detail: string; at?: number; href?: string; done: boolean; current: boolean };

function phaseOf(status: EscrowStatus): number {
  switch (status) {
    case "locked":
      return 0;
    case "adjudicating":
      return 1;
    case "adjudicated":
      return 2;
    case "relaying":
      return 3;
    case "settled":
      return 4;
  }
}

export function buildTimeline(escrow: Escrow): Step[] {
  const phase = phaseOf(escrow.status);
  const steps: Omit<Step, "done" | "current">[] = [
    {
      title: "Funds locked",
      detail: `Vault on ${escrow.sourceChain} holds ${escrow.amount} ${escrow.asset}. GenLayer has no custody.`,
      at: escrow.createdAt,
      href: arcExplorerTxUrl(escrow.lockTx),
    },
    {
      title: "GenLayer adjudicates",
      detail: "The real MeridianAdjudicator contract fetches evidence and reaches a verdict via validator consensus.",
      href: escrow.adjudicateTx ? genlayerExplorerTxUrl(escrow.adjudicateTx) : undefined,
    },
    {
      title: "Verdict finalized",
      detail: escrow.verdict
        ? `Verdict: ${escrow.verdict.replaceAll("_", " ")}${escrow.reasoning ? ` — ${escrow.reasoning}` : ""}`
        : "Awaiting the finalized verdict.",
    },
    {
      title: "Settlement relayed",
      detail: "The relayer reads the real settlement_outbox message and submits it to the vault.",
      href: escrow.settleTx ? arcExplorerTxUrl(escrow.settleTx) : undefined,
    },
    {
      title: "Paid on the source chain",
      detail: "The vault has released funds per the verdict. This is the only step that moves money.",
    },
  ];

  return steps.map((step, i) => ({
    ...step,
    done: phase > i,
    current: phase === i,
  }));
}

export function Timeline({ escrow }: { escrow: Escrow }) {
  const steps = buildTimeline(escrow);
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={step.title} className="grid grid-cols-[16px_1fr] gap-x-3">
          <div className="flex flex-col items-center">
            <span
              className={
                step.current
                  ? "mt-1 size-2.5 rounded-full bg-primary"
                  : step.done
                    ? "mt-1 size-2.5 rounded-full bg-fg"
                    : "mt-1 size-2.5 rounded-full bg-border"
              }
            />
            {i < steps.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
          </div>
          <div className="pb-5">
            <p className="text-sm text-fg">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{step.detail}</p>
            {step.at ? <p className="mt-1 text-xs text-faint tabular-nums">{formatClock(step.at)}</p> : null}
            {step.href ? (
              <a className="mt-1 block text-xs text-muted underline" href={step.href} target="_blank" rel="noreferrer">
                View transaction
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
