
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function testUrl(url: string, name: string) {
    console.log(`\n--- Testing ${name} (${url}) ---`);
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        console.log(`[NODE] Fetching...`);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        console.log(`[NODE] Status: ${res.status} ${res.statusText} (${Date.now() - start}ms)`);
    } catch (err: any) {
        console.log(`[NODE] Failed: ${err.message} (${Date.now() - start}ms)`);
    }
}

async function main() {
    await testUrl("https://api.conway.tech", "Conway API");
    await testUrl("https://social.conway.tech", "Conway Social");
    await testUrl("https://generativelanguage.googleapis.com", "Google Gemini API");
    await testUrl("https://www.google.com", "Google Search");
}

main();
