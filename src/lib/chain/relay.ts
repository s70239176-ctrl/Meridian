import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getOutboxMessage } from "../protocol/genlayer.ts";
import { relayVaultSettlement, isRelayerConfigured } from "./relay.server.ts";
import { arcExplorerTxUrl } from "./explorer.ts";
import type { Verdict } from "../protocol/types.ts";

const RelayInput = z.object({
  genlayerEscrowId: z.string(),
  vaultEscrowId: z.string(),
});

export type RelaySettlementResult =
  | { ok: true; settleTx: string; verdict: Verdict; payeeBps: number; explorerUrl: string }
  | { ok: false; error: string };

/** Client-callable: relay the real GenLayer verdict to the real vault. */
export const relaySettlement = createServerFn({ method: "POST" })
  .validator((input: unknown) => RelayInput.parse(input))
  .handler(async ({ data }): Promise<RelaySettlementResult> => {
    if (!isRelayerConfigured()) {
      return { ok: false, error: "Relayer is not configured (VAULT_RELAYER_KEY / VITE_VAULT_ADDRESS)." };
    }
    try {
      const message = await getOutboxMessage({ data: { genlayerEscrowId: data.genlayerEscrowId } });
      if (!message.ok) return { ok: false, error: message.error };
      if (!message.hasMessage) {
        return { ok: false, error: "No finalized settlement message yet — adjudicate first and wait for finality." };
      }
      const verdict = message.record.verdict;
      if (verdict !== "release_to_payee" && verdict !== "refund_to_payer" && verdict !== "split") {
        return { ok: false, error: `Outbox message has an unrecognized verdict: ${verdict}` };
      }
      const payeeBps = Number(message.record.payee_bps ?? "0");

      const { settleTx } = await relayVaultSettlement({
        vaultEscrowId: data.vaultEscrowId as `0x${string}`,
        verdict,
        payeeBps,
      });

      return { ok: true, settleTx, verdict, payeeBps, explorerUrl: arcExplorerTxUrl(settleTx) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
