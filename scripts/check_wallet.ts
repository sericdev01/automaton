
import { createPublicClient, http, formatEther, formatUnits, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { getWalletAddress } from '../src/identity/wallet.js';

async function main() {
    const address = getWalletAddress();
    if (!address) {
        console.error("No wallet found!");
        process.exit(1);
    }

    console.log(`\n=== Wallet Inspector ===`);
    console.log(`Address: ${address}`);
    console.log(`Chain:   Base Mainnet`);

    const client = createPublicClient({
        chain: base,
        transport: http()
    });

    try {
        // 1. Check ETH Balance
        const balance = await client.getBalance({ address: address as `0x${string}` });
        console.log(`ETH:     ${formatEther(balance)} ETH`);

        // 2. Check USDC Balance (Base Mainnet USDC Address)
        const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

        const usdcBalance = await client.readContract({
            address: usdcAddress,
            abi: abi,
            functionName: 'balanceOf',
            args: [address as `0x${string}`]
        });

        console.log(`USDC:    ${formatUnits(usdcBalance, 6)} USDC`);

    } catch (error) {
        console.error("Error fetching balances:", error);
    }
    console.log("========================\n");
}

main();
