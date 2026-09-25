import type { ValidatorSeat } from "./types.ts";

const POOL: { id: string; label: string; stake: number }[] = [
  { id: "val_0x1a9c", label: "0x1a9c…e4b2", stake: 2_410_000 },
  { id: "val_0x7e21", label: "0x7e21…90aa", stake: 1_880_000 },
  { id: "val_0x44d0", label: "0x44d0…c17f", stake: 3_020_000 },
  { id: "val_0xb81f", label: "0xb81f…2c09", stake: 1_150_000 },
  { id: "val_0x09ce", label: "0x09ce…aa31", stake: 2_770_000 },
  { id: "val_0x5d62", label: "0x5d62…11b8", stake: 1_640_000 },
  { id: "val_0xc3a7", label: "0xc3a7…d44e", stake: 2_090_000 },
  { id: "val_0x82f4", label: "0x82f4…6e70", stake: 980_000 },
  { id: "val_0x31ab", label: "0x31ab…f0c2", stake: 2_550_000 },
  { id: "val_0xde08", label: "0xde08…19a4", stake: 1_420_000 },
  { id: "val_0x6f15", label: "0x6f15…88d9", stake: 1_990_000 },
  { id: "val_0xa2c0", label: "0xa2c0…b773", stake: 2_220_000 },
  { id: "val_0x14e9", label: "0x14e9…c5d1", stake: 1_310_000 },
  { id: "val_0x9bb2", label: "0x9bb2…07ef", stake: 2_860_000 },
  { id: "val_0x70d3", label: "0x70d3…4a16", stake: 1_070_000 },
  { id: "val_0xee5a", label: "0xee5a…c8b0", stake: 1_760_000 },
  { id: "val_0x28f1", label: "0x28f1…d92c", stake: 2_340_000 },
  { id: "val_0x5aa4", label: "0x5aa4…13e7", stake: 1_540_000 },
  { id: "val_0xc91d", label: "0xc91d…6b45", stake: 2_010_000 },
  { id: "val_0x03b8", label: "0x03b8…fa22", stake: 1_280_000 },
  { id: "val_0x8e66", label: "0x8e66…90fd", stake: 2_670_000 },
  { id: "val_0x41c2", label: "0x41c2…e118", stake: 1_830_000 },
  { id: "val_0xf7a0", label: "0xf7a0…2d5b", stake: 990_000 },
  { id: "val_0x6aa1", label: "0x6aa1…c03e", stake: 1_470_000 },
  { id: "val_0xd12f", label: "0xd12f…88a9", stake: 2_130_000 },
  { id: "val_0x0c77", label: "0x0c77…b4d1", stake: 1_610_000 },
  { id: "val_0xbe44", label: "0xbe44…19f0", stake: 2_480_000 },
  { id: "val_0x39d8", label: "0x39d8…a672", stake: 1_050_000 },
  { id: "val_0x81ae", label: "0x81ae…5c14", stake: 1_920_000 },
  { id: "val_0x2f60", label: "0x2f60…d8bb", stake: 2_300_000 },
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hex4(n: number) {
  return (n >>> 0).toString(16).padStart(4, "0").slice(-4);
}

export function pickCommittee(escrowId: string, roundIndex: number, size: number): ValidatorSeat[] {
  const start = hash(`${escrowId}:${roundIndex}`) % POOL.length;
  const seats: ValidatorSeat[] = [];
  for (let step = 0; step < POOL.length && seats.length < size; step++) {
    const v = POOL[(start + step) % POOL.length]!;
    seats.push({
      id: `${v.id}_r${roundIndex}`,
      label: v.label,
      stake: v.stake,
      greyboxed: true,
      committed: false,
    });
  }
  while (seats.length < size) {
    const n = seats.length;
    const seed = `${escrowId}:syn:${roundIndex}:${n}`;
    seats.push({
      id: `val_syn_${roundIndex}_${n}`,
      label: `0x${hex4(hash(seed))}…${hex4(hash(`${seed}:z`))}`,
      stake: 800_000 + (hash(seed) % 2_200_000),
      greyboxed: true,
      committed: false,
    });
  }
  return seats;
}

export function majorityEquivalent(seats: ValidatorSeat[]) {
  const revealed = seats.filter((s) => s.vote);
  if (revealed.length === 0) return null;
  const yes = revealed.filter((s) => s.vote?.equivalent).length;
  return yes * 2 > revealed.length;
}
