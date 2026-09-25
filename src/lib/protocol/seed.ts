import { pickCommittee } from "./validators.ts";
import {
  DEMO_APPEAL_WINDOW_MS,
  type ConsensusRound,
  type Escrow,
  type Verdict,
} from "./types.ts";

const T0 = Date.UTC(2026, 8, 21, 9, 12, 0);

function round(opts: {
  escrowId: string;
  index: number;
  kind: ConsensusRound["kind"];
  size: number;
  verdict: Verdict;
  reasoning: string;
  startedAt: number;
  revealedAt?: number;
  dissentIndex?: number;
  dissentNote?: string;
  splitBps?: number;
}): ConsensusRound {
  const seats = pickCommittee(opts.escrowId, opts.index, opts.size).map((seat, i) => ({
    ...seat,
    committed: Boolean(opts.revealedAt),
    vote: opts.revealedAt
      ? {
          equivalent: i !== opts.dissentIndex,
          note:
            i === opts.dissentIndex
              ? (opts.dissentNote ?? "Output is not equivalent under the stated principle.")
              : "Equivalent in meaning. Accept leader proposal.",
        }
      : undefined,
  }));
  const yes = seats.filter((s) => s.vote?.equivalent).length;
  return {
    index: opts.index,
    kind: opts.kind,
    committeeSize: opts.size,
    leaderId: seats[0]!.id,
    proposedVerdict: opts.verdict,
    proposedReasoning: opts.reasoning,
    splitBps: opts.splitBps,
    seats,
    majorityEquivalent: opts.revealedAt ? yes * 2 > seats.length : null,
    startedAt: opts.startedAt,
    revealedAt: opts.revealedAt,
  };
}

export function buildSeed(): Escrow[] {
  const research: Escrow = {
    id: "MX-1841",
    title: "Northstar × Helix research SLA",
    domain: "Agentic commerce",
    spec: "Deliver a competitive brief on on-chain credit markets covering Aave, Morpho and Maple, with at least eight cited primary sources dated within 90 days. The delivery URL must be publicly readable without credentials.",
    equivalence: "Substantively complete briefs are equivalent even if pagination differs from twelve pages, provided unique primary sources ≥ 8 and all three protocols are treated in depth.",
    sourceChain: "ethereum",
    vaultAddress: "0x8f2a41c91d4b7e03a6c55e1d90b8d47c2a1e6f30",
    lockTx: "0x71c0e2aa91b4d8f03c55a1e90b847c2a1e6f304d9b2a41c91d4b7e03a6c55e1",
    asset: "USDC",
    amount: "12500",
    payer: { name: "Northstar Procurement", kind: "agent", address: "0x3a91c4e20d8b17f6a5c0e1d90b847c2a1e6f304d" },
    payee: { name: "Helix Research", kind: "agent", address: "0xb17f6a5c0e1d90b847c2a1e6f304d3a91c4e20d" },
    createdAt: T0,
    status: "optimistic",
    featured: true,
    appealWindowMs: DEMO_APPEAL_WINDOW_MS,
    optimisticAt: Date.now() - 18_000,
    evidence: [
      {
        id: "ev-1841-1",
        submittedBy: "payee",
        label: "Published brief",
        url: "https://helix.research/briefs/onchain-credit-2026",
        note: "Public HTML. Twelve sections, nine unique primary citations.",
        at: T0 + 36e5 * 8,
      },
      {
        id: "ev-1841-2",
        submittedBy: "payer",
        label: "Source audit",
        url: "https://northstar.agents/disputes/mx-1841/sources",
        note: "Claims one citation is a secondary recap, not a primary source.",
        at: T0 + 36e5 * 9,
      },
    ],
    rounds: [
      round({
        escrowId: "MX-1841",
        index: 0,
        kind: "initial",
        size: 5,
        verdict: "release_to_payee",
        reasoning:
          "The brief treats Aave, Morpho and Maple in depth and lists nine citations. Even if one source is recap-like, eight unique primaries remain. Equivalent under the stated principle.",
        startedAt: T0 + 36e5 * 10,
        revealedAt: T0 + 36e5 * 10 + 8 * 60_000,
        dissentIndex: 3,
        dissentNote: "Only seven unique primaries if the recap is excluded. Not equivalent.",
      }),
    ],
  };

  const flight: Escrow = {
    id: "MX-1902",
    title: "Parametric delay — UA 441",
    domain: "Insurance",
    spec: "Pay the policyholder if United flight UA 441 on 18 Sep 2026 arrives more than 180 minutes after scheduled arrival, as reported by a public flight-status source.",
    equivalence: "Arrival delay ≥ 180 minutes from any two independent public status pages is equivalent, even if the exact minute counts differ by ±5.",
    sourceChain: "base",
    vaultAddress: "0x21e6f304d8f2a41c91d4b7e03a6c55e1d90b847c",
    lockTx: "0x90b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d71c0e2aa91b4d8f03c55a1",
    asset: "USDC",
    amount: "840",
    payer: { name: "Harbor Cover", kind: "agent", address: "0x55e1d90b847c2a1e6f304d8f2a41c91d4b7e03a6" },
    payee: { name: "Passenger agent · M. Okonkwo", kind: "agent", address: "0x0b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d" },
    createdAt: T0 - 36e5 * 30,
    status: "paid",
    appealWindowMs: DEMO_APPEAL_WINDOW_MS,
    optimisticAt: T0 - 36e5 * 20,
    finalizedAt: T0 - 36e5 * 19,
    finalVerdict: "release_to_payee",
    evidence: [
      {
        id: "ev-1902-1",
        submittedBy: "payee",
        label: "FlightAware status",
        url: "https://flightaware.com/live/flight/UAL441",
        note: "Reported arrival 214 minutes late.",
        at: T0 - 36e5 * 22,
      },
    ],
    rounds: [
      round({
        escrowId: "MX-1902",
        index: 0,
        kind: "initial",
        size: 5,
        verdict: "release_to_payee",
        reasoning: "Independent public pages agree UA 441 arrived more than three hours late. Equivalent.",
        startedAt: T0 - 36e5 * 21,
        revealedAt: T0 - 36e5 * 21 + 7 * 60_000,
      }),
    ],
    settlement: {
      id: "msg_1902_final",
      type: "meridian.settlement.v1",
      status: "confirmed",
      from: "genlayer",
      toChain: "base",
      vault: "0x21e6f304d8f2a41c91d4b7e03a6c55e1d90b847c",
      payload: {
        escrowId: "MX-1902",
        verdict: "release_to_payee",
        amount: "840",
        asset: "USDC",
        recipient: "0x0b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d",
        finalityHash: "0x9c1e44a0b7d28f1c6a55e03d90b847c2a1e6f304",
        committeeRoot: "0x4b7e03a6c55e1d90b847c2a1e6f304d8f2a41c91",
        appealRounds: 0,
        windowClosedAt: T0 - 36e5 * 19,
      },
      dispatchedAt: T0 - 36e5 * 19 + 40_000,
      confirmedAt: T0 - 36e5 * 19 + 92_000,
      sourceTx: "0x6c55e1d90b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d90b847c2a1e6f304",
    },
  };

  const design: Escrow = {
    id: "MX-1766",
    title: "Studio mark · milestone 2",
    domain: "Performance",
    spec: "Deliver a primary wordmark and a single-color lockup for ‘Foldline’, plus a 1200×630 usage sheet. Files must be vector. Revision round included.",
    equivalence: "A complete wordmark + lockup that is usable at 16px and 1200px is equivalent even if the usage sheet layout differs, provided both lockups are present as SVG.",
    sourceChain: "arbitrum",
    vaultAddress: "0xd4b7e03a6c55e1d90b847c2a1e6f304d8f2a41c9",
    lockTx: "0x03a6c55e1d90b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d90b847c2a1e6",
    asset: "USDC",
    amount: "4200",
    payer: { name: "Foldline", kind: "human", address: "0x91d4b7e03a6c55e1d90b847c2a1e6f304d8f2a41" },
    payee: { name: "Atelier Agent", kind: "agent", address: "0x7e03a6c55e1d90b847c2a1e6f304d8f2a41c91d4" },
    createdAt: T0 + 36e5 * 4,
    status: "locked",
    featured: true,
    appealWindowMs: DEMO_APPEAL_WINDOW_MS,
    evidence: [],
    rounds: [],
  };

  const pred: Escrow = {
    id: "MX-1888",
    title: "Did the FOMC cut on 17 Sep 2026?",
    domain: "Prediction market",
    spec: "Resolve YES if the Federal Open Market Committee announced a cut in the target federal funds rate at the 16–17 September 2026 meeting, as published on federalreserve.gov.",
    equivalence: "Any official FOMC statement or implementation note on federalreserve.gov that records a lower target range is equivalent, regardless of accompanying prose.",
    sourceChain: "ethereum",
    vaultAddress: "0xa6c55e1d90b847c2a1e6f304d8f2a41c91d4b7e0",
    lockTx: "0x1d90b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d90b847c2a1e6f304d8f2",
    asset: "USDC",
    amount: "50000",
    payer: { name: "Market YES pool", kind: "agent", address: "0x847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d90" },
    payee: { name: "Market NO pool", kind: "agent", address: "0x2a1e6f304d8f2a41c91d4b7e03a6c55e1d90b847" },
    createdAt: T0 + 36e5 * 12,
    status: "voting",
    appealWindowMs: DEMO_APPEAL_WINDOW_MS,
    evidence: [
      {
        id: "ev-1888-1",
        submittedBy: "observer",
        label: "FOMC statement",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260917a.htm",
        note: "Statement posted 17 Sep 2026, 14:00 ET.",
        at: T0 + 36e5 * 14,
      },
    ],
    rounds: [
      round({
        escrowId: "MX-1888",
        index: 0,
        kind: "initial",
        size: 5,
        verdict: "release_to_payee",
        reasoning: "The official statement records a 25 bp cut in the target range. Equivalence is satisfied.",
        startedAt: Date.now() - 25_000,
      }),
    ],
  };
  pred.rounds[0] = {
    ...pred.rounds[0]!,
    seats: pred.rounds[0]!.seats.map((s, i) => ({
      ...s,
      committed: i < 3,
      vote: undefined,
    })),
    majorityEquivalent: null,
    revealedAt: undefined,
  };

  const sla: Escrow = {
    id: "MX-1910",
    title: "Indexer API uptime SLA",
    domain: "Agent SLA",
    spec: "The indexer must maintain 99.9% successful JSON-RPC responses over the billing week. A successful response is HTTP 200 with a valid JSON body within 800ms.",
    equivalence: "Measured uptime within 5 basis points of 99.9% is equivalent. Brief incidents under 3 minutes do not break equivalence if weekly target still holds.",
    sourceChain: "optimism",
    vaultAddress: "0x5e1d90b847c2a1e6f304d8f2a41c91d4b7e03a6c",
    lockTx: "0xb847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d90b847c2a1e6f304d8f2a41c",
    asset: "USDT",
    amount: "2750",
    payer: { name: "Route Agent", kind: "agent", address: "0xf304d8f2a41c91d4b7e03a6c55e1d90b847c2a1e" },
    payee: { name: "Lumen Index", kind: "agent", address: "0x4d8f2a41c91d4b7e03a6c55e1d90b847c2a1e6f3" },
    createdAt: T0 - 36e5 * 6,
    status: "appealed",
    appealedAt: Date.now() - 40_000,
    appealWindowMs: DEMO_APPEAL_WINDOW_MS,
    optimisticAt: T0 - 36e5 * 2,
    evidence: [
      {
        id: "ev-1910-1",
        submittedBy: "payer",
        label: "Probe logs",
        url: "https://status.route.agent/probes/lumen-week36",
        note: "Weekly success 99.82%. Two incidents of 11 and 7 minutes.",
        at: T0 - 36e5 * 3,
      },
    ],
    rounds: [
      round({
        escrowId: "MX-1910",
        index: 0,
        kind: "initial",
        size: 5,
        verdict: "refund_to_payer",
        reasoning: "Measured success is 99.82%, 8 bp below target, and incidents exceed three minutes. Not equivalent.",
        startedAt: T0 - 36e5 * 3,
        revealedAt: T0 - 36e5 * 3 + 6 * 60_000,
        dissentIndex: 1,
        dissentNote: "Within 5 bp if rounding weekly averages. Equivalent.",
      }),
      round({
        escrowId: "MX-1910",
        index: 1,
        kind: "validator_appeal",
        size: 11,
        verdict: "refund_to_payer",
        reasoning: "Recheck of the original proposal. Weekly success is 99.82%. Equivalence principle is not met.",
        startedAt: Date.now() - 40_000,
      }),
    ],
  };
  sla.rounds[1] = {
    ...sla.rounds[1]!,
    seats: sla.rounds[1]!.seats.map((s, i) => ({
      ...s,
      committed: i < 7,
    })),
  };

  const grant: Escrow = {
    id: "MX-1720",
    title: "Retro funding · public goods week 12",
    domain: "Grants",
    spec: "Release if the team shipped a documented open-source indexer adapter used by at least one independent integrator in the evaluation window, with a public repo and a working README.",
    equivalence: "A public repo with a working adapter and one independent integration write-up is equivalent even if the integrator is a small team.",
    sourceChain: "ethereum",
    vaultAddress: "0xc91d4b7e03a6c55e1d90b847c2a1e6f304d8f2a4",
    lockTx: "0xe03a6c55e1d90b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d90b847c2a1e",
    asset: "USDC",
    amount: "18000",
    payer: { name: "Commons Council", kind: "human", address: "0x1c91d4b7e03a6c55e1d90b847c2a1e6f304d8f2a" },
    payee: { name: "Open Route Labs", kind: "human", address: "0x03a6c55e1d90b847c2a1e6f304d8f2a41c91d4b7" },
    createdAt: T0 - 36e5 * 80,
    status: "refunded",
    appealWindowMs: DEMO_APPEAL_WINDOW_MS,
    optimisticAt: T0 - 36e5 * 70,
    finalizedAt: T0 - 36e5 * 68,
    finalVerdict: "refund_to_payer",
    evidence: [
      {
        id: "ev-1720-1",
        submittedBy: "payee",
        label: "Repository",
        url: "https://github.com/openroute/adapter",
        note: "README present. No independent integrator cited.",
        at: T0 - 36e5 * 72,
      },
    ],
    rounds: [
      round({
        escrowId: "MX-1720",
        index: 0,
        kind: "initial",
        size: 5,
        verdict: "refund_to_payer",
        reasoning: "Public repo exists but no independent integrator is documented. Equivalence not met.",
        startedAt: T0 - 36e5 * 71,
        revealedAt: T0 - 36e5 * 71 + 5 * 60_000,
      }),
    ],
    settlement: {
      id: "msg_1720_final",
      type: "meridian.settlement.v1",
      status: "confirmed",
      from: "genlayer",
      toChain: "ethereum",
      vault: "0xc91d4b7e03a6c55e1d90b847c2a1e6f304d8f2a4",
      payload: {
        escrowId: "MX-1720",
        verdict: "refund_to_payer",
        amount: "18000",
        asset: "USDC",
        recipient: "0x1c91d4b7e03a6c55e1d90b847c2a1e6f304d8f2a",
        finalityHash: "0x2a41c91d4b7e03a6c55e1d90b847c2a1e6f304d8",
        committeeRoot: "0x90b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1",
        appealRounds: 0,
        windowClosedAt: T0 - 36e5 * 68,
      },
      dispatchedAt: T0 - 36e5 * 68 + 30_000,
      confirmedAt: T0 - 36e5 * 68 + 88_000,
      sourceTx: "0xf2a41c91d4b7e03a6c55e1d90b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1d",
    },
  };

  const x402: Escrow = {
    id: "MX-1930",
    title: "x402 indexer SLA · BNB vault",
    domain: "Agentic commerce",
    spec: "Client hits HTTP 402, funds lock in a BNB Chain vault. The indexer must return valid JSON within 800ms for billed calls in the window. GenLayer judges the SLA against live probe evidence; the vault pays only after a post-appeal verdict.",
    equivalence: "Weekly success within 5 bp of 99.5% is equivalent. Isolated slow calls under 3 seconds do not break equivalence if the weekly target holds.",
    sourceChain: "bnb",
    vaultAddress: "0x56a1c91d4b7e03a6c55e1d90b847c2a1e6f304d8",
    lockTx: "0xa1e6f304d8f2a41c91d4b7e03a6c55e1d90b847c2a1e6f304d8f2a41c91d4b7e",
    asset: "USDC",
    amount: "9600",
    payer: { name: "Route Agent", kind: "agent", address: "0x90b847c2a1e6f304d8f2a41c91d4b7e03a6c55e1" },
    payee: { name: "Aether Index", kind: "agent", address: "0xd8f2a41c91d4b7e03a6c55e1d90b847c2a1e6f30" },
    createdAt: T0 + 36e5 * 2,
    status: "locked",
    featured: true,
    appealWindowMs: DEMO_APPEAL_WINDOW_MS,
    evidence: [
      {
        id: "ev-1930-1",
        submittedBy: "payee",
        label: "Weekly probe summary",
        url: "https://status.aether.index/probes/week38",
        note: "99.61% success. P95 latency 420ms. One 90-second incident.",
        at: T0 + 36e5 * 6,
      },
    ],
    rounds: [],
  };

  return [research, x402, design, pred, sla, flight, grant];
}
