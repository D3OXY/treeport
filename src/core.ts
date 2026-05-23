import { constants } from "node:fs";
import { access, copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { glob } from "tinyglobby";
import type { CopyOptions, CopyResult, EffectivePatterns, PlannedCopy } from "./types.js";

export const defaultExcludes = ["**/.git/**", "**/node_modules/**"] as const;

function unique(patterns: string[]): string[] {
  return [...new Set(patterns.filter((pattern) => pattern.length > 0))];
}

function normalizeGlob(pattern: string): string {
  return pattern.startsWith("!") ? pattern.slice(1) : pattern;
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(sep).join("/");
}

function resolveInputPath(input: string): string {
  return isAbsolute(input) ? input : resolve(process.cwd(), input);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function expandLiteralDirectoryPatterns(source: string, includes: string[]): Promise<string[]> {
  const expanded: string[] = [];

  for (const pattern of includes) {
    expanded.push(pattern);
    const hasGlob = /[*?[\]{}()!+@]/u.test(pattern);
    const directoryPattern = pattern.replace(/\/+$/u, "");

    if (pattern.endsWith("/")) {
      expanded.push(`${directoryPattern}/**/*`);
      continue;
    }

    if (!hasGlob && directoryPattern.length > 0) {
      try {
        const candidate = join(source, directoryPattern);
        const stats = await stat(candidate);
        if (stats.isDirectory()) {
          expanded.push(`${directoryPattern}/**/*`);
        }
      } catch {
        // The literal may be a file or may not exist; glob will handle it.
      }
    }
  }

  return unique(expanded);
}

export function getEffectivePatterns(options: CopyOptions): EffectivePatterns {
  const configIncludes = options.noConfig ? [] : options.config.includes;
  const configExcludes = options.noConfig ? [] : options.config.excludes;
  const configOverwrite = options.noConfig ? false : (options.config.overwrite ?? false);

  return {
    includes: unique([...configIncludes, ...options.cliIncludes].map(normalizeGlob)),
    excludes: unique([...defaultExcludes, ...configExcludes, ...options.cliExcludes].map(normalizeGlob)),
    overwrite: options.overwrite ?? configOverwrite,
  };
}

export async function planCopy(options: CopyOptions): Promise<CopyResult> {
  const source = resolveInputPath(options.source);
  const dest = resolveInputPath(options.dest);
  const patterns = getEffectivePatterns(options);

  if (patterns.includes.length === 0) {
    throw new Error("NO_INCLUDES");
  }

  const expandedIncludes = await expandLiteralDirectoryPatterns(source, patterns.includes);
  const matches = await glob(expandedIncludes, {
    cwd: source,
    dot: true,
    onlyFiles: true,
    ignore: patterns.excludes,
    absolute: false,
    followSymbolicLinks: false,
  });

  const relativePaths = unique(matches.map(normalizeRelativePath)).sort((left, right) =>
    left.localeCompare(right),
  );

  const planned: PlannedCopy[] = [];

  for (const relativePath of relativePaths) {
    const sourcePath = join(source, relativePath);
    const destPath = join(dest, relativePath);
    const destExists = await exists(destPath);

    const planItem: PlannedCopy = {
      relativePath,
      sourcePath,
      destPath,
      status: destExists && !patterns.overwrite ? "skip" : "copy",
    };

    if (destExists && !patterns.overwrite) {
      planItem.reason = "already exists";
    }

    planned.push(planItem);
  }

  return {
    source: options.verbose ? source : options.source,
    dest: options.verbose ? dest : options.dest,
    dryRun: options.dryRun,
    patterns,
    planned,
    copied: planned.filter((item) => item.status === "copy"),
    skipped: planned.filter((item) => item.status === "skip"),
  };
}

export async function runCopy(options: CopyOptions): Promise<CopyResult> {
  const result = await planCopy(options);

  if (options.dryRun) {
    return result;
  }

  for (const item of result.copied) {
    await mkdir(dirname(item.destPath), { recursive: true });
    await copyFile(item.sourcePath, item.destPath);
  }

  return result;
}
