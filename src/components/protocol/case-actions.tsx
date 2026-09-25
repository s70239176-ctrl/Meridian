import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adjudicateEscrow } from "@/lib/protocol/adjudicate";
import { formatRemaining } from "@/lib/protocol/format";
import { useEscrowStore } from "@/lib/protocol/store";
import type { Escrow } from "@/lib/protocol/types";
import { useNow } from "./use-now";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function CaseActions({ escrow }: { escrow: Escrow }) {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const store = useEscrowStore();

  const windowLeft =
    escrow.status === "optimistic" && escrow.optimisticAt && now
      ? escrow.optimisticAt + escrow.appealWindowMs - now
      : null;
  const windowClosed = windowLeft !== null && windowLeft <= 0;

  async function runRound() {
    setBusy(true);
    try {
      if (escrow.status === "locked") store.openDispute(escrow.id);
      const result = await adjudicateEscrow({
        data: {
          escrowId: escrow.id,
          spec: escrow.spec,
          equivalence: escrow.equivalence,
          evidence: escrow.evidence.map((e) => ({ label: e.label, url: e.url, note: e.note })),
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      store.beginProposal(escrow.id, {
        verdict: result.verdict,
        reasoning: result.reasoning,
        splitBps: result.splitBps,
        source: result.source,
      });
      toast.message(result.source === "ai" ? "Leader proposal from the validator network" : "Local leader proposal");
      await sleep(700);
      store.commitSeats(escrow.id);
      await sleep(900);
      store.revealVotes(escrow.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjudication failed");
    } finally {
      setBusy(false);
    }
  }

  async function continueAppealReview() {
    setBusy(true);
    try {
      await sleep(500);
      store.commitSeats(escrow.id);
      await sleep(800);
      store.revealVotes(escrow.id);
    } finally {
      setBusy(false);
    }
  }

  async function payoutPath() {
    setBusy(true);
    try {
      store.finalize(escrow.id);
      await sleep(500);
      store.dispatchSettlement(escrow.id);
      await sleep(700);
      store.confirmPayout(escrow.id);
      toast.message("Settlement confirmed on the source chain");
    } finally {
      setBusy(false);
    }
  }

  function addEvidence() {
    if (!evidenceUrl.trim()) return;
    store.addEvidence(escrow.id, {
      submittedBy: "payee",
      label: "Submitted evidence",
      url: evidenceUrl.trim(),
      note: evidenceNote.trim(),
    });
    setEvidenceUrl("");
    setEvidenceNote("");
  }

  return (
    <div className="space-y-4">
      {(escrow.status === "locked" || escrow.status === "disputed") && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Open dispute and run adjudication</p>
          <p className="text-sm leading-relaxed text-muted">
            Funds stay in the {escrow.sourceChain} vault. GenLayer will only produce a verdict.
          </p>
          <Button onClick={runRound} disabled={busy}>
            {busy ? "Running round…" : escrow.rounds.length ? "Run next round" : "Run first round"}
          </Button>
        </div>
      )}

      {escrow.status === "proposing" && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Leader has proposed</p>
          <p className="text-sm text-muted">Committee now commits, then reveals. Models stay greyboxed until reveal.</p>
          <Button
            onClick={async () => {
              setBusy(true);
              store.commitSeats(escrow.id);
              await sleep(800);
              store.revealVotes(escrow.id);
              setBusy(false);
            }}
            disabled={busy}
          >
            {busy ? "Commit · reveal…" : "Commit and reveal"}
          </Button>
        </div>
      )}

      {escrow.status === "voting" && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Votes are committed</p>
          <p className="text-sm text-muted">Reveal the committee. Majority equivalent opens the appeal window.</p>
          <Button
            onClick={async () => {
              setBusy(true);
              await sleep(400);
              store.revealVotes(escrow.id);
              setBusy(false);
            }}
            disabled={busy}
          >
            {busy ? "Revealing…" : "Reveal votes"}
          </Button>
        </div>
      )}
      {escrow.status === "appealed" && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Appeal committee is seated</p>
          <p className="text-sm text-muted">Fresh validators re-evaluate the existing proposal. No new leader.</p>
          <Button onClick={continueAppealReview} disabled={busy}>
            {busy ? "Revealing…" : "Commit and reveal"}
          </Button>
        </div>
      )}

      {escrow.status === "optimistic" && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Appeal window</p>
          <p className="text-sm text-muted">
            Compressed to 90s in this console (about 30 minutes on the network). Successful appellants receive 2.5× bond.
          </p>
          <p className="font-display text-3xl tabular-nums tracking-tight text-fg">
            {windowClosed ? "Closed" : now ? formatRemaining(windowLeft ?? 0) : "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => store.fileAppeal(escrow.id)} disabled={busy || Boolean(windowClosed)}>
              File validator appeal
            </Button>
            <Button variant="outline" onClick={() => store.skipAppealWindow(escrow.id)} disabled={busy}>
              Close window
            </Button>
            {windowClosed ? (
              <Button onClick={payoutPath} disabled={busy}>
                Finalize and dispatch
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {escrow.status === "final" && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Verdict is final</p>
          <p className="text-sm text-muted">Post the external settlement message. The vault still has not moved funds.</p>
          <Button
            onClick={async () => {
              setBusy(true);
              store.dispatchSettlement(escrow.id);
              await sleep(600);
              store.confirmPayout(escrow.id);
              setBusy(false);
            }}
            disabled={busy}
          >
            Dispatch payout message
          </Button>
        </div>
      )}

      {escrow.status === "dispatching" && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Message posted</p>
          <Button onClick={() => store.confirmPayout(escrow.id)} disabled={busy}>
            Confirm source-chain receipt
          </Button>
        </div>
      )}

      {(escrow.status === "paid" || escrow.status === "refunded") && (
        <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Settled on the source chain</p>
          <p className="mt-1 text-sm text-muted">GenLayer’s work ended at finality. Custody never left the vault chain.</p>
        </div>
      )}

      {escrow.status === "locked" || escrow.status === "disputed" ? (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Attach evidence</p>
          <div className="space-y-2">
            <Label htmlFor="ev-url">URL</Label>
            <Input id="ev-url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-note">Note</Label>
            <Textarea id="ev-note" value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder="What the page shows" />
          </div>
          <Button variant="secondary" onClick={addEvidence} disabled={!evidenceUrl.trim()}>
            Add evidence
          </Button>
        </div>
      ) : null}
    </div>
  );
}
