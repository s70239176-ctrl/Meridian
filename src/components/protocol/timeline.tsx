import { formatClock } from "@/lib/protocol/format";
import type { Escrow, EscrowStatus } from "@/lib/protocol/types";

type Step = { title: string; detail: string; at?: number; done: boolean; current: boolean };

function phaseOf(status: EscrowStatus): number {
  switch (status) {
    case "locked":
      return 0;
    case "disputed":
      return 1;
    case "proposing":
      return 2;
    case "voting":
      return 3;
    case "optimistic":
    case "appealed":
      return 4;
    case "final":
      return 5;
    case "dispatching":
      return 6;
    case "paid":
    case "refunded":
      return 7;
  }
}

export function buildTimeline(escrow: Escrow): Step[] {
  const last = escrow.rounds[escrow.rounds.length - 1];
  const phase = phaseOf(escrow.status);
  const steps: Omit<Step, "done" | "current">[] = [
    {
      title: "Funds locked",
      detail: `Vault on ${escrow.sourceChain} holds ${escrow.amount} ${escrow.asset}. GenLayer has no custody.`,
      at: escrow.createdAt,
    },
    {
      title: "Dispute opened",
      detail: "Intelligent Contract begins. A 5-validator committee is drawn.",
    },
    {
      title: "Leader proposes",
      detail: last
        ? `Proposed ${last.proposedVerdict.replaceAll("_", " ")}.`
        : "Leader executes the contract and proposes a result.",
      at: last?.startedAt,
    },
    {
      title: "Commit · reveal",
      detail: "Committee commits votes, then reveals. Majority must find the proposal equivalent.",
      at: last?.revealedAt,
    },
    {
      title: "Appeal window",
      detail: "Anyone may post a bond. Each appeal grows the set to 2n+1 (5 → 11 → 23).",
      at: escrow.optimisticAt ?? escrow.appealedAt,
    },
    {
      title: "Finality",
      detail: "Post-appeal verdict is canonical. Still no funds moved.",
      at: escrow.finalizedAt,
    },
    {
      title: "External message pays out",
      detail: "Settlement message is posted to the source-chain vault. Only then does money move.",
      at: escrow.settlement?.confirmedAt ?? escrow.settlement?.dispatchedAt,
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
          </div>
        </li>
      ))}
    </ol>
  );
}
