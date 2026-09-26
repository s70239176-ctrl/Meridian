import { createPublicClient, createWalletClient, custom, http, type Address } from "viem";
import { arcTestnet } from "viem/chains";

/** Read-only client — works for anyone, no wallet needed (balances, escrow reads). */
export const arcPublicClient = createPublicClient({ chain: arcTestnet, transport: http() });

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getInjectedProvider(): Eip1193Provider {
  const eth = (window as typeof window & { ethereum?: Eip1193Provider }).ethereum;
  if (!eth) throw new Error("No wallet found — install MetaMask or another injected wallet.");
  return eth;
}

const ARC_TESTNET_PARAMS = {
  chainId: `0x${arcTestnet.id.toString(16)}`,
  chainName: arcTestnet.name,
  nativeCurrency: arcTestnet.nativeCurrency,
  rpcUrls: arcTestnet.rpcUrls.default.http,
  blockExplorerUrls: [arcTestnet.blockExplorers.default.url],
};

/** Prompt the wallet to switch to Arc Testnet, adding it first if it doesn't know it yet. */
async function ensureArcTestnet(eth: Eip1193Provider): Promise<void> {
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET_PARAMS.chainId }] });
  } catch (err) {
    const code = (err as { code?: number } | undefined)?.code;
    if (code !== 4902) throw err; // 4902 = chain unrecognized by the wallet
    await eth.request({ method: "wallet_addEthereumChain", params: [ARC_TESTNET_PARAMS] });
  }
}

export type ConnectedWallet = {
  address: Address;
  walletClient: ReturnType<typeof createWalletClient>;
};

/** Connect the browser's injected wallet and make sure it's on Arc Testnet. */
export async function connectWallet(): Promise<ConnectedWallet> {
  const eth = getInjectedProvider();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0] as Address | undefined;
  if (!address) throw new Error("No account returned by wallet");
  await ensureArcTestnet(eth);
  const walletClient = createWalletClient({
    chain: arcTestnet,
    transport: custom(eth as Parameters<typeof custom>[0]),
    account: address,
  });
  return { address, walletClient };
}
