import { createConwayClient } from "../src/conway/client.js";
import { loadConfig } from "../src/config.js";

async function main() {
    const config = loadConfig();
    if (!config) {
        console.error("No config found. Run this where automaton.json exists or env vars are set.");
        process.exit(1);
    }

    console.log("Checking available models for API Key:", config.conwayApiKey.slice(0, 10) + "...");

    const client = createConwayClient({
        apiUrl: config.conwayApiUrl,
        apiKey: config.conwayApiKey,
        sandboxId: config.sandboxId
    });

    try {
        console.log("Fetching model list...");
        const models = await client.listModels();

        if (models.length === 0) {
            console.log("No models returned by API.");
        } else {
            console.log("\nAVAILABLE MODELS:");
            console.table(models.map(m => ({
                id: m.id,
                provider: m.provider,
                inputPrice: `$${m.pricing.inputPerMillion}/M`,
                outputPrice: `$${m.pricing.outputPerMillion}/M`
            })));
        }
    } catch (err: any) {
        console.error("Failed to list models:", err.message);
        if (err.cause) console.error(err.cause);
    }
}

main();
