import { CHAIN_META, type Chain, type EscrowStatus, type Verdict } from "./types.ts";

export function shortAddr(addr: string, size = 4) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

export function formatAmount(amount: string, asset: string) {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${asset}`;
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)} ${asset}`;
}

export function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function chainLabel(chain: Chain) {
  return CHAIN_META[chain].label;
}

export function statusLabel(status: EscrowStatus) {
  switch (status) {
    case "locked":
      return "Locked on source chain";
    case "adjudicating":
      return "Adjudicating on GenLayer";
    case "adjudicated":
      return "Verdict reached";
    case "relaying":
      return "Relaying settlement";
    case "settled":
      return "Settled on source chain";
  }
}

export function statusTone(status: EscrowStatus): "muted" | "live" | "warn" | "paid" | "danger" {
  switch (status) {
    case "locked":
      return "muted";
    case "adjudicating":
    case "relaying":
      return "live";
    case "adjudicated":
      return "warn";
    case "settled":
      return "paid";
  }
}

export function verdictLabel(verdict: Verdict, payeeBps?: number) {
  if (verdict === "release_to_payee") return "Release to payee";
  if (verdict === "refund_to_payer") return "Refund to payer";
  return `Split ${((payeeBps ?? 5000) / 100).toFixed(0)} / ${((10000 - (payeeBps ?? 5000)) / 100).toFixed(0)}`;
}

export function verdictRecipient(escrow: { payer: string; payee: string }, verdict: Verdict) {
  if (verdict === "refund_to_payer") return escrow.payer;
  return escrow.payee;
}

export function formatClock(ts: number) {
  return (
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(new Date(ts)) + " UTC"
  );
}
