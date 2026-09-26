import { test } from "node:test";
import assert from "node:assert/strict";
import { abi } from "genlayer-js";
import { parseKeyValueRecord, decodedReturnValue } from "./genlayer.ts";

/** Build the same shape genlayer-js's decodeLocalnetTransaction leaves on a finalized studionet transaction. */
function fakeReceipt(value: string) {
  const raw = Array.from(abi.calldata.encode(value));
  return {
    consensus_data: {
      leader_receipt: [{ result: { status: "return", payload: { raw } } }],
    },
  };
}

test("parseKeyValueRecord splits get_escrow/get_message's key=value lines", () => {
  const text = ["escrow_id=1", "status=open", "verdict=", "amount=100"].join("\n");
  assert.deepEqual(parseKeyValueRecord(text), {
    escrow_id: "1",
    status: "open",
    verdict: "",
    amount: "100",
  });
});

test("parseKeyValueRecord keeps '=' characters that appear inside a value", () => {
  const text = "spec=verdict==maybe\nreasoning=a=b=c";
  assert.deepEqual(parseKeyValueRecord(text), {
    spec: "verdict==maybe",
    reasoning: "a=b=c",
  });
});

test("parseKeyValueRecord ignores lines without '='", () => {
  assert.deepEqual(parseKeyValueRecord("a=1\njunk\nb=2"), { a: "1", b: "2" });
});

test("parseKeyValueRecord on an empty string returns an empty record", () => {
  assert.deepEqual(parseKeyValueRecord(""), {});
});

test("decodedReturnValue decodes a real studionet leader_receipt payload", () => {
  assert.equal(decodedReturnValue(fakeReceipt("1")), "1");
  assert.equal(decodedReturnValue(fakeReceipt("release_to_payee")), "release_to_payee");
});

test("decodedReturnValue returns empty string for a non-'return' result (rollback/error)", () => {
  const rolledBack = {
    consensus_data: { leader_receipt: [{ result: { status: "rollback", payload: "some error" } }] },
  };
  assert.equal(decodedReturnValue(rolledBack), "");
});

test("decodedReturnValue returns empty string when the shape is missing entirely", () => {
  assert.equal(decodedReturnValue({}), "");
  assert.equal(decodedReturnValue(null), "");
});

test("decodedReturnValue handles leader_receipt as a single object, not just an array", () => {
  const single = { consensus_data: { leader_receipt: { result: { status: "return", payload: { raw: Array.from(abi.calldata.encode("42")) } } } } };
  assert.equal(decodedReturnValue(single), "42");
});
