import { arcTestnet } from "viem/chains";

const BASE = arcTestnet.blockExplorers?.default.url ?? "https://testnet.arcscan.app";

export function arcExplorerTxUrl(hash: string): string {
  return `${BASE}/tx/${hash}`;
}

export function arcExplorerAddressUrl(address: string): string {
  return `${BASE}/address/${address}`;
}
