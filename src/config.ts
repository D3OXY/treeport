import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { TreePortConfig } from "./types.js";

export const defaultConfig: TreePortConfig = {
  includes: [],
  excludes: [],
  overwrite: false,
};

export function getConfigPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(configHome, "treeport", "config.json");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function readConfig(configPath = getConfigPath()): Promise<TreePortConfig> {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return { ...defaultConfig };
    }

    const record = parsed as Record<string, unknown>;
    return {
      includes: isStringArray(record.includes) ? record.includes : [],
      excludes: isStringArray(record.excludes) ? record.excludes : [],
      overwrite: typeof record.overwrite === "boolean" ? record.overwrite : false,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { ...defaultConfig };
    }

    throw error;
  }
}

export async function writeConfig(config: TreePortConfig, configPath = getConfigPath()): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function clearConfig(configPath = getConfigPath()): Promise<void> {
  await rm(configPath, { force: true });
}

export function addPatterns(current: string[], patterns: string[]): string[] {
  return [...new Set([...current, ...patterns])];
}

export function removePatterns(current: string[], patterns: string[]): string[] {
  const remove = new Set(patterns);
  return current.filter((pattern) => !remove.has(pattern));
}
