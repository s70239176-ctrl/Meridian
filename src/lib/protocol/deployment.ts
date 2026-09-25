const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function address(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return HEX_ADDRESS.test(trimmed) ? trimmed : null;
}

/** Public contract addresses, inlined at build time from Vercel env. */
export function deployment() {
  return {
    adjudicator: address(import.meta.env.VITE_MERIDIAN_ADJUDICATOR),
    outbox: address(import.meta.env.VITE_MERIDIAN_OUTBOX),
  };
}
