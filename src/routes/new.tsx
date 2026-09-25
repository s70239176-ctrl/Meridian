import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ADJUDICATOR_SOURCE, OUTBOX_SOURCE } from "@/lib/protocol/contract-source";
import { useEscrowStore } from "@/lib/protocol/store";
import { ASSETS, CHAINS, CHAIN_META, type Asset, type Chain } from "@/lib/protocol/types";

export const Route = createFileRoute("/new")({ component: NewEscrow });

function NewEscrow() {
  const navigate = useNavigate();
  const createEscrow = useEscrowStore((s) => s.createEscrow);
  const [title, setTitle] = useState("Agent deliverable · week 38");
  const [domain, setDomain] = useState("Agentic commerce");
  const [spec, setSpec] = useState(
    "Pay the research agent if the weekly brief is published at a public URL, covers the named protocols, and cites at least five primary sources from the last quarter.",
  );
  const [equivalence, setEquivalence] = useState(
    "A substantively complete brief is equivalent even if section order or page count differs, provided the named protocols are treated and unique primaries ≥ 5.",
  );
  const [chain, setChain] = useState<Chain>("ethereum");
  const [asset, setAsset] = useState<Asset>("USDC");
  const [amount, setAmount] = useState("7500");
  const [payerName, setPayerName] = useState("Northstar Procurement");
  const [payeeName, setPayeeName] = useState("Helix Research");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = createEscrow({
      title,
      domain,
      spec,
      equivalence,
      sourceChain: chain,
      asset,
      amount,
      payerName,
      payeeName,
      evidenceUrl: evidenceUrl || undefined,
      evidenceNote: evidenceNote || undefined,
    });
    void navigate({ to: "/escrows/$id", params: { id } });
  }

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">New vault</p>
        <h1 className="font-display mt-2 text-4xl tracking-tight text-fg">Lock on the source chain</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Funds stay in a vault on {CHAIN_META[chain].label}. The contracts on the right are the ones you deploy. This form does not deploy them.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payer">Payer</Label>
              <Input id="payer" value={payerName} onChange={(e) => setPayerName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payee">Payee</Label>
              <Input id="payee" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Chain</Label>
              <Select value={chain} onValueChange={(v) => setChain(v as Chain)}>
                <SelectTrigger aria-label="Source chain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHAIN_META[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Asset</Label>
              <Select value={asset} onValueChange={(v) => setAsset(v as Asset)}>
                <SelectTrigger aria-label="Asset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSETS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
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
          <Button type="submit" size="lg">
            Lock funds on {CHAIN_META[chain].label}
          </Button>
        </form>
      </div>

      <aside className="md:sticky md:top-24 md:self-start">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Deployable contracts</p>
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
