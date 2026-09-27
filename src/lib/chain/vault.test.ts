import { test } from "node:test";
import assert from "node:assert/strict";
import {
  vaultEscrowId,
  usdcToNativeValue,
  VAULT_VERDICT,
  verifyMessageAgainstVaultEscrow,
  type VaultEscrowRecord,
} from "./vault.ts";

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

const VAULT_ADDRESS = "0x9999999999999999999999999999999999999999";

// Two distinct, real deposits, as the vault contract would actually report them.
const escrowA: VaultEscrowRecord = {
  payer: "0xAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  payee: "0xBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  amount: usdcToNativeValue("100"),
  status: "locked",
};
const escrowB: VaultEscrowRecord = {
  payer: "0xCccccccccccccccccccccccccccccccccccccccc",
  payee: "0xDddddddddddddddddddddddddddddddddddddddd",
  amount: usdcToNativeValue("40"),
  status: "locked",
};

test("verifyMessageAgainstVaultEscrow accepts a message that genuinely matches its own escrow", () => {
  const result = verifyMessageAgainstVaultEscrow({
    escrow: escrowA,
    configuredVault: VAULT_ADDRESS,
    messageVault: VAULT_ADDRESS,
    messageAmount: "100",
    messageRecipient: escrowA.payee,
  });
  assert.deepEqual(result, { ok: true });
});

test("verifyMessageAgainstVaultEscrow rejects a verdict meant for a different, mismatched escrow (cross-escrow replay)", () => {
  // Case A's real, finalized message (100 USDC, payee B) applied against
  // Case B's on-chain deposit (only 40 USDC locked, different addresses).
  // This is exactly the bug: before a canonical shared id, a relayer given
  // the wrong pairing of (message, vaultEscrowId) had no way to notice.
  const result = verifyMessageAgainstVaultEscrow({
    escrow: escrowB,
    configuredVault: VAULT_ADDRESS,
    messageVault: VAULT_ADDRESS,
    messageAmount: "100", // Case A's amount, not Case B's 40
    messageRecipient: escrowA.payee, // Case A's payee, not one of Case B's addresses
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /does not match the amount actually locked/);
});

test("verifyMessageAgainstVaultEscrow rejects an already-settled escrow (prevents replaying the same message twice)", () => {
  const settled: VaultEscrowRecord = { ...escrowA, status: "settled" };
  const result = verifyMessageAgainstVaultEscrow({
    escrow: settled,
    configuredVault: VAULT_ADDRESS,
    messageVault: VAULT_ADDRESS,
    messageAmount: "100",
    messageRecipient: escrowA.payee,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /not locked on-chain/);
});

test("verifyMessageAgainstVaultEscrow rejects a message naming a different vault contract", () => {
  const result = verifyMessageAgainstVaultEscrow({
    escrow: escrowA,
    configuredVault: VAULT_ADDRESS,
    messageVault: "0x1234567890123456789012345678901234567890",
    messageAmount: "100",
    messageRecipient: escrowA.payee,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /vault this relayer is configured for/);
});

test("verifyMessageAgainstVaultEscrow rejects a recipient that is neither the escrow's payer nor payee", () => {
  const result = verifyMessageAgainstVaultEscrow({
    escrow: escrowA,
    configuredVault: VAULT_ADDRESS,
    messageVault: VAULT_ADDRESS,
    messageAmount: "100",
    messageRecipient: "0xffffffffffffffffffffffffffffffffffffffff",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /neither this escrow's payer nor payee/);
});

test("verifyMessageAgainstVaultEscrow accepts the payer as recipient (refund_to_payer case)", () => {
  const result = verifyMessageAgainstVaultEscrow({
    escrow: escrowA,
    configuredVault: VAULT_ADDRESS,
    messageVault: VAULT_ADDRESS,
    messageAmount: "100",
    messageRecipient: escrowA.payer,
  });
  assert.deepEqual(result, { ok: true });
});
