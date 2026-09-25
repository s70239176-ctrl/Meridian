import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EscrowRow } from "@/components/protocol/escrow-row";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEscrowStore } from "@/lib/protocol/store";
import type { EscrowStatus } from "@/lib/protocol/types";

export const Route = createFileRoute("/escrows/")({ component: EscrowsPage });

const FILTERS: { id: "all" | "active" | "window" | "settled"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "In adjudication" },
  { id: "window", label: "Appeal window" },
  { id: "settled", label: "Settled" },
];

const ACTIVE: EscrowStatus[] = ["disputed", "proposing", "voting", "appealed"];
const WINDOW: EscrowStatus[] = ["optimistic", "final", "dispatching"];
const SETTLED: EscrowStatus[] = ["paid", "refunded"];

function EscrowsPage() {
  const escrows = useEscrowStore((s) => s.escrows);
  const resetDemo = useEscrowStore((s) => s.resetDemo);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const visible = useMemo(() => {
    return escrows.filter((e) => {
      if (filter === "all") return true;
      if (filter === "active") return ACTIVE.includes(e.status) || e.status === "locked";
      if (filter === "window") return WINDOW.includes(e.status);
      return SETTLED.includes(e.status);
    });
  }, [escrows, filter]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Docket</p>
          <h1 className="font-display mt-2 text-4xl tracking-tight text-fg">Open escrows</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Each row is a vault on another chain plus a GenLayer case. Custody and judgment stay split.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/new">Open a vault</Link>
          </Button>
          <Button variant="ghost" onClick={resetDemo}>
            Reset demo
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mt-8">
        <TabsList className="flex w-full flex-wrap justify-start overflow-x-auto sm:w-auto">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.id} value={f.id}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-5 space-y-2">
        {visible.length === 0 ? (
          <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-[var(--shadow-border)]">
            No cases in this view.
          </p>
        ) : (
          visible.map((escrow) => <EscrowRow key={escrow.id} escrow={escrow} />)
        )}
      </div>
    </div>
  );
}
