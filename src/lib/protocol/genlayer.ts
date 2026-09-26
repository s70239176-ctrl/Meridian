/**
 * Bridge to the REAL, deployed GenLayer Intelligent Contracts
 * (contracts/meridian_adjudicator.py + contracts/settlement_outbox.py) on
 * GenLayer Studio (studionet — GenLayer's stable hosted network, chain id
 * 61999, https://studio.genlayer.com/api). Studio is gasless: a 0 GEN
 * balance is expected and does not block deploys or writes, so there is no
 * faucet step for this side. Every escrow in this app goes through these
 * real calls — there is no local/simulated adjudication fallback.
 *
 * Configured when both are present:
 *   VITE_MERIDIAN_ADJUDICATOR, VITE_MERIDIAN_OUTBOX  (deployed addresses)
 *   GENLAYER_DEPLOYER_KEY                            (server-only signer —
 *                                                      still needed to sign
 *                                                      writes even though
 *                                                      Studio is gasless)
 *
 * Only the exported `createServerFn`s are safe to import from client
 * components — TanStack Start extracts each handler into a server-only
 * chunk at build time, so GENLAYER_DEPLOYER_KEY never reaches the browser
 * bundle. Do not call `getClient` or the raw read/write helpers from client
 * code.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { abi, createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, type CalldataEncodable, type Hash } from "genlayer-js/types";
import { genlayerExplorerTxUrl } from "./genlayer-explorer.ts";
import type { Verdict } from "./types.ts";

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
    client = createClient({ chain: studionet, account });
  }
  return client;
}

function requireAddress(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

/** Statuses that mean the transaction is truly done for and will never reach FINALIZED. */
const TERMINAL_FAILURE_STATUSES = new Set<TransactionStatus>([
  TransactionStatus.CANCELED,
  TransactionStatus.UNDETERMINED,
  TransactionStatus.VALIDATORS_TIMEOUT,
  TransactionStatus.LEADER_TIMEOUT,
]);

/**
 * Write, then poll until the network actually reaches FINALIZED — not just
 * ACCEPTED (the optimistic pre-appeal-window state). SettlementOutbox.record
 * is only called once the adjudicate transaction is past its appeal window,
 * so anything short of FINALIZED here is genuinely not done yet, not a
 * failure. Polls for up to ~10 minutes; only a real terminal status (a
 * canceled or timed-out round) fails fast.
 */
async function writeAndWait(address: string, functionName: string, args: CalldataEncodable[]) {
  const c = getClient();
  const hash = (await c.writeContract({
    address: address as `0x${string}`,
    functionName,
    args,
    value: 0n,
  })) as Hash;

  const intervalMs = 3000;
  const maxAttempts = 200; // ~10 minutes total
  let last: Awaited<ReturnType<Client["getTransaction"]>> | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await c.getTransaction({ hash });
    if (last.statusName === TransactionStatus.FINALIZED) {
      return { hash, receipt: last };
    }
    if (last.statusName && TERMINAL_FAILURE_STATUSES.has(last.statusName)) {
      throw new Error(
        `GenLayer transaction ended without finalizing (status: ${last.statusName}, tx ${hash}) — check ${genlayerExplorerTxUrl(hash)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `GenLayer transaction is still ${last?.statusName ?? "pending"} after ~10 minutes (tx ${hash}) — it may still finalize; check ${genlayerExplorerTxUrl(hash)}`,
  );
}

/**
 * Extract the real decoded return value from a finalized GenLayer Studio
 * transaction. On studionet, genlayer-js's own `getTransaction` runs the
 * result through `decodeLocalnetTransaction`, which leaves the leader's
 * actual return value at `consensus_data.leader_receipt[].result`, encoded
 * as `{ status: "return" | "rollback" | ..., payload: { raw: number[] } }`
 * (payload.raw is the un-decoded calldata bytes) — NOT at `txDataDecoded`,
 * which is only populated on the public testnets (Bradbury/Asimov).
 */
export function decodedReturnValue(receipt: unknown): string {
  const consensusData = (receipt as { consensus_data?: unknown } | undefined)?.consensus_data as
    | { leader_receipt?: unknown }
    | undefined;
  const leaderReceipt = consensusData?.leader_receipt;
  const entry = (Array.isArray(leaderReceipt) ? leaderReceipt[0] : leaderReceipt) as
    | { result?: { status?: string; payload?: { raw?: number[] } | string | null } }
    | undefined;
  const result = entry?.result;
  if (!result || result.status !== "return") return "";
  const payload = result.payload;
  const raw = payload && typeof payload === "object" ? payload.raw : undefined;
  if (!Array.isArray(raw)) return "";
  try {
    const decoded = abi.calldata.decode(Uint8Array.from(raw));
    if (decoded === null || decoded === undefined) return "";
    return String(decoded).trim();
  } catch {
    return "";
  }
}

/** Parse the `key=value` newline-delimited strings get_escrow/get_message return. */
export function parseKeyValueRecord(text: string): Record<string, string> {
  const record: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf("=");
    if (i === -1) continue;
    record[line.slice(0, i)] = line.slice(i + 1);
  }
  return record;
}

const CreateEscrowInput = z.object({
  payer: z.string(),
  payee: z.string(),
  sourceChainEip155: z.string(),
  vault: z.string(),
  asset: z.string(),
  amount: z.string(),
  spec: z.string().max(4000),
  equivalence: z.string().max(2000),
});

export type CreateEscrowResult =
  | { ok: true; genlayerEscrowId: string; createTx: string; explorerUrl: string }
  | { ok: false; error: string };

/** Real MeridianAdjudicator.create_escrow() call. */
export const createEscrowOnGenlayer = createServerFn({ method: "POST" })
  .validator((input: unknown) => CreateEscrowInput.parse(input))
  .handler(async ({ data }): Promise<CreateEscrowResult> => {
    try {
      const adjudicator = requireAddress("VITE_MERIDIAN_ADJUDICATOR", import.meta.env.VITE_MERIDIAN_ADJUDICATOR);
      const created = await writeAndWait(adjudicator, "create_escrow", [
        data.payer,
        data.payee,
        data.sourceChainEip155,
        data.vault,
        data.asset,
        data.amount,
        data.spec,
        data.equivalence,
      ]);
      const genlayerEscrowId = decodedReturnValue(created.receipt);
      if (!genlayerEscrowId) {
        throw new Error(
          `create_escrow finalized (tx ${created.hash}) but its return value could not be decoded — check ${genlayerExplorerTxUrl(created.hash)}`,
        );
      }
      return { ok: true, genlayerEscrowId, createTx: created.hash, explorerUrl: genlayerExplorerTxUrl(created.hash) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

const AdjudicateInput = z.object({
  genlayerEscrowId: z.string(),
  evidenceUrls: z.array(z.string().max(500)).min(1).max(4),
});

export type AdjudicateResult =
  | { ok: true; verdict: Verdict; adjudicateTx: string; explorerUrl: string }
  | { ok: false; error: string };

/** Real MeridianAdjudicator.adjudicate() call — the actual leader/validator consensus run. */
export const adjudicateOnGenlayer = createServerFn({ method: "POST" })
  .validator((input: unknown) => AdjudicateInput.parse(input))
  .handler(async ({ data }): Promise<AdjudicateResult> => {
    try {
      const adjudicator = requireAddress("VITE_MERIDIAN_ADJUDICATOR", import.meta.env.VITE_MERIDIAN_ADJUDICATOR);
      const adjudicated = await writeAndWait(adjudicator, "adjudicate", [
        data.genlayerEscrowId,
        data.evidenceUrls.join("\n"),
      ]);
      const verdict = decodedReturnValue(adjudicated.receipt);
      if (verdict !== "release_to_payee" && verdict !== "refund_to_payer" && verdict !== "split") {
        throw new Error(
          `adjudicate finalized (tx ${adjudicated.hash}) but returned an unrecognized verdict "${verdict}" — check ${genlayerExplorerTxUrl(adjudicated.hash)}`,
        );
      }
      return {
        ok: true,
        verdict,
        adjudicateTx: adjudicated.hash,
        explorerUrl: genlayerExplorerTxUrl(adjudicated.hash),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

const EscrowIdInput = z.object({ genlayerEscrowId: z.string() });

export type GetEscrowResult =
  | { ok: true; record: Record<string, string> }
  | { ok: false; error: string };

/** Read-only MeridianAdjudicator.get_escrow() — the real, current on-chain state. */
export const getEscrowOnGenlayer = createServerFn({ method: "GET" })
  .validator((input: unknown) => EscrowIdInput.parse(input))
  .handler(async ({ data }): Promise<GetEscrowResult> => {
    try {
      const adjudicator = requireAddress("VITE_MERIDIAN_ADJUDICATOR", import.meta.env.VITE_MERIDIAN_ADJUDICATOR);
      const c = getClient();
      const text = (await c.readContract({
        address: adjudicator as `0x${string}`,
        functionName: "get_escrow",
        args: [data.genlayerEscrowId],
      })) as string;
      if (!text) throw new Error("unknown escrow on GenLayer");
      return { ok: true, record: parseKeyValueRecord(text) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

export type GetOutboxMessageResult =
  | { ok: true; hasMessage: false }
  | { ok: true; hasMessage: true; record: Record<string, string> }
  | { ok: false; error: string };

/** Read-only SettlementOutbox.get_message() — the real payout instruction, once finalized. */
export const getOutboxMessage = createServerFn({ method: "GET" })
  .validator((input: unknown) => EscrowIdInput.parse(input))
  .handler(async ({ data }): Promise<GetOutboxMessageResult> => {
    try {
      const outbox = requireAddress("VITE_MERIDIAN_OUTBOX", import.meta.env.VITE_MERIDIAN_OUTBOX);
      const c = getClient();
      const text = (await c.readContract({
        address: outbox as `0x${string}`,
        functionName: "get_message",
        args: [data.genlayerEscrowId],
      })) as string;
      if (!text) return { ok: true, hasMessage: false };
      return { ok: true, hasMessage: true, record: parseKeyValueRecord(text) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
