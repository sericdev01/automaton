
import { getWalletPath, getWalletAddress } from '../src/identity/wallet.js';
import fs from 'fs';

console.log("=== Wallet Locator ===");
const walletPath = getWalletPath();
console.log(`Resolved Path: ${walletPath}`);

if (fs.existsSync(walletPath)) {
    console.log("File EXISTS.");
    const content = fs.readFileSync(walletPath, 'utf-8');
    console.log("Content Preview:");
    console.log(content);

    try {
        const data = JSON.parse(content);
        console.log(`\nPrivate Key: ${data.privateKey}`);
        console.log(`Address:     ${getWalletAddress()}`);
    } catch (e) {
        console.log("Invalid JSON");
    }
} else {
    console.log("File does NOT exist.");
}
console.log("======================");
console.log(`User Info:`);
console.log(`HOME: ${process.env.HOME}`);
console.log(`USERPROFILE: ${process.env.USERPROFILE}`);
