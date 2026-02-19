
import { loadConfig } from "../src/config.js";

async function main() {
    const config = loadConfig();
    if (!config) {
        console.error("No config found.");
        process.exit(1);
    }

    const apiKey = process.env.CONWAY_API_KEY || config.conwayApiKey;
    console.log(`Testing API Key: ${apiKey.slice(0, 10)}...`);
    console.log(`URL: ${config.conwayApiUrl}/v1/chat/completions`);

    // Minimal payload - no tools, no complexity
    const body = {
        model: "gpt-4o-mini", // Try the cheapest one
        messages: [{ role: "user", content: "ping" }],
        stream: false
    };

    try {
        console.log("Sending raw request (bypassing agent logic)...");
        const resp = await fetch(`${config.conwayApiUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": apiKey
            },
            body: JSON.stringify(body)
        });

        console.log(`Status: ${resp.status} ${resp.statusText}`);
        const text = await resp.text();
        console.log("Response Body:", text);

        if (resp.status === 429) {
            console.log("\nVERDICT: CONFIRMED PLATFORM ERROR.");
            console.log("This request used zero agent code. The server rejected it directly.");
        } else if (resp.ok) {
            console.log("\nVERDICT: IT WORKED?!");
            console.log("If this worked, then yes, our agent code might be the problem.");
        }

    } catch (err: any) {
        console.error("Request failed:", err.message);
    }
}

main();
