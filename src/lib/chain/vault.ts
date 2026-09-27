import { keccak256, parseUnits, toBytes, type Address, type Hash } from "viem";
import type { createWalletClient } from "viem";
import { arcPublicClient } from "./wallet.ts";

/** Matches contracts/Vault.sol exactly. */
export const VAULT_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "_relayer", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "escrowId", type: "bytes32" },
      { name: "payee", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [
      { name: "escrowId", type: "bytes32" },
      { name: "verdict", type: "uint8" },
      { name: "payeeBps", type: "uint16" },
      { name: "expectedAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "escrows",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "payer", type: "address" },
      { name: "payee", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "relayer",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "escrowId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "escrowId", type: "bytes32", indexed: true },
      { name: "verdict", type: "uint8", indexed: false },
      { name: "payeeBps", type: "uint16", indexed: false },
      { name: "payeeAmount", type: "uint256", indexed: false },
      { name: "payerAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

/** Mirrors Vault.sol's `enum Verdict`. Order matters — do not reorder. */
export const VAULT_VERDICT = {
  release_to_payee: 0,
  refund_to_payer: 1,
  split: 2,
} as const;

export const VAULT_STATUS_LABEL = ["none", "locked", "settled"] as const;

/** Deterministic on-chain escrow id from a client-generated case id. */
export function vaultEscrowId(caseId: string): Hash {
  return keccak256(toBytes(caseId));
}

/**
 * Arc's native balance (what msg.value means) is USDC accounted with 18
 * decimals — ether-style — NOT the 6 decimals its separate ERC-20 view uses.
 * See github.com/circlefin/arc-node issues #95 and #453.
 */
export function usdcToNativeValue(amount: string): bigint {
  return parseUnits(amount, 18);
}

export async function depositToVault(
  walletClient: ReturnType<typeof createWalletClient>,
  vault: Address,
  args: { escrowId: Hash; payee: Address; amountUsdc: string },
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [args.escrowId, args.payee],
    value: usdcToNativeValue(args.amountUsdc),
    chain: walletClient.chain,
    account: walletClient.account!,
  });
  return hash;
}

export type VaultEscrowRecord = {
  payer: string;
  payee: string;
  amount: bigint;
  status: (typeof VAULT_STATUS_LABEL)[number];
};

export async function getVaultEscrow(vault: Address, escrowId: Hash): Promise<VaultEscrowRecord> {
  const [payer, payee, amount, status] = await arcPublicClient.readContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "escrows",
    args: [escrowId],
  });
  return { payer, payee, amount, status: VAULT_STATUS_LABEL[status] };
}

/**
 * Cross-check a GenLayer settlement message against the vault's own on-chain
 * escrow record BEFORE ever signing a settle() transaction. This is the
 * actual enforcement point for "one canonical id": even though create_escrow
 * and deposit() now share the same id by construction, this function is
 * defense-in-depth against any bug that fetches the right message but the
 * wrong escrow (or vice versa) — a mismatch here means the verdict does NOT
 * belong to this specific locked deposit, and must never be applied to it.
 * Pure — no network calls — so it's directly unit-testable.
 */
export function verifyMessageAgainstVaultEscrow(input: {
  escrow: VaultEscrowRecord;
  configuredVault: string;
  messageVault: string;
  messageAmount: string;
  messageRecipient: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.escrow.status !== "locked") {
    return { ok: false, error: `escrow is not locked on-chain (status: ${input.escrow.status}) — already settled or never deposited` };
  }
  if (input.messageVault.toLowerCase() !== input.configuredVault.toLowerCase()) {
    return { ok: false, error: "message's vault address does not match the vault this relayer is configured for" };
  }
  let expectedAmount: bigint;
  try {
    expectedAmount = usdcToNativeValue(input.messageAmount);
  } catch {
    return { ok: false, error: `message amount "${input.messageAmount}" is not a valid decimal amount` };
  }
  if (expectedAmount !== input.escrow.amount) {
    return {
      ok: false,
      error: `message amount (${input.messageAmount} USDC) does not match the amount actually locked for this escrow — refusing to settle a mismatched escrow`,
    };
  }
  const recipient = input.messageRecipient.toLowerCase();
  if (recipient !== input.escrow.payer.toLowerCase() && recipient !== input.escrow.payee.toLowerCase()) {
    return { ok: false, error: "message recipient is neither this escrow's payer nor payee" };
  }
  return { ok: true };
}
