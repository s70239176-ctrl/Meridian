import { test } from "node:test";
import assert from "node:assert/strict";
import { majorityEquivalent, pickCommittee } from "./validators.ts";
import { committeeSizeForRound, nextCommitteeSize } from "./types.ts";

test("committeeSizeForRound grows 2n+1 per appeal round", () => {
  assert.equal(committeeSizeForRound(0), 5);
  assert.equal(committeeSizeForRound(1), 11);
  assert.equal(committeeSizeForRound(2), 23);
  assert.equal(committeeSizeForRound(3), 47);
});

test("nextCommitteeSize doubles and adds one", () => {
  assert.equal(nextCommitteeSize(5), 11);
  assert.equal(nextCommitteeSize(11), 23);
});

test("pickCommittee returns exactly `size` distinct seats", () => {
  const seats = pickCommittee("MX-1901", 0, 5);
  assert.equal(seats.length, 5);
  assert.equal(new Set(seats.map((s) => s.id)).size, 5);
});

test("pickCommittee is deterministic for the same escrow/round", () => {
  const a = pickCommittee("MX-1901", 1, 11);
  const b = pickCommittee("MX-1901", 1, 11);
  assert.deepEqual(a.map((s) => s.id), b.map((s) => s.id));
});

test("pickCommittee synthesizes extra seats when size exceeds the pool", () => {
  const seats = pickCommittee("MX-1901", 5, 40);
  assert.equal(seats.length, 40);
  assert.equal(new Set(seats.map((s) => s.id)).size, 40);
});

test("majorityEquivalent is null until votes are revealed", () => {
  const seats = pickCommittee("MX-1901", 0, 5);
  assert.equal(majorityEquivalent(seats), null);
});

test("majorityEquivalent is true when more than half vote equivalent", () => {
  const seats = pickCommittee("MX-1901", 0, 5).map((s, i) => ({
    ...s,
    vote: { equivalent: i < 3, note: "" },
  }));
  assert.equal(majorityEquivalent(seats), true);
});

test("majorityEquivalent is false when half or fewer vote equivalent", () => {
  const seats = pickCommittee("MX-1901", 0, 5).map((s, i) => ({
    ...s,
    vote: { equivalent: i < 2, note: "" },
  }));
  assert.equal(majorityEquivalent(seats), false);
});
