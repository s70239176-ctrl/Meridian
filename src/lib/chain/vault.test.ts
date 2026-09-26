import { test } from "node:test";
import assert from "node:assert/strict";
import { vaultEscrowId, usdcToNativeValue, VAULT_VERDICT } from "./vault.ts";

test("vaultEscrowId is deterministic for the same case id", () => {
  const a = vaultEscrowId("case-123");
  const b = vaultEscrowId("case-123");
  assert.equal(a, b);
});

test("vaultEscrowId differs for different case ids", () => {
  assert.notEqual(vaultEscrowId("case-123"), vaultEscrowId("case-456"));
});

test("vaultEscrowId returns a 32-byte hex value", () => {
  const id = vaultEscrowId("anything");
  assert.match(id, /^0x[0-9a-f]{64}$/);
});

test("usdcToNativeValue uses 18 decimals (Arc's native value convention, not the 6-decimal ERC-20 view)", () => {
  assert.equal(usdcToNativeValue("1"), 1_000_000_000_000_000_000n);
  assert.equal(usdcToNativeValue("0.5"), 500_000_000_000_000_000n);
});

test("VAULT_VERDICT enum values match Vault.sol's Verdict enum order", () => {
  assert.equal(VAULT_VERDICT.release_to_payee, 0);
  assert.equal(VAULT_VERDICT.refund_to_payer, 1);
  assert.equal(VAULT_VERDICT.split, 2);
});
