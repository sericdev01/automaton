
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function testUrl(url: string, name: string) {
    console.log(`\n--- Testing ${name} (${url}) ---`);
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        console.log(`[NODE] Fetching...`);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        console.log(`[NODE] Status: ${res.status} ${res.statusText} (${Date.now() - start}ms)`);
    } catch (err: any) {
        console.log(`[NODE] Failed: ${err.message} (${Date.now() - start}ms)`);
    }

    // Test CURL
    try {
        console.log(`[CURL] Executing...`);
        const { stdout, stderr } = await execAsync(`curl -I -s --connect-timeout 5 ${url}`);
        const statusLine = stdout.split('\n')[0] || stderr;
        console.log(`[CURL] Result: ${statusLine.trim()}`);
    } catch (err: any) {
        console.log(`[CURL] Failed: ${err.message}`);
    }
}

async function main() {
    await testUrl("https://api.conway.tech", "Conway API");
    await testUrl("https://social.conway.tech", "Conway Social");
    await testUrl("https://generativelanguage.googleapis.com", "Google Gemini API");
    await testUrl("https://google.com", "Google Search (Generic)");
}

main();
