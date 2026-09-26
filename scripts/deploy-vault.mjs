#!/usr/bin/env node
/**
 * Compile and deploy contracts/Vault.sol to Arc Testnet for real — no mocks.
 *
 *   node scripts/deploy-vault.mjs
 *
 * Reads two env vars, both server-only, never pasted anywhere but your local
 * .env:
 *   VAULT_DEPLOYER_KEY — pays gas (USDC) to deploy. Fund it first via
 *                        https://faucet.circle.com (select Arc Testnet).
 *   VAULT_RELAYER_KEY  — the address allowed to call settle() later. Can be
 *                        the same key as the deployer, or a separate one —
 *                        either way only its ADDRESS is baked into the
 *                        contract's constructor, never the key itself.
 *
 * Prints the deployed vault address — put it in .env as VITE_VAULT_ADDRESS.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import solc from "solc";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = join(root, "contracts", "Vault.sol");
const source = readFileSync(contractPath, "utf8");

function compile() {
  const input = {
    language: "Solidity",
    sources: { "Vault.sol": { content: source } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      optimizer: { enabled: true, runs: 200 },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length > 0) {
    for (const e of errors) console.error(e.formattedMessage);
    throw new Error("Solidity compilation failed");
  }
  const contract = output.contracts["Vault.sol"]["MeridianVault"];
  return { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` };
}

async function main() {
  const deployerKey = process.env.VAULT_DEPLOYER_KEY;
  const relayerKey = process.env.VAULT_RELAYER_KEY;
  if (!deployerKey) throw new Error("VAULT_DEPLOYER_KEY is not set");
  if (!relayerKey) throw new Error("VAULT_RELAYER_KEY is not set");

  const deployer = privateKeyToAccount(deployerKey);
  const relayer = privateKeyToAccount(relayerKey);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ chain: arcTestnet, transport: http(), account: deployer });

  const balance = await publicClient.getBalance({ address: deployer.address });
  // Arc's native balance is USDC accounted with 18 decimals (ether-style) —
  // NOT the 6 decimals its ERC-20 view uses. Same funds, two precisions.
  // See github.com/circlefin/arc-node issues #95 and #453.
  console.log(`Deployer ${deployer.address} balance: ${formatUnits(balance, 18)} USDC`);
  if (balance === 0n) {
    throw new Error(
      `Deployer has 0 USDC on Arc Testnet. Fund it at https://faucet.circle.com (select Arc Testnet) first.`,
    );
  }

  console.log("Compiling Vault.sol...");
  const { abi, bytecode } = compile();

  console.log(`Deploying, relayer = ${relayer.address}...`);
  const hash = await walletClient.deployContract({ abi, bytecode, args: [relayer.address] });
  console.log("Deploy tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error("Deployment transaction failed");
  }

  console.log("\nDeployed MeridianVault at:", receipt.contractAddress);
  console.log(`View it: https://testnet.arcscan.app/address/${receipt.contractAddress}`);
  console.log("\nPut this in your .env:");
  console.log(`VITE_VAULT_ADDRESS=${receipt.contractAddress}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
