
import fs from "fs";
import path from "path";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// USDC on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BALANCE_OF_ABI = [{
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
}] as const;

async function main() {
    const home = process.env.HOME || process.env.USERPROFILE || "/root";
    // FIX: Automaton uses wallet.json, not identity.json
    const walletPath = path.join(home, ".automaton", "wallet.json");

    if (!fs.existsSync(walletPath)) {
        console.error("Wallet file not found at", walletPath);
        return;
    }

    const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    const account = privateKeyToAccount(walletData.privateKey);

    console.log("\n=== AGENT WALLET ===");
    console.log(`Address: ${account.address}`);
    console.log(`Network: Base Mainnet (8453)`);

    // Check Balance
    try {
        const client = createPublicClient({ chain: base, transport: http() });
        const balance = await client.readContract({
            address: USDC_ADDRESS,
            abi: BALANCE_OF_ABI,
            functionName: "balanceOf",
            args: [account.address]
        });

        const usdc = Number(balance) / 1_000_000;
        console.log(`Balance: $${usdc.toFixed(2)} USDC`);
    } catch (err: any) {
        console.log(`Balance Check Failed: ${err.message}`);
    }
    console.log("====================");
}

main();
