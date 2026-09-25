export const CHAINS = ["ethereum", "base", "arbitrum", "optimism", "bnb"] as const;
export type Chain = (typeof CHAINS)[number];

export const ASSETS = ["USDC", "USDT", "ETH"] as const;
export type Asset = (typeof ASSETS)[number];

export const STATUSES = [
  "locked",
  "disputed",
  "proposing",
  "voting",
  "optimistic",
  "appealed",
  "final",
  "dispatching",
  "paid",
  "refunded",
] as const;
export type EscrowStatus = (typeof STATUSES)[number];

export const VERDICTS = ["release_to_payee", "refund_to_payer", "split"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type Agent = {
  name: string;
  kind: "human" | "agent";
  address: string;
};

export type Evidence = {
  id: string;
  submittedBy: "payer" | "payee" | "observer";
  label: string;
  url: string;
  note: string;
  at: number;
};

export type ValidatorSeat = {
  id: string;
  label: string;
  stake: number;
  greyboxed: true;
  committed: boolean;
  vote?: {
    equivalent: boolean;
    note: string;
  };
};

export type ConsensusRound = {
  index: number;
  kind: "initial" | "validator_appeal" | "leader_appeal";
  committeeSize: number;
  leaderId: string;
  proposedVerdict: Verdict;
  proposedReasoning: string;
  splitBps?: number;
  seats: ValidatorSeat[];
  majorityEquivalent: boolean | null;
  startedAt: number;
  revealedAt?: number;
};

export type SettlementMessage = {
  id: string;
  type: "meridian.settlement.v1";
  status: "queued" | "posted" | "confirmed";
  from: "genlayer";
  toChain: Chain;
  vault: string;
  payload: {
    escrowId: string;
    verdict: Verdict;
    splitBps?: number;
    amount: string;
    asset: Asset;
    recipient: string;
    finalityHash: string;
    committeeRoot: string;
    appealRounds: number;
    windowClosedAt: number;
  };
  dispatchedAt: number;
  confirmedAt?: number;
  sourceTx?: string;
};

export type Escrow = {
  id: string;
  title: string;
  domain: string;
  spec: string;
  equivalence: string;
  sourceChain: Chain;
  vaultAddress: string;
  lockTx: string;
  asset: Asset;
  amount: string;
  payer: Agent;
  payee: Agent;
  createdAt: number;
  status: EscrowStatus;
  evidence: Evidence[];
  rounds: ConsensusRound[];
  appealWindowMs: number;
  optimisticAt?: number;
  appealedAt?: number;
  finalizedAt?: number;
  finalVerdict?: Verdict;
  splitBps?: number;
  settlement?: SettlementMessage;
  featured?: boolean;
};

export const FIRST_ROUND_SIZE = 5;
export const DEMO_APPEAL_WINDOW_MS = 90_000;

export function nextCommitteeSize(n: number) {
  return 2 * n + 1;
}

export function committeeSizeForRound(index: number) {
  let n = FIRST_ROUND_SIZE;
  for (let i = 0; i < index; i++) n = nextCommitteeSize(n);
  return n;
}

export const CHAIN_META: Record<
  Chain,
  { label: string; short: string; eip155: string; explorer: string }
> = {
  ethereum: { label: "Ethereum", short: "ETH", eip155: "eip155:1", explorer: "Etherscan" },
  base: { label: "Base", short: "BASE", eip155: "eip155:8453", explorer: "Basescan" },
  arbitrum: { label: "Arbitrum", short: "ARB", eip155: "eip155:42161", explorer: "Arbiscan" },
  optimism: { label: "Optimism", short: "OP", eip155: "eip155:10", explorer: "Optimistic Etherscan" },
  bnb: { label: "BNB Chain", short: "BNB", eip155: "eip155:56", explorer: "BscScan" },
};
