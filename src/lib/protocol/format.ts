import {
  CHAIN_META,
  type Chain,
  type Escrow,
  type EscrowStatus,
  type Verdict,
} from "./types.ts";

export function shortAddr(addr: string, size = 4) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

export function formatAmount(amount: string, asset: string) {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${asset}`;
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: asset === "ETH" ? 2 : 0,
    maximumFractionDigits: asset === "ETH" ? 4 : 2,
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
    case "disputed":
      return "Dispute opened";
    case "proposing":
      return "Leader proposing";
    case "voting":
      return "Committee voting";
    case "optimistic":
      return "Optimistic · appeal window";
    case "appealed":
      return "Appeal in review";
    case "final":
      return "Final · awaiting dispatch";
    case "dispatching":
      return "Dispatching settlement";
    case "paid":
      return "Paid on source chain";
    case "refunded":
      return "Refunded on source chain";
  }
}

export function statusTone(status: EscrowStatus): "muted" | "live" | "warn" | "paid" | "danger" {
  switch (status) {
    case "locked":
      return "muted";
    case "disputed":
    case "proposing":
    case "voting":
    case "final":
    case "dispatching":
      return "live";
    case "optimistic":
    case "appealed":
      return "warn";
    case "paid":
      return "paid";
    case "refunded":
      return "danger";
  }
}

export function verdictLabel(verdict: Verdict, splitBps?: number) {
  if (verdict === "release_to_payee") return "Release to payee";
  if (verdict === "refund_to_payer") return "Refund to payer";
  return `Split ${((splitBps ?? 5000) / 100).toFixed(0)} / ${((10000 - (splitBps ?? 5000)) / 100).toFixed(0)}`;
}

export function verdictRecipient(escrow: Escrow, verdict: Verdict) {
  if (verdict === "refund_to_payer") return escrow.payer.address;
  return escrow.payee.address;
}

export function formatClock(ts: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(ts)) + " UTC";
}

export function formatRemaining(ms: number) {
  if (ms <= 0) return "Window closed";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m <= 0) return `${rem}s`;
  return `${m}m ${rem.toString().padStart(2, "0")}s`;
}

export function hashPreview(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `0x${(h >>> 0).toString(16).padStart(8, "0")}${(~h >>> 0).toString(16).padStart(8, "0")}${(h * 13 >>> 0).toString(16).padStart(8, "0")}${(h * 37 >>> 0).toString(16).padStart(8, "0")}`;
}

