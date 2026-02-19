
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";

const paths = [
    "C:\\root\\.automaton\\wallet.json",
    "C:\\Users\\Mel\\.automaton\\wallet.json"
];

console.log("=== Key Inspector ===");

paths.forEach(p => {
    if (fs.existsSync(p)) {
        console.log(`\nFile: ${p}`);
        try {
            const content = fs.readFileSync(p, "utf-8");
            const data = JSON.parse(content);
            const key = data.privateKey;
            console.log(`Key:     ${key.substring(0, 10)}...`);

            const account = privateKeyToAccount(key as `0x${string}`);
            console.log(`Address: ${account.address}`);

            if (account.address.toLowerCase() === "0xdcfd40ea1ce455339456861afb9e15756c191206") {
                console.log(">>> MATCH FOUND! THIS IS THE KEY! <<<");
                console.log(`FULL PRIVATE KEY: ${key}`);
            }
        } catch (e) {
            console.log(`Error reading: ${e.message}`);
        }
    } else {
        console.log(`\nFile: ${p} (Not Found)`);
    }
});
console.log("\n=====================");
