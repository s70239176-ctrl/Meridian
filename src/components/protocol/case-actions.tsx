import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adjudicateOnGenlayer, createEscrowOnGenlayer } from "@/lib/protocol/genlayer";
import { relaySettlement } from "@/lib/chain/relay";
import { useEscrowStore } from "@/lib/protocol/store";
import { CHAIN_META, type Escrow } from "@/lib/protocol/types";

export function CaseActions({ escrow }: { escrow: Escrow }) {
  const [busy, setBusy] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const store = useEscrowStore();

  const evidenceUrls = escrow.evidence
    .map((e) => e.url)
    .filter((u) => u.startsWith("http://") || u.startsWith("https://"));

  async function retryGenlayerRegistration() {
    setBusy(true);
    try {
      const created = await createEscrowOnGenlayer({
        data: {
          payer: escrow.payer,
          payee: escrow.payee,
          sourceChainEip155: CHAIN_META[escrow.sourceChain].eip155,
          vault: escrow.vaultAddress,
          asset: escrow.asset,
          amount: escrow.amount,
          spec: escrow.spec,
          equivalence: escrow.equivalence,
        },
      });
      if (!created.ok) {
        toast.error(created.error);
        return;
      }
      store.updateEscrow(escrow.id, { genlayerEscrowId: created.genlayerEscrowId, createTx: created.createTx });
      toast.message("Registered on GenLayer");
    } finally {
      setBusy(false);
    }
  }

  async function runAdjudication() {
    if (!escrow.genlayerEscrowId) {
      toast.error("This case was never registered on GenLayer — cannot adjudicate.");
      return;
    }
    if (evidenceUrls.length === 0) {
      toast.error("Add at least one http(s) evidence URL first.");
      return;
    }
    setBusy(true);
    store.updateEscrow(escrow.id, { status: "adjudicating" });
    try {
      const result = await adjudicateOnGenlayer({
        data: { genlayerEscrowId: escrow.genlayerEscrowId, evidenceUrls },
      });
      if (!result.ok) {
        toast.error(result.error);
        store.updateEscrow(escrow.id, { status: "locked" });
        return;
      }
      store.updateEscrow(escrow.id, {
        status: "adjudicated",
        verdict: result.verdict,
        adjudicateTx: result.adjudicateTx,
      });
      toast.message("Real verdict from GenLayer's leader/validator consensus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjudication failed");
      store.updateEscrow(escrow.id, { status: "locked" });
    } finally {
      setBusy(false);
    }
  }

  async function runRelay() {
    if (!escrow.genlayerEscrowId) return;
    setBusy(true);
    store.updateEscrow(escrow.id, { status: "relaying" });
    try {
      const result = await relaySettlement({
        data: { genlayerEscrowId: escrow.genlayerEscrowId, vaultEscrowId: escrow.vaultEscrowId },
      });
      if (!result.ok) {
        toast.error(result.error);
        store.updateEscrow(escrow.id, { status: "adjudicated" });
        return;
      }
      store.updateEscrow(escrow.id, {
        status: "settled",
        settleTx: result.settleTx,
        payeeBps: result.payeeBps,
      });
      toast.message("Vault settled for real on Arc Testnet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Relay failed");
      store.updateEscrow(escrow.id, { status: "adjudicated" });
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
      {escrow.status === "locked" && !escrow.genlayerEscrowId && (
        <div className="space-y-3 rounded-xl border border-dashed border-fg/20 bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Not registered on GenLayer yet</p>
          <p className="text-sm leading-relaxed text-muted">
            Funds are deposited, but the create_escrow call to GenLayer didn't complete. Retry it before adjudicating.
          </p>
          <Button onClick={retryGenlayerRegistration} disabled={busy}>
            {busy ? "Registering…" : "Register on GenLayer"}
          </Button>
        </div>
      )}

      {escrow.status === "locked" && escrow.genlayerEscrowId && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Run adjudication</p>
          <p className="text-sm leading-relaxed text-muted">
            Funds stay in the {escrow.sourceChain} vault. This calls the real deployed MeridianAdjudicator contract
            on GenLayer Studio — not a simulation.
          </p>
          <Button onClick={runAdjudication} disabled={busy || evidenceUrls.length === 0}>
            {busy ? "Calling GenLayer…" : "Run adjudication"}
          </Button>
          {evidenceUrls.length === 0 ? (
            <p className="text-xs text-faint">Add at least one http(s) evidence URL below first.</p>
          ) : null}
        </div>
      )}

      {escrow.status === "adjudicating" && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Adjudicating…</p>
          <p className="text-sm text-muted">
            GenLayer's leader is fetching evidence and prompting its model; validators are independently re-running
            the same check. This can take a moment.
          </p>
        </div>
      )}

      {escrow.status === "adjudicated" && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Verdict is final</p>
          <p className="text-sm text-muted">
            Relay the real settlement_outbox message to the vault — this is the only step that moves funds.
          </p>
          <Button onClick={runRelay} disabled={busy}>
            {busy ? "Relaying…" : "Relay settlement"}
          </Button>
        </div>
      )}

      {escrow.status === "relaying" && (
        <div className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Relaying…</p>
          <p className="text-sm text-muted">Submitting the verdict to Vault.sol on Arc Testnet.</p>
        </div>
      )}

      {escrow.status === "settled" && (
        <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Settled on the source chain</p>
          <p className="mt-1 text-sm text-muted">Funds have actually moved. GenLayer's work ended at finality.</p>
        </div>
      )}

      {escrow.status === "locked" ? (
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
