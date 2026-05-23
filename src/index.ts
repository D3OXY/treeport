#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { cac } from "cac";
import { addPatterns, clearConfig, getConfigPath, readConfig, removePatterns, writeConfig } from "./config.js";
import { runCopy } from "./core.js";
import {
  formatConfigList,
  formatCopyResult,
  formatExcludeList,
  formatNoIncludesError,
  formatNoMatchesError,
} from "./output.js";
import type { CopyOptions, TreePortConfig } from "./types.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: unknown };
const version = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
const sourceEnvVar = "TREEPORT_SOURCE_PATH";
const destEnvVar = "TREEPORT_DEST_PATH";

type RootCliOptions = {
  source?: string;
  dest?: string;
  include?: string | string[];
  exclude?: string | string[];
  config?: boolean;
  dryRun?: boolean;
  overwrite?: boolean;
  link?: boolean;
  symlink?: boolean;
  verbose?: boolean;
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizePatterns(value: string | string[] | undefined): string[] {
  return toArray(value);
}

function splitPatterns(patterns: string[]): { includes: string[]; excludes: string[] } {
  return patterns.reduce(
    (result, pattern) => {
      if (pattern.startsWith("!")) {
        result.excludes.push(pattern.slice(1));
      } else {
        result.includes.push(pattern);
      }

      return result;
    },
    { includes: [] as string[], excludes: [] as string[] },
  );
}

function requirePatterns(patterns: string[], usage: string): boolean {
  if (patterns.length > 0) {
    return true;
  }

  console.error(`Missing pattern.\n\nUsage:\n  ${usage}`);
  process.exitCode = 1;
  return false;
}

async function updateConfig(mutator: (config: TreePortConfig) => TreePortConfig): Promise<void> {
  const config = await readConfig();
  await writeConfig(mutator(config));
}

async function handleRoot(patterns: string[], options: RootCliOptions): Promise<void> {
  const source = options.source ?? process.env[sourceEnvVar];
  const dest = options.dest ?? process.env[destEnvVar];

  if (!source || !dest) {
    console.error("Missing source or dest.\n\nUsage:\n  treeport -s <source-dir> -d <dest-dir> <patterns...>");
    process.exitCode = 1;
    return;
  }

  const positional = splitPatterns(patterns);
  const config = await readConfig();
  const copyOptions: CopyOptions = {
    source,
    dest,
    cliIncludes: [...positional.includes, ...toArray(options.include)],
    cliExcludes: [...positional.excludes, ...toArray(options.exclude)],
    noConfig: options.config === false,
    dryRun: options.dryRun ?? false,
    link: (options.link ?? false) || (options.symlink ?? false),
    verbose: options.verbose ?? false,
    config,
  };

  if (options.overwrite !== undefined) {
    copyOptions.overwrite = options.overwrite;
  }

  try {
    const result = await runCopy(copyOptions);

    if (result.planned.length === 0) {
      console.error(formatNoMatchesError(result.patterns));
      process.exitCode = 1;
      return;
    }

    console.log(formatCopyResult(result));
  } catch (error) {
    if (error instanceof Error && error.message === "NO_INCLUDES") {
      console.error(formatNoIncludesError());
      process.exitCode = 1;
      return;
    }

    throw error;
  }
}

async function handleConfig(args: string[] | undefined): Promise<void> {
  const [command, maybeSubcommand, ...patterns] = args ?? [];

  if (!command || command === "list") {
    const config = await readConfig();
    console.log(formatConfigList(config.includes));
    return;
  }

  if (command === "add") {
    const addItems = [maybeSubcommand, ...patterns].filter((pattern): pattern is string => Boolean(pattern));
    if (!requirePatterns(addItems, 'treeport config add "**/.env*"')) {
      return;
    }

    await updateConfig((config) => ({ ...config, includes: addPatterns(config.includes, addItems) }));
    console.log(formatConfigList((await readConfig()).includes));
    return;
  }

  if (command === "remove") {
    const removeItems = [maybeSubcommand, ...patterns].filter((pattern): pattern is string => Boolean(pattern));
    if (!requirePatterns(removeItems, 'treeport config remove "**/.env*"')) {
      return;
    }

    await updateConfig((config) => ({ ...config, includes: removePatterns(config.includes, removeItems) }));
    console.log(formatConfigList((await readConfig()).includes));
    return;
  }

  if (command === "clear") {
    await clearConfig();
    console.log("Config cleared.");
    return;
  }

  if (command === "path") {
    console.log(getConfigPath());
    return;
  }

  if (command === "exclude" && (!maybeSubcommand || maybeSubcommand === "list")) {
    const config = await readConfig();
    console.log(formatExcludeList(config.excludes));
    return;
  }

  if (command === "exclude" && maybeSubcommand === "add") {
    if (!requirePatterns(patterns, 'treeport config exclude add "**/dist/**"')) {
      return;
    }

    await updateConfig((config) => ({ ...config, excludes: addPatterns(config.excludes, patterns) }));
    console.log(formatExcludeList((await readConfig()).excludes));
    return;
  }

  if (command === "exclude" && maybeSubcommand === "remove") {
    if (!requirePatterns(patterns, 'treeport config exclude remove "**/dist/**"')) {
      return;
    }

    await updateConfig((config) => ({ ...config, excludes: removePatterns(config.excludes, patterns) }));
    console.log(formatExcludeList((await readConfig()).excludes));
    return;
  }

  console.error(`Unknown config command: ${args?.join(" ") ?? ""}`);
  process.exitCode = 1;
}

export async function main(argv = process.argv): Promise<void> {
  const cli = cac("treeport");

  cli.command("config [...args]", "Manage global config").action((args: string[] | undefined) => handleConfig(args));

  cli
    .command("[patterns...]", "Copy selected files from source to dest")
    .option("-s, --source <dir>", "source directory")
    .option("-d, --dest <dir>", "destination directory")
    .option("-i, --include <pattern>", "include pattern")
    .option("-e, --exclude <pattern>", "exclude pattern")
    .option("--no-config", "ignore global config")
    .option("--dry-run", "preview only")
    .option("--overwrite", "overwrite existing files")
    .option("--link", "create symlinks instead of copying files")
    .option("--symlink", "create symlinks instead of copying files")
    .option("-v, --verbose", "detailed logs")
    .action((patterns: string | string[] | undefined, options: RootCliOptions) =>
      handleRoot(normalizePatterns(patterns), options),
    );

  cli.help();
  cli.version(version);
  cli.parse(argv, { run: false });
  await cli.runMatchedCommand();
}

function isCliEntrypoint(): boolean {
  const scriptPath = process.argv[1];
  if (!scriptPath) {
    return false;
  }

  return realpathSync(scriptPath) === fileURLToPath(import.meta.url);
}

if (isCliEntrypoint()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
