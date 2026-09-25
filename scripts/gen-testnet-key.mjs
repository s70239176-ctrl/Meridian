#!/usr/bin/env node
/**
 * One-off helper: generate a fresh keypair for deploying/calling the GenLayer
 * contracts on GenLayer Studio (studionet). This is NOT your real wallet —
 * it's a throwaway dev key for this hackathon project. Studio is gasless, so
 * this key never needs funding — it only needs to exist, to sign writes.
 *
 *   node scripts/gen-testnet-key.mjs
 *
 * Prints the address and the private key (do NOT share or commit the key —
 * paste it into your local .env as GENLAYER_DEPLOYER_KEY and nowhere else).
 */
import { generatePrivateKey, createAccount } from "genlayer-js";

const privateKey = generatePrivateKey();
const account = createAccount(privateKey);

console.log("Address:", account.address);
console.log("Private key (put in your local .env as GENLAYER_DEPLOYER_KEY — never commit):");
console.log(privateKey);
