import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

type BuyApiConfig = {
  apiKey?: string;
};

const CONFIG_PATH = join(homedir(), ".buyapi", "config.json");

export function readStoredApiKey(): string | undefined {
  if (!existsSync(CONFIG_PATH)) return undefined;
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as BuyApiConfig;
    return config.apiKey;
  } catch {
    return undefined;
  }
}

export function writeStoredApiKey(apiKey: string) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ apiKey }, null, 2), {
    mode: 0o600,
  });
}

export function clearStoredApiKey() {
  if (existsSync(CONFIG_PATH)) rmSync(CONFIG_PATH);
}

export function configPath() {
  return CONFIG_PATH;
}
