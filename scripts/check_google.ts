
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";

// Load environment variables
dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    console.error("Error: GOOGLE_API_KEY is not set.");
    process.exit(1);
}

async function main() {
    console.log("Checking Google Gemini API Access...");
    console.log(`Key: ${apiKey.substring(0, 8)}...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) {
            console.error(`Failed to list models: ${resp.status} ${resp.statusText}`);
            console.error(await resp.text());
            return;
        }

        const data = await resp.json() as any;
        const models = data.models || [];

        console.log(`\nFound ${models.length} models:`);
        const chatModels = models.filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"));

        chatModels.forEach((m: any) => {
            console.log(`- ${m.name} (${m.displayName})`);
        });

        if (chatModels.length === 0) {
            console.log("\nNo models support 'generateContent'. This is unexpected.");
        } else {
            console.log("\nRecommended config:");
            const flash = chatModels.find((m: any) => m.name.includes("flash"));
            const pro = chatModels.find((m: any) => m.name.includes("pro"));
            const target = flash || pro || chatModels[0];

            // Strip 'models/' prefix for the config
            const shortName = target.name.replace("models/", "");
            console.log(`export CONWAY_INFERENCE_MODEL="${shortName}"`);
        }

    } catch (err) {
        console.error("Network error:", err);
    }
}

main();
