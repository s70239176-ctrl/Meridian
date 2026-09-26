import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ADJUDICATOR_SOURCE, OUTBOX_SOURCE } from "@/lib/protocol/contract-source";
import { createEscrowOnGenlayer } from "@/lib/protocol/genlayer";
import { deployment } from "@/lib/protocol/deployment";
import { useEscrowStore } from "@/lib/protocol/store";
import { CHAIN_META } from "@/lib/protocol/types";
import { connectWallet, arcPublicClient, type ConnectedWallet } from "@/lib/chain/wallet";
import { depositToVault, vaultEscrowId } from "@/lib/chain/vault";
import { shortAddr } from "@/lib/protocol/format";

export const Route = createFileRoute("/new")({ component: NewEscrow });

function NewEscrow() {
  const navigate = useNavigate();
  const addEscrow = useEscrowStore((s) => s.addEscrow);
  const { vault } = deployment();

  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "depositing" | "registering">("idle");

  const [title, setTitle] = useState("Agent deliverable · week 38");
  const [domain, setDomain] = useState("Agentic commerce");
  const [spec, setSpec] = useState(
    "Pay the research agent if the weekly brief is published at a public URL, covers the named protocols, and cites at least five primary sources from the last quarter.",
  );
  const [equivalence, setEquivalence] = useState(
    "A substantively complete brief is equivalent even if section order or page count differs, provided the named protocols are treated and unique primaries ≥ 5.",
  );
  const [amount, setAmount] = useState("1");
  const [payee, setPayee] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");

  async function onConnect() {
    setConnecting(true);
    try {
      const connected = await connectWallet();
      setWallet(connected);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect wallet");
    } finally {
      setConnecting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wallet) {
      toast.error("Connect your wallet first.");
      return;
    }
    if (!vault) {
      toast.error("VITE_VAULT_ADDRESS is not configured — deploy Vault.sol first (see README).");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(payee)) {
      toast.error("Payee must be a valid 0x address.");
      return;
    }

    setSubmitting(true);
    const caseId = crypto.randomUUID();
    const onChainEscrowId = vaultEscrowId(caseId);

    try {
      setStep("depositing");
      const depositTx = await depositToVault(wallet.walletClient, vault as `0x${string}`, {
        escrowId: onChainEscrowId,
        payee: payee as `0x${string}`,
        amountUsdc: amount,
      });
      await arcPublicClient.waitForTransactionReceipt({ hash: depositTx });
      toast.message("Real deposit confirmed on Arc Testnet");

      setStep("registering");
      const created = await createEscrowOnGenlayer({
        data: {
          payer: wallet.address,
          payee,
          sourceChainEip155: CHAIN_META.arc.eip155,
          vault,
          asset: "USDC",
          amount,
          spec,
          equivalence,
        },
      });

      addEscrow({
        id: caseId,
        title,
        domain: domain || "Custom",
        spec,
        equivalence,
        sourceChain: "arc",
        vaultAddress: vault,
        vaultEscrowId: onChainEscrowId,
        asset: "USDC",
        amount,
        payer: wallet.address,
        payee,
        createdAt: Date.now(),
        lockTx: depositTx,
        evidence: evidenceUrl
          ? [{ id: `ev-${caseId}-1`, submittedBy: "payee", label: "Opening evidence", url: evidenceUrl, note: evidenceNote, at: Date.now() }]
          : [],
        status: "locked",
        genlayerEscrowId: created.ok ? created.genlayerEscrowId : undefined,
        createTx: created.ok ? created.createTx : undefined,
      });

      if (!created.ok) {
        toast.error(`Deposit succeeded, but GenLayer registration failed: ${created.error}. You can retry from the case page.`);
      }

      void navigate({ to: "/escrows/$id", params: { id: caseId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create escrow");
    } finally {
      setSubmitting(false);
      setStep("idle");
    }
  }

  if (!vault) {
    return (
      <div className="max-w-xl">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">New vault</p>
        <h1 className="font-display mt-2 text-4xl tracking-tight text-fg">Vault not deployed</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          VITE_VAULT_ADDRESS is not set. Run <code className="font-mono">node scripts/deploy-vault.mjs</code> to
          deploy Vault.sol to Arc Testnet, then put the resulting address in your .env. See README.md.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">New vault</p>
        <h1 className="font-display mt-2 text-4xl tracking-tight text-fg">Lock real funds on Arc Testnet</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          This deposits real testnet USDC into the deployed Vault.sol contract, then registers the case on the real
          GenLayer MeridianAdjudicator. Nothing here is simulated.
        </p>

        <div className="mt-6">
          {wallet ? (
            <p className="text-sm text-fg">Connected: <span className="font-mono">{shortAddr(wallet.address, 6)}</span></p>
          ) : (
            <Button type="button" onClick={onConnect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payee">Payee address</Label>
            <Input id="payee" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="0x..." required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USDC, native on Arc)</Label>
            <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spec">Natural-language spec</Label>
            <Textarea id="spec" value={spec} onChange={(e) => setSpec(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eq">Equivalence principle</Label>
            <Textarea id="eq" value={equivalence} onChange={(e) => setEquivalence(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eurl">Evidence URL (optional)</Label>
            <Input id="eurl" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enote">Evidence note</Label>
            <Textarea id="enote" value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} />
          </div>
          <Button type="submit" size="lg" disabled={!wallet || submitting}>
            {step === "depositing" ? "Depositing…" : step === "registering" ? "Registering on GenLayer…" : "Lock funds on Arc Testnet"}
          </Button>
        </form>
      </div>

      <aside className="md:sticky md:top-24 md:self-start">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Deployed contracts</p>
        <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl bg-surface p-4 font-mono text-xs leading-relaxed text-muted shadow-[var(--shadow-border)]">
          {ADJUDICATOR_SOURCE}
        </pre>
        <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-surface p-4 font-mono text-xs leading-relaxed text-muted shadow-[var(--shadow-border)]">
          {OUTBOX_SOURCE}
        </pre>
      </aside>
    </div>
  );
}
