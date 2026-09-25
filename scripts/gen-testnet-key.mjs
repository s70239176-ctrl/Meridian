#!/usr/bin/env node
/**
 * One-off helper: generate a fresh keypair for deploying/calling the GenLayer
 * contracts on Testnet Bradbury. This is NOT your real wallet — it's a
 * throwaway dev key for this hackathon project.
 *
 *   node scripts/gen-testnet-key.mjs
 *
 * Prints the address (safe to share/fund) and the private key (do NOT share
 * it, do NOT commit it — paste it into your local .env as
 * GENLAYER_DEPLOYER_KEY and nowhere else).
 */
import { generatePrivateKey, createAccount } from "genlayer-js";

const privateKey = generatePrivateKey();
const account = createAccount(privateKey);

console.log("Address (fund this one at the faucet):", account.address);
console.log("Private key (put in your local .env as GENLAYER_DEPLOYER_KEY — never commit):");
console.log(privateKey);
