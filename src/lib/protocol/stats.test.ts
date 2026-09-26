import { test } from "node:test";
import assert from "node:assert/strict";
import { chainVaults, protocolStats } from "./stats.ts";
import type { Escrow } from "./types.ts";

function fixture(overrides: Partial<Escrow>): Escrow {
  return {
    id: "case-1",
    title: "Test case",
    domain: "Test",
    spec: "spec",
    equivalence: "equivalence",
    sourceChain: "arc",
    vaultAddress: "0x1111111111111111111111111111111111111111",
    vaultEscrowId: "0xaa",
    asset: "USDC",
    amount: "100",
    payer: "0x2222222222222222222222222222222222222222",
    payee: "0x3333333333333333333333333333333333333333",
    createdAt: 0,
    lockTx: "0xlock",
    evidence: [],
    status: "locked",
    ...overrides,
  };
}

test("chainVaults aggregates only chains that have at least one escrow", () => {
  const escrows = [fixture({ id: "a" }), fixture({ id: "b", amount: "50" })];
  const vaults = chainVaults(escrows);
  assert.equal(vaults.length, 1);
  assert.equal(vaults[0]!.chain, "arc");
  assert.equal(vaults[0]!.vaults, 2);
  assert.equal(vaults[0]!.locked, 150);
});

test("protocolStats splits locked vs settled by status, and counts messages by settleTx", () => {
  const escrows = [
    fixture({ id: "a", amount: "100", status: "locked" }),
    fixture({ id: "b", amount: "40", status: "settled", settleTx: "0xsettle" }),
    fixture({ id: "c", amount: "10", status: "adjudicating" }),
  ];
  const stats = protocolStats(escrows);
  assert.equal(stats.cases, 3);
  assert.equal(stats.locked, 110);
  assert.equal(stats.settled, 40);
  assert.equal(stats.messages, 1);
  assert.equal(stats.live, 1);
});
