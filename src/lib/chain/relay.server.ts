/**
 * Server-only: reads the REAL settlement message GenLayer's outbox produced,
 * verifies it against the vault's own on-chain state, and only then submits
 * it to the REAL Vault.sol contract on Arc Testnet. This is the literal
 * "relayer" the contracts' own docstrings describe — the piece that turns a
 * GenLayer verdict into an actual on-chain payout. VAULT_RELAYER_KEY never
 * reaches the browser: this file is only ever called from relaySettlement's
 * createServerFn handler (src/lib/chain/relay.ts).
 */
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { arcPublicClient } from "./wallet.ts";
import { VAULT_ABI, VAULT_VERDICT, getVaultEscrow, usdcToNativeValue, verifyMessageAgainstVaultEscrow } from "./vault.ts";
import type { Verdict } from "../protocol/types.ts";

export function isRelayerConfigured(): boolean {
  return Boolean(process.env.VAULT_RELAYER_KEY && import.meta.env.VITE_VAULT_ADDRESS);
}

export async function relayVaultSettlement(input: {
  vaultEscrowId: `0x${string}`;
  verdict: Verdict;
  payeeBps: number;
  messageVault: string;
  messageAmount: string;
  messageRecipient: string;
}): Promise<{ settleTx: string }> {
  const relayerKey = process.env.VAULT_RELAYER_KEY;
  if (!relayerKey) throw new Error("VAULT_RELAYER_KEY is not set");
  const vault = import.meta.env.VITE_VAULT_ADDRESS;
  if (!vault) throw new Error("VITE_VAULT_ADDRESS is not configured");

  // Never sign a settle() call on the strength of the message alone — read
  // what's actually locked on-chain for this exact id and confirm the
  // message's payout-relevant fields (vault, amount, recipient) genuinely
  // describe that deposit. A mismatch here means this verdict does not
  // belong to this escrow, full stop.
  const escrow = await getVaultEscrow(vault as `0x${string}`, input.vaultEscrowId);
  const verification = verifyMessageAgainstVaultEscrow({
    escrow,
    configuredVault: vault,
    messageVault: input.messageVault,
    messageAmount: input.messageAmount,
    messageRecipient: input.messageRecipient,
  });
  if (!verification.ok) {
    throw new Error(`Refusing to settle: ${verification.error}`);
  }

  const relayer = privateKeyToAccount(relayerKey as `0x${string}`);
  const walletClient = createWalletClient({ chain: arcTestnet, transport: http(), account: relayer });

  const hash = await walletClient.writeContract({
    address: vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "settle",
    // expectedAmount is re-checked by the contract itself — a second,
    // independent guard beyond the off-chain verification above.
    args: [input.vaultEscrowId, VAULT_VERDICT[input.verdict], input.payeeBps, usdcToNativeValue(input.messageAmount)],
    chain: arcTestnet,
    account: relayer,
  });
  const receipt = await arcPublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`settle() reverted (tx ${hash})`);
  return { settleTx: hash };
}
