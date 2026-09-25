import { CHAIN_META, type Chain, type Escrow } from "./types.ts";

export type ChainVault = {
  chain: Chain;
  label: string;
  vaults: number;
  locked: number;
  settled: number;
  messages: number;
};

export function chainVaults(escrows: Escrow[]): ChainVault[] {
  const map = new Map<Chain, ChainVault>();
  for (const chain of Object.keys(CHAIN_META) as Chain[]) {
    map.set(chain, {
      chain,
      label: CHAIN_META[chain].label,
      vaults: 0,
      locked: 0,
      settled: 0,
      messages: 0,
    });
  }
  for (const e of escrows) {
    const row = map.get(e.sourceChain);
    if (!row) continue;
    row.vaults += 1;
    const n = Number(e.amount) || 0;
    if (e.status === "paid" || e.status === "refunded") row.settled += n;
    else row.locked += n;
    if (e.settlement) row.messages += 1;
  }
  return [...map.values()].filter((r) => r.vaults > 0);
}

export function protocolStats(escrows: Escrow[]) {
  const vaults = chainVaults(escrows);
  const locked = vaults.reduce((s, v) => s + v.locked, 0);
  const settled = vaults.reduce((s, v) => s + v.settled, 0);
  const messages = escrows.filter((e) => e.settlement).length;
  const live = escrows.filter((e) =>
    ["disputed", "proposing", "voting", "optimistic", "appealed", "final", "dispatching"].includes(
      e.status,
    ),
  ).length;
  return {
    locked,
    settled,
    messages,
    live,
    cases: escrows.length,
    chains: vaults.length,
  };
}
