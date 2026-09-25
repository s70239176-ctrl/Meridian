/**
 * Bridge to the REAL, deployed GenLayer Intelligent Contracts
 * (contracts/meridian_adjudicator.py + contracts/settlement_outbox.py) on
 * Testnet Bradbury. This is separate from the client-side simulation in
 * store.ts — the simulation drives the rich committee/appeal UI instantly
 * with zero setup; this module lets you additionally *verify* any case
 * against the live contract, once deployed, and see the real on-chain
 * verdict and transaction hash.
 *
 * Configured only when all three env vars are present:
 *   VITE_MERIDIAN_ADJUDICATOR, VITE_MERIDIAN_OUTBOX  (deployed addresses)
 *   GENLAYER_DEPLOYER_KEY                            (server-only signer)
 *
 * Only `verifyEscrowOnGenlayer` (a createServerFn) is safe to import from
 * client components (e.g. genlayer-verify.tsx) — TanStack Start extracts its
 * handler into a server-only chunk at build time, so GENLAYER_DEPLOYER_KEY
 * never reaches the browser bundle, the same way adjudicate.ts's XAI_API_KEY
 * access never does. Do not call `verifyOnGenlayer` or `getClient` directly
 * from client code.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus, type CalldataEncodable, type Hash } from "genlayer-js/types";

export function isLiveGenlayerConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_MERIDIAN_ADJUDICATOR &&
      import.meta.env.VITE_MERIDIAN_OUTBOX &&
      process.env.GENLAYER_DEPLOYER_KEY,
  );
}

type Client = ReturnType<typeof createClient>;
let client: Client | null = null;

function getClient(): Client {
  const privateKey = process.env.GENLAYER_DEPLOYER_KEY;
  if (!privateKey) throw new Error("GENLAYER_DEPLOYER_KEY is not set");
  if (!client) {
    const account = createAccount(privateKey as `0x${string}`);
    client = createClient({ chain: testnetBradbury, account });
  }
  return client;
}

/**
 * Write, then poll until the network has decided the transaction. Returns the
 * finalized transaction (whose `txDataDecoded` carries the contract's return
 * value once decided) alongside its hash.
 */
async function writeAndWait(address: string, functionName: string, args: CalldataEncodable[]) {
  const c = getClient();
  const hash = (await c.writeContract({
    address: address as `0x${string}`,
    functionName,
    args,
    value: 0n,
  })) as Hash;
  const receipt = await c.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });
  if (receipt.statusName !== TransactionStatus.FINALIZED) {
    throw new Error(`GenLayer transaction did not finalize: ${receipt.statusName ?? "unknown status"}`);
  }
  return { hash, receipt };
}

function decodedReturnValue(receipt: Awaited<ReturnType<Client["waitForTransactionReceipt"]>>): string {
  const decoded = receipt.txDataDecoded as { calldata?: unknown; return?: unknown } | undefined;
  const value = decoded?.return ?? decoded?.calldata;
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export type OnChainVerification = {
  onChainEscrowId: string;
  createTx: string;
  adjudicateTx: string;
  verdict: string;
  explorerUrl: string;
};

/**
 * Actually create the escrow and adjudicate it on the deployed GenLayer
 * contract, using the same case facts shown in the simulated UI. Returns the
 * real on-chain escrow id, both transaction hashes, and the real verdict the
 * live leader/validator consensus produced.
 *
 * Note: genlayer-js's typed transaction receipt does not guarantee a decoded
 * return-value field across versions. If `decodedReturnValue` comes back
 * empty for create_escrow, this falls back to `get_escrow` reads are not
 * possible without an id — in that case the error surfaces to the UI rather
 * than silently guessing an id, so verify against
 * https://explorer-bradbury.genlayer.com/ if this happens.
 */
export async function verifyOnGenlayer(input: {
  payer: string;
  payee: string;
  sourceChainEip155: string;
  vault: string;
  asset: string;
  amount: string;
  spec: string;
  equivalence: string;
  evidenceUrls: string[];
}): Promise<OnChainVerification> {
  const adjudicator = import.meta.env.VITE_MERIDIAN_ADJUDICATOR;
  if (!adjudicator) throw new Error("VITE_MERIDIAN_ADJUDICATOR is not configured");
  if (input.evidenceUrls.length === 0) {
    throw new Error("At least one http(s) evidence URL is required for on-chain adjudication");
  }

  const created = await writeAndWait(adjudicator, "create_escrow", [
    input.payer,
    input.payee,
    input.sourceChainEip155,
    input.vault,
    input.asset,
    input.amount,
    input.spec,
    input.equivalence,
  ]);
  const onChainEscrowId = decodedReturnValue(created.receipt);
  if (!onChainEscrowId) {
    throw new Error(
      `create_escrow finalized (tx ${created.hash}) but its return value could not be decoded — check the transaction on https://explorer-bradbury.genlayer.com/tx/${created.hash}`,
    );
  }

  const adjudicated = await writeAndWait(adjudicator, "adjudicate", [
    onChainEscrowId,
    input.evidenceUrls.join("\n"),
  ]);
  const verdict = decodedReturnValue(adjudicated.receipt);

  return {
    onChainEscrowId,
    createTx: created.hash,
    adjudicateTx: adjudicated.hash,
    verdict: verdict || "(finalized — see explorer for the decoded verdict)",
    explorerUrl: `https://explorer-bradbury.genlayer.com/tx/${adjudicated.hash}`,
  };
}

const VerifyInput = z.object({
  payer: z.string(),
  payee: z.string(),
  sourceChainEip155: z.string(),
  vault: z.string(),
  asset: z.string(),
  amount: z.string(),
  spec: z.string().max(4000),
  equivalence: z.string().max(2000),
  evidenceUrls: z.array(z.string().max(500)).max(4),
});

export type VerifyOnGenlayerResult =
  | ({ ok: true } & OnChainVerification)
  | { ok: false; error: string };

/** Client-callable server function wrapping verifyOnGenlayer with a safe error boundary. */
export const verifyEscrowOnGenlayer = createServerFn({ method: "POST" })
  .validator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data }): Promise<VerifyOnGenlayerResult> => {
    if (!isLiveGenlayerConfigured()) {
      return { ok: false, error: "Live GenLayer testnet mode is not configured on this server." };
    }
    try {
      const result = await verifyOnGenlayer(data);
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
