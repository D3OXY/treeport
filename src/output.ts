import type { CopyResult, EffectivePatterns, PlannedCopy } from "./types.js";

function list(label: string, items: PlannedCopy[]): string[] {
  if (items.length === 0) {
    return [];
  }

  return [label, ...items.map((item) => `  ${item.relativePath}${item.reason ? ` ${item.reason}` : ""}`), ""];
}

export function formatNoIncludesError(): string {
  return [
    "No include patterns found.",
    "",
    "Pass patterns:",
    '  treeport -s ../main -d ../worktree "**/.env*"',
    "",
    "Or add global defaults:",
    '  treeport config add "**/.env*"',
  ].join("\n");
}

export function formatNoMatchesError(patterns: EffectivePatterns): string {
  return ["No files matched the provided patterns.", "", "Patterns:", ...patterns.includes.map((pattern) => `  ${pattern}`)].join(
    "\n",
  );
}

export function formatCopyResult(result: CopyResult): string {
  const action = result.link ? "link" : "copy";
  const actionPast = result.link ? "linked" : "copied";
  const copyLabel = result.dryRun ? `Would ${action}:` : result.link ? "Linked:" : "Copied:";
  const skipLabel = result.dryRun ? "Would skip:" : "Skipped:";
  const copiedLabel = result.dryRun ? `would ${action}` : actionPast;
  const skippedLabel = result.dryRun ? "would skip" : "skipped";
  const header = result.dryRun ? "TreePort dry run. No files copied." : "TreePort";
  const lines = [
    header,
    "",
    `Source: ${result.source}`,
    `Dest:   ${result.dest}`,
    "",
    ...list(copyLabel, result.copied),
    ...list(skipLabel, result.skipped),
    `Done. ${result.copied.length} ${copiedLabel}, ${result.skipped.length} ${skippedLabel}.`,
  ];

  return lines.join("\n");
}

export function formatConfigList(includes: string[]): string {
  if (includes.length === 0) {
    return "No include patterns configured.";
  }

  return ["Include patterns:", ...includes.map((pattern) => `  ${pattern}`)].join("\n");
}

export function formatExcludeList(excludes: string[]): string {
  if (excludes.length === 0) {
    return "No exclude patterns configured.";
  }

  return ["Exclude patterns:", ...excludes.map((pattern) => `  ${pattern}`)].join("\n");
}
