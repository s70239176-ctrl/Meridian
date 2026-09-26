import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKeyValueRecord } from "./genlayer.ts";

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
