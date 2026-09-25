import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hashPreview, verdictRecipient } from "./format.ts";
import { buildSeed } from "./seed.ts";
import {
  DEMO_APPEAL_WINDOW_MS,
  committeeSizeForRound,
  type Asset,
  type Chain,
  type Escrow,
  type Evidence,
  type SettlementMessage,
  type Verdict,
} from "./types.ts";
import { majorityEquivalent, pickCommittee } from "./validators.ts";

export type NewEscrowInput = {
  title: string;
  domain: string;
  spec: string;
  equivalence: string;
  sourceChain: Chain;
  asset: Asset;
  amount: string;
  payerName: string;
  payeeName: string;
  evidenceUrl?: string;
  evidenceNote?: string;
};

type Store = {
  escrows: Escrow[];
  hydrated: boolean;
  markHydrated: () => void;
  resetDemo: () => void;
  createEscrow: (input: NewEscrowInput) => string;
  addEvidence: (id: string, evidence: Omit<Evidence, "id" | "at">) => void;
  openDispute: (id: string) => void;
  beginProposal: (
    id: string,
    proposal: { verdict: Verdict; reasoning: string; splitBps?: number; source: "ai" | "local" },
  ) => void;
  commitSeats: (id: string) => void;
  revealVotes: (id: string) => void;
  fileAppeal: (id: string) => void;
  skipAppealWindow: (id: string) => void;
  finalize: (id: string) => void;
  dispatchSettlement: (id: string) => void;
  confirmPayout: (id: string) => void;
};

function nextId(existing: Escrow[]) {
  const nums = existing.map((e) => Number(e.id.replace("MX-", ""))).filter((n) => !Number.isNaN(n));
  const n = Math.max(1900, ...nums) + 1;
  return `MX-${n}`;
}

function fakeAddr(seed: string) {
  const h = hashPreview(seed).replace("0x", "");
  return `0x${(h + h).slice(0, 40)}`;
}

function fakeTx(seed: string) {
  const h = hashPreview(seed).replace("0x", "") + hashPreview(`${seed}:b`).replace("0x", "");
  return `0x${h.slice(0, 64)}`;
}

function patch(escrows: Escrow[], id: string, fn: (e: Escrow) => Escrow): Escrow[] {
  return escrows.map((e) => (e.id === id ? fn(structuredClone(e)) : e));
}

function latestRound(e: Escrow) {
  return e.rounds[e.rounds.length - 1];
}

function buildSettlement(e: Escrow, now: number): SettlementMessage {
  const verdict = e.finalVerdict ?? latestRound(e)?.proposedVerdict ?? "release_to_payee";
  return {
    id: `msg_${e.id.toLowerCase()}_final`,
    type: "meridian.settlement.v1",
    status: "queued",
    from: "genlayer",
    toChain: e.sourceChain,
    vault: e.vaultAddress,
    payload: {
      escrowId: e.id,
      verdict,
      splitBps: e.splitBps,
      amount: e.amount,
      asset: e.asset,
      recipient: verdictRecipient(e, verdict),
      finalityHash: hashPreview(`${e.id}:final:${now}`),
      committeeRoot: hashPreview(`${e.id}:committee:${e.rounds.length}`),
      appealRounds: Math.max(0, e.rounds.length - 1),
      windowClosedAt: now,
    },
    dispatchedAt: now,
  };
}

export const useEscrowStore = create<Store>()(
  persist(
    (set, get) => ({
      escrows: buildSeed(),
      hydrated: false,
      markHydrated: () => set({ hydrated: true }),
      resetDemo: () => set({ escrows: buildSeed() }),
      createEscrow: (input) => {
        const id = nextId(get().escrows);
        const now = Date.now();
        const escrow: Escrow = {
          id,
          title: input.title,
          domain: input.domain || "Custom",
          spec: input.spec,
          equivalence: input.equivalence,
          sourceChain: input.sourceChain,
          vaultAddress: fakeAddr(`vault:${id}`),
          lockTx: fakeTx(`lock:${id}`),
          asset: input.asset,
          amount: input.amount,
          payer: {
            name: input.payerName,
            kind: "agent",
            address: fakeAddr(`payer:${id}`),
          },
          payee: {
            name: input.payeeName,
            kind: "agent",
            address: fakeAddr(`payee:${id}`),
          },
          createdAt: now,
          status: "locked",
          appealWindowMs: DEMO_APPEAL_WINDOW_MS,
          evidence: input.evidenceUrl
            ? [
                {
                  id: `ev-${id}-1`,
                  submittedBy: "payee",
                  label: "Opening evidence",
                  url: input.evidenceUrl,
                  note: input.evidenceNote || "",
                  at: now,
                },
              ]
            : [],
          rounds: [],
        };
        set({ escrows: [escrow, ...get().escrows] });
        return id;
      },
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
      openDispute: (id) =>
        set({
          escrows: patch(get().escrows, id, (e) => {
            if (e.status !== "locked") return e;
            return { ...e, status: "disputed" };
          }),
        }),
      beginProposal: (id, proposal) =>
        set({
          escrows: patch(get().escrows, id, (e) => {
            const index = e.rounds.length;
            const size = committeeSizeForRound(index);
            const seats = pickCommittee(e.id, index, size);
            const kind = index === 0 ? "initial" : "leader_appeal";
            return {
              ...e,
              status: "proposing",
              rounds: [
                ...e.rounds,
                {
                  index,
                  kind,
                  committeeSize: size,
                  leaderId: seats[0]!.id,
                  proposedVerdict: proposal.verdict,
                  proposedReasoning: proposal.reasoning,
                  splitBps: proposal.splitBps,
                  seats,
                  majorityEquivalent: null,
                  startedAt: Date.now(),
                },
              ],
            };
          }),
        }),
      commitSeats: (id) =>
        set({
          escrows: patch(get().escrows, id, (e) => {
            const rounds = e.rounds.map((r, i) =>
              i === e.rounds.length - 1
                ? { ...r, seats: r.seats.map((s) => ({ ...s, committed: true })) }
                : r,
            );
            return { ...e, status: "voting", rounds };
          }),
        }),
      revealVotes: (id) =>
        set({
          escrows: patch(get().escrows, id, (e) => {
            const last = latestRound(e);
            if (!last) return e;
            const dissentAt = Math.abs(hashPreview(e.id).charCodeAt(4)) % last.seats.length;
            const seats = last.seats.map((s, i) => ({
              ...s,
              committed: true,
              vote: {
                equivalent: last.seats.length < 3 ? true : i !== dissentAt,
                note:
                  last.seats.length >= 3 && i === dissentAt
                    ? "Not equivalent under a strict reading of the principle."
                    : "Equivalent in meaning. Accept leader proposal.",
              },
            }));
            const majority = majorityEquivalent(seats);
            const round: typeof last = {
              ...last,
              seats,
              majorityEquivalent: majority,
              revealedAt: Date.now(),
            };
            const rounds = e.rounds.map((r, i) => (i === e.rounds.length - 1 ? round : r));
            if (majority) {
              return {
                ...e,
                status: "optimistic",
                optimisticAt: Date.now(),
                rounds,
              };
            }
            return { ...e, status: "disputed", rounds };
          }),
        }),
      fileAppeal: (id) =>
        set({
          escrows: patch(get().escrows, id, (e) => {
            if (e.status !== "optimistic") return e;
            const index = e.rounds.length;
            const size = committeeSizeForRound(index);
            const prev = latestRound(e);
            if (!prev) return e;
            const seats = pickCommittee(e.id, index, size);
            return {
              ...e,
              status: "appealed",
              appealedAt: Date.now(),
              rounds: [
                ...e.rounds,
                {
                  index,
                  kind: "validator_appeal",
                  committeeSize: size,
                  leaderId: prev.leaderId,
                  proposedVerdict: prev.proposedVerdict,
                  proposedReasoning: prev.proposedReasoning,
                  splitBps: prev.splitBps,
                  seats,
                  majorityEquivalent: null,
                  startedAt: Date.now(),
                },
              ],
            };
          }),
        }),
      skipAppealWindow: (id) =>
        set({
          escrows: patch(get().escrows, id, (e) => {
            if (e.status !== "optimistic") return e;
            return { ...e, optimisticAt: Date.now() - e.appealWindowMs - 1000 };
          }),
        }),
      finalize: (id) =>
        set({
          escrows: patch(get().escrows, id, (e) => {
            const last = latestRound(e);
            const verdict = last?.proposedVerdict ?? "release_to_payee";
            return {
              ...e,
              status: "final",
              finalizedAt: Date.now(),
              finalVerdict: verdict,
              splitBps: last?.splitBps,
            };
          }),
        }),
      dispatchSettlement: (id) =>
        set({
          escrows: patch(get().escrows, id, (e) => {
            const settlement = { ...buildSettlement(e, Date.now()), status: "posted" as const };
            return { ...e, status: "dispatching", settlement };
          }),
        }),
      confirmPayout: (id) =>
        set({
          escrows: patch(get().escrows, id, (e) => {
            if (!e.settlement) return e;
            const verdict = e.finalVerdict ?? "release_to_payee";
            const paidStatus = verdict === "refund_to_payer" ? "refunded" : "paid";
            return {
              ...e,
              status: paidStatus,
              settlement: {
                ...e.settlement,
                status: "confirmed",
                confirmedAt: Date.now(),
                sourceTx: fakeTx(`payout:${e.id}`),
              },
            };
          }),
        }),
    }),
    {
      name: "meridian-escrows-v2",
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
    .escrows.filter((e) => e.settlement)
    .map((e) => ({ escrow: e, message: e.settlement! }))
    .sort((a, b) => b.message.dispatchedAt - a.message.dispatchedAt);
}
