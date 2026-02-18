/**
 * Automaton Configuration
 *
 * Loads and saves the automaton's configuration from ~/.automaton/automaton.json
 */

import fs from "fs";
import path from "path";
import type { AutomatonConfig } from "./types.js";
import type { Address } from "viem";
import { DEFAULT_CONFIG } from "./types.js";
import { getAutomatonDir } from "./identity/wallet.js";
import { loadApiKeyFromConfig } from "./identity/provision.js";

const CONFIG_FILENAME = "automaton.json";

// AUTOMATON PATCH: Hardcoded wallet address for easier deployment (Public knowledge, safe to commit)
const HARDCODED_WALLET_ADDRESS = "0xDCFD40ea1cE455339456861Afb9e15756C191206";

export function getConfigPath(): string {
  return path.join(getAutomatonDir(), CONFIG_FILENAME);
}

/**
 * Load the automaton config from disk.
 * Merges with defaults for any missing fields.
 */
export function loadConfig(): AutomatonConfig | null {
  const configPath = getConfigPath();
  let raw: any = {};

  if (fs.existsSync(configPath)) {
    try {
      raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      // Ignore parse error
    }
  }

  // Use environment variable if available (Preferred for remote deployment)
  const apiKey = raw.conwayApiKey || process.env.CONWAY_API_KEY;
  const walletAddress = raw.walletAddress || HARDCODED_WALLET_ADDRESS;

  // If we have no API key and no config file, return null to trigger wizard
  if (!apiKey && !fs.existsSync(configPath)) {
    return null;
  }

  return {
    ...DEFAULT_CONFIG,
    name: "Vektorio",
    ...raw,
    conwayApiKey: apiKey,
    walletAddress: walletAddress as Address,
    // Ensure critical fields are set
    sandboxId: raw.sandboxId || "",
    creatorAddress: raw.creatorAddress || walletAddress as Address,
    genesisPrompt: raw.genesisPrompt || "You are a sovereign AI agent.",
    registeredWithConway: true,
  } as AutomatonConfig;
}

/**
 * Save the automaton config to disk.
 */
export function saveConfig(config: AutomatonConfig): void {
  const dir = getAutomatonDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

/**
 * Resolve ~ paths to absolute paths.
 */
export function resolvePath(p: string): string {
  if (p.startsWith("~")) {
    return path.join(process.env.HOME || "/root", p.slice(1));
  }
  return p;
}

/**
 * Create a fresh config from setup wizard inputs.
 */
export function createConfig(params: {
  name: string;
  genesisPrompt: string;
  creatorMessage?: string;
  creatorAddress: Address;
  registeredWithConway: boolean;
  sandboxId: string;
  walletAddress: Address;
  apiKey: string;
  parentAddress?: Address;
}): AutomatonConfig {
  return {
    name: params.name,
    genesisPrompt: params.genesisPrompt,
    creatorMessage: params.creatorMessage,
    creatorAddress: params.creatorAddress,
    registeredWithConway: params.registeredWithConway,
    sandboxId: params.sandboxId,
    conwayApiUrl:
      DEFAULT_CONFIG.conwayApiUrl || "https://api.conway.tech",
    conwayApiKey: params.apiKey,
    inferenceModel: DEFAULT_CONFIG.inferenceModel || "gpt-4o",
    maxTokensPerTurn: DEFAULT_CONFIG.maxTokensPerTurn || 4096,
    heartbeatConfigPath:
      DEFAULT_CONFIG.heartbeatConfigPath || "~/.automaton/heartbeat.yml",
    dbPath: DEFAULT_CONFIG.dbPath || "~/.automaton/state.db",
    logLevel: (DEFAULT_CONFIG.logLevel as AutomatonConfig["logLevel"]) || "info",
    walletAddress: params.walletAddress,
    version: DEFAULT_CONFIG.version || "0.1.0",
    skillsDir: DEFAULT_CONFIG.skillsDir || "~/.automaton/skills",
    maxChildren: DEFAULT_CONFIG.maxChildren || 3,
    parentAddress: params.parentAddress,
  };
}
