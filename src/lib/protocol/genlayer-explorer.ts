/** GenLayer Studio's own explorer — kept as its own tiny, dependency-free module so client components can link to it without importing genlayer.ts's server-only surface. */
const GENLAYER_STUDIO_EXPLORER = "https://explorer-studio.genlayer.com";

export function genlayerExplorerTxUrl(hash: string): string {
  return `${GENLAYER_STUDIO_EXPLORER}/tx/${hash}`;
}
