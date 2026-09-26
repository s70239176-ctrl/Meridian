import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Escrow, Evidence } from "./types.ts";

/**
 * A thin local index of cases this browser has created — NOT the source of
 * truth. Every field beyond the pointer (id/vaultEscrowId/genlayerEscrowId)
 * is populated from real reads (Vault.sol, MeridianAdjudicator.get_escrow,
 * SettlementOutbox.get_message) and real transaction results, never
 * fabricated here. Losing this list loses the ability to easily find your
 * own past cases in this browser — it does not affect funds or verdicts,
 * which live on-chain and on GenLayer regardless.
 */
type Store = {
  escrows: Escrow[];
  hydrated: boolean;
  markHydrated: () => void;
  clearLocalCases: () => void;
  addEscrow: (escrow: Escrow) => void;
  updateEscrow: (id: string, patch: Partial<Escrow>) => void;
  addEvidence: (id: string, evidence: Omit<Evidence, "id" | "at">) => void;
};

function patch(escrows: Escrow[], id: string, fn: (e: Escrow) => Escrow): Escrow[] {
  return escrows.map((e) => (e.id === id ? fn(e) : e));
}

export const useEscrowStore = create<Store>()(
  persist(
    (set, get) => ({
      escrows: [],
      hydrated: false,
      markHydrated: () => set({ hydrated: true }),
      clearLocalCases: () => set({ escrows: [] }),
      addEscrow: (escrow) => set({ escrows: [escrow, ...get().escrows] }),
      updateEscrow: (id, delta) =>
        set({ escrows: patch(get().escrows, id, (e) => ({ ...e, ...delta })) }),
      addEvidence: (id, evidence) =>
        set({
          escrows: patch(get().escrows, id, (e) => ({
            ...e,
            evidence: [
              ...e.evidence,
              { ...evidence, id: `ev-${id}-${e.evidence.length + 1}`, at: Date.now() },
            ],
          })),
        }),
    }),
    {
      name: "meridian-escrows-v3",
      partialize: (s) => ({ escrows: s.escrows }),
      skipHydration: true,
    },
  ),
);

export function getEscrow(id: string) {
  return useEscrowStore.getState().escrows.find((e) => e.id === id);
}

export function allSettlements() {
  return useEscrowStore
    .getState()
    .escrows.filter((e) => e.verdict)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}
