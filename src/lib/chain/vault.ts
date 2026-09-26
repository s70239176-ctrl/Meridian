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

export async function getVaultEscrow(vault: Address, escrowId: Hash) {
  const [payer, payee, amount, status] = await arcPublicClient.readContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "escrows",
    args: [escrowId],
  });
  return { payer, payee, amount, status: VAULT_STATUS_LABEL[status] };
}
