import { test } from "node:test";
import assert from "node:assert/strict";
import { chainVaults, protocolStats } from "./stats.ts";
import { buildSeed } from "./seed.ts";

test("chainVaults aggregates only chains that have at least one escrow", () => {
  const escrows = buildSeed();
  const vaults = chainVaults(escrows);
  assert.ok(vaults.length > 0);
  for (const v of vaults) assert.ok(v.vaults > 0);
  const total = vaults.reduce((s, v) => s + v.vaults, 0);
  assert.equal(total, escrows.length);
});

test("protocolStats locked+settled splits by status", () => {
  const escrows = buildSeed();
  const stats = protocolStats(escrows);
  assert.equal(stats.cases, escrows.length);
  assert.ok(stats.locked >= 0);
  assert.ok(stats.settled >= 0);
  const settledCount = escrows.filter((e) => e.status === "paid" || e.status === "refunded").length;
  const settledSum = escrows
    .filter((e) => e.status === "paid" || e.status === "refunded")
    .reduce((s, e) => s + Number(e.amount), 0);
  assert.equal(stats.settled, settledSum);
  assert.ok(settledCount >= 0);
});
