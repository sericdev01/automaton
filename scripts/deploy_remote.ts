
import { getWallet } from "../src/identity/wallet.js";
import { provision, loadApiKeyFromConfig } from "../src/identity/provision.js";
import { createConwayClient } from "../src/conway/client.js";

async function main() {
    console.log("Checking Conway API Key...");
    let apiKey = loadApiKeyFromConfig();
    if (!apiKey) {
        console.log("Provisioning new API Key via SIWE...");
        const result = await provision();
        apiKey = result.apiKey;
    }

    console.log("Provisioning 'Mothership' Sandbox on Conway Cloud...");
    // We use a dummy sandboxId to initialize the client, just to call createSandbox
    const client = createConwayClient({
        apiUrl: "https://api.conway.tech",
        apiKey,
        sandboxId: "deployer-temp"
    });

    try {
        const sandbox = await client.createSandbox({
            name: "Automaton-Mothership",
            vcpu: 1,
            memoryMb: 1024,
            diskGb: 5
        });

        console.log("\n✅ MOTHERSHIP PROVISIONED SUCCESSFULLY");
        console.log(`ID: ${sandbox.id}`);
        console.log(`Region: ${sandbox.region}`);
        console.log(`\n🔴 CLICK TO OPEN TERMINAL: \n${sandbox.terminalUrl}\n`);
        console.log("--- DEPLOYMENT STEPS ---");
        console.log("1. Open the URL above in your browser.");
        console.log("2. Run: git clone https://github.com/sericdev01/automaton.git");
        console.log("3. Run: cd automaton && npm install && npm run build");
        console.log("4. Run: node dist/index.js --run");
        console.log("------------------------");
    } catch (err: any) {
        console.error("Failed to provision sandbox:", err.message);
    }
}

main().catch(console.error);
