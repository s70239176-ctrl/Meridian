import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deployment } from "@/lib/protocol/deployment";
import { verifyEscrowOnGenlayer, type VerifyOnGenlayerResult } from "@/lib/protocol/genlayer";
import { CHAIN_META, type Escrow } from "@/lib/protocol/types";

/**
 * Optional side panel: actually calls the deployed GenLayer Intelligent
 * Contract (contracts/meridian_adjudicator.py) with this case's real facts
 * and shows the real on-chain verdict. Independent of the simulated
 * committee/appeal flow above — this hits Testnet Bradbury for real, so it
 * only renders once VITE_MERIDIAN_ADJUDICATOR / VITE_MERIDIAN_OUTBOX are set
 * (see .env.example).
 */
export function GenlayerVerifyPanel({ escrow }: { escrow: Escrow }) {
  const { adjudicator, outbox } = deployment();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyOnGenlayerResult | null>(null);

  if (!adjudicator || !outbox) return null;

  const evidenceUrls = escrow.evidence
    .map((e) => e.url)
    .filter((u) => u.startsWith("http://") || u.startsWith("https://"));

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const outcome = await verifyEscrowOnGenlayer({
        data: {
          payer: escrow.payer.address,
          payee: escrow.payee.address,
          sourceChainEip155: CHAIN_META[escrow.sourceChain].eip155,
          vault: escrow.vaultAddress,
          asset: escrow.asset,
          amount: escrow.amount,
          spec: escrow.spec,
          equivalence: escrow.equivalence,
          evidenceUrls,
        },
      });
      setResult(outcome);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-fg/20 bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-sm text-fg">Verify on live GenLayer testnet</p>
      <p className="text-sm leading-relaxed text-muted">
        Calls the real deployed contract at {adjudicator.slice(0, 10)}… on Testnet Bradbury with
        this case's facts, and returns the genuine leader/validator consensus verdict — separate
        from the simulated committee above.
      </p>
      <Button
        variant="secondary"
        onClick={run}
        disabled={busy || evidenceUrls.length === 0}
        title={evidenceUrls.length === 0 ? "Add at least one http(s) evidence URL first" : undefined}
      >
        {busy ? "Calling GenLayer…" : "Verify on GenLayer"}
      </Button>
      {evidenceUrls.length === 0 ? (
        <p className="text-xs text-faint">Add an http(s) evidence URL above to enable this.</p>
      ) : null}
      {result && !result.ok ? <p className="text-sm text-red-400">{result.error}</p> : null}
      {result && result.ok ? (
        <div className="space-y-1 text-sm text-fg">
          <p>
            On-chain verdict: <span className="font-medium">{result.verdict}</span>
          </p>
          <p className="text-xs text-muted">Escrow #{result.onChainEscrowId} on the adjudicator contract</p>
          <a
            className="block break-all font-mono text-xs text-muted underline"
            href={result.explorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            {result.adjudicateTx}
          </a>
        </div>
      ) : null}
    </div>
  );
}
