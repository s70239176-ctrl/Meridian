import { Lock, Unlock } from "lucide-react";
import type { ConsensusRound } from "@/lib/protocol/types";
import { cn } from "@/lib/utils";

export function Committee({ round }: { round: ConsensusRound }) {
  const revealed = round.seats.filter((s) => s.vote).length;
  const yes = round.seats.filter((s) => s.vote?.equivalent).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
          Round {round.index + 1} · {round.committeeSize} validators
        </p>
        <p className="text-xs text-muted tabular-nums">
          {revealed === 0
            ? `${round.seats.filter((s) => s.committed).length} committed`
            : `${yes} equivalent / ${revealed} revealed`}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {round.seats.map((seat) => {
          const isLeader = seat.id === round.leaderId;
          return (
            <li
              key={seat.id}
              className={cn(
                "rounded-lg bg-surface-2 p-3 shadow-[var(--shadow-border)]",
                isLeader && "bg-surface",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted">{isLeader ? "Leader" : "Validator"}</p>
                {seat.committed && !seat.vote ? <Lock className="size-3 text-faint" /> : null}
                {seat.vote ? <Unlock className="size-3 text-faint" /> : null}
              </div>
              <p className="mt-1 font-mono text-xs tracking-wide text-fg">{seat.label}</p>
              <p className="mt-2 text-[11px] text-faint">Model undisclosed · greyboxed</p>
              {seat.vote ? (
                <p className={cn("mt-2 text-xs", seat.vote.equivalent ? "text-paid" : "text-danger")}>
                  {seat.vote.equivalent ? "Equivalent" : "Not equivalent"}
                </p>
              ) : (
                <p className="mt-2 text-xs text-faint">{seat.committed ? "Committed" : "Waiting"}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
