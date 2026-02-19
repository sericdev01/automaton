
import { createPublicClient, http, formatEther, formatUnits, parseAbi } from 'viem';
import { base, mainnet } from 'viem/chains';
import { getWalletAddress } from '../src/identity/wallet.js';

const TARGET_ADDRESS = "0xDCFD40ea1cE455339456861Afb9e15756C191206".toLowerCase();

async function main() {
    const currentAddress = getWalletAddress();
    if (!currentAddress) {
        console.error("No wallet found!");
        process.exit(1);
    }

    console.log(`\n=== Wallet Detective ===`);
    console.log(`Loaded Identity:  ${currentAddress}`);
    console.log(`Target Address:   ${TARGET_ADDRESS}`);

    if (currentAddress.toLowerCase() !== TARGET_ADDRESS) {
        console.error(`\n[MISMATCH] The private key in wallet.json belongs to ${currentAddress}, NOT ${TARGET_ADDRESS}.`);
        console.error("Action: You must replace the private key in ~/.automaton/wallet.json with the one for 0xDCFD...");
        // Continue anyway to check the loaded wallet
    } else {
        console.log(`\n[MATCH] Identity verified.`);
    }

    // Define clients
    const clientBase = createPublicClient({ chain: base, transport: http() });
    const clientEth = createPublicClient({ chain: mainnet, transport: http() });

    console.log(`\n--- Scanning BASE Mainnet (Agent Home) ---`);
    await checkBalances(clientBase, currentAddress, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'); // Base USDC

    console.log(`\n--- Scanning ETHEREUM Mainnet (Possible Mistake) ---`);
    await checkBalances(clientEth, currentAddress, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'); // Eth USDC

    console.log("\n========================\n");
}

async function checkBalances(client: any, address: string, usdcContract: string) {
    try {
        const balance = await client.getBalance({ address: address as `0x${string}` });
        console.log(`ETH:  ${formatEther(balance)} ETH`);

        const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);
        const usdcBalance = await client.readContract({
            address: usdcContract,
            abi: abi,
            functionName: 'balanceOf',
            args: [address as `0x${string}`]
        });
        console.log(`USDC: ${formatUnits(usdcBalance, 6)} USDC`);
    } catch (error) {
        console.log(`Error scanning chain: ${error.message}`);
    }
}

main();
