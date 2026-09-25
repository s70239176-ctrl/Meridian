import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Verdict } from "./types.ts";

const Input = z.object({
  escrowId: z.string().max(32),
  spec: z.string().max(4000),
  equivalence: z.string().max(2000),
  evidence: z
    .array(
      z.object({
        label: z.string().max(200),
        url: z.string().max(500),
        note: z.string().max(1000),
      }),
    )
    .max(8),
});

export type AdjudicationResult =
  | {
      ok: true;
      source: "ai" | "local";
      verdict: Verdict;
      splitBps?: number;
      equivalent: boolean;
      reasoning: string;
    }
  | { ok: false; error: string };

export function localAdjudicate(data: z.infer<typeof Input>): AdjudicationResult {
  const blob = `${data.spec} ${data.equivalence} ${data.evidence.map((e) => `${e.note} ${e.label}`).join(" ")}`.toLowerCase();
  const failHints = ["not delivered", "missing", "incomplete", "downtime", "no integrator", "failed"];
  const failed = failHints.some((h) => blob.includes(h)) && !blob.includes("nine unique");
  const verdict: Verdict = failed ? "refund_to_payer" : "release_to_payee";
  return {
    ok: true,
    source: "local",
    verdict,
    equivalent: !failed,
    reasoning: failed
      ? "Local validator (AI unavailable): evidence does not meet the equivalence principle on a conservative reading, so the vault should refund the payer after finality."
      : "Local validator (AI unavailable): evidence is consistent with the spec under the stated equivalence principle. After finality the source-chain vault should release to the payee.",
  };
}

function parseVerdict(text: string): { verdict: Verdict; splitBps?: number; equivalent: boolean; reasoning: string } | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      verdict?: string;
      split_bps?: number;
      equivalent?: boolean;
      reasoning?: string;
    };
    const v = parsed.verdict;
    if (v !== "release_to_payee" && v !== "refund_to_payer" && v !== "split") return null;
    return {
      verdict: v,
      splitBps: v === "split" ? Math.min(9000, Math.max(1000, Number(parsed.split_bps) || 5000)) : undefined,
      equivalent: Boolean(parsed.equivalent ?? v !== "refund_to_payer"),
      reasoning: String(parsed.reasoning || "").slice(0, 800),
    };
  } catch {
    return null;
  }
}

export const adjudicateEscrow = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<AdjudicationResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return localAdjudicate(data);

    const evidenceBlock =
      data.evidence.length === 0
        ? "(no evidence URLs submitted)"
        : data.evidence.map((e, i) => `${i + 1}. ${e.label} — ${e.url}\n   ${e.note}`).join("\n");

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 500,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a GenLayer validator executing an Intelligent Contract for a cross-chain escrow. You judge meaning, not identical wording. Apply the Equivalence Principle. You never move funds. Reply with JSON only.",
          },
          {
            role: "user",
            content: `Natural-language spec:\n${data.spec}\n\nEquivalence principle:\n${data.equivalence}\n\nEvidence:\n${evidenceBlock}\n\nReturn JSON: {"verdict":"release_to_payee"|"refund_to_payer"|"split","split_bps":0-10000,"equivalent":true|false,"reasoning":"2-4 sentences"}`,
          },
        ],
      }),
    });

    if (!res.ok) return localAdjudicate(data);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    const parsed = parseVerdict(text);
    if (!parsed) return localAdjudicate(data);
    return { ok: true, source: "ai", ...parsed };
  });
