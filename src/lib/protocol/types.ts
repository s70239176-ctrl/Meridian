export const CHAINS = ["arc"] as const;
export type Chain = (typeof CHAINS)[number];

export const ASSET = "USDC";

export const STATUSES = [
  "locked",
  "adjudicating",
  "adjudicated",
  "relaying",
  "settled",
] as const;
export type EscrowStatus = (typeof STATUSES)[number];

export const VERDICTS = ["release_to_payee", "refund_to_payer", "split"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type Evidence = {
  id: string;
  submittedBy: "payer" | "payee" | "observer";
  label: string;
  url: string;
  note: string;
  at: number;
};

/**
 * A real cross-chain escrow: real funds locked in `vaultAddress` on
 * `sourceChain` (Arc Testnet), a real case on GenLayer's deployed
 * MeridianAdjudicator, and — once adjudicated — a real settlement relayed
 * back to the vault. Every *Tx field is a real transaction hash; there is no
 * simulated or fabricated state here.
 */
export type Escrow = {
  id: string;
  title: string;
  domain: string;
  spec: string;
  equivalence: string;
  sourceChain: Chain;
  vaultAddress: string;
  // The ONE canonical case id, shared by the vault deposit and the GenLayer
  // case (bytes32, keccak256(id)) — not two independently-tracked ids. This
  // is what lets the relayer trust that a GenLayer verdict for this id
  // genuinely belongs to this exact vault deposit, by construction rather
  // than by a client-side mapping. See contracts/meridian_adjudicator.py's
  // create_escrow docstring and src/lib/chain/vault.ts's
  // verifyMessageAgainstVaultEscrow.
  onChainId: string;
  asset: string;
  amount: string; // decimal USDC string, as entered
  payer: string; // connected wallet address that deposited
  payee: string; // address the payee will receive at
  createdAt: number;
  lockTx: string; // real Vault.deposit() tx hash
  evidence: Evidence[];
  status: EscrowStatus;
  registeredOnGenlayer: boolean; // false only if create_escrow failed after a successful deposit
  createTx?: string; // real MeridianAdjudicator.create_escrow() tx hash
  adjudicateTx?: string; // real MeridianAdjudicator.adjudicate() tx hash
  verdict?: Verdict;
  payeeBps?: number;
  reasoning?: string;
  settleTx?: string; // real Vault.settle() tx hash, submitted by the relayer
};

export const CHAIN_META: Record<
  Chain,
  { label: string; short: string; eip155: string; explorer: string }
> = {
  arc: { label: "Arc Testnet", short: "ARC", eip155: "eip155:5042002", explorer: "ArcScan" },
};
