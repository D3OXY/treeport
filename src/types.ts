export type TreePortConfig = {
  includes: string[];
  excludes: string[];
  overwrite?: boolean;
};

export type CopyOptions = {
  source: string;
  dest: string;
  cliIncludes: string[];
  cliExcludes: string[];
  noConfig: boolean;
  dryRun: boolean;
  overwrite?: boolean;
  link: boolean;
  verbose: boolean;
  config: TreePortConfig;
};

export type EffectivePatterns = {
  includes: string[];
  excludes: string[];
  overwrite: boolean;
  link: boolean;
};

export type PlannedCopy = {
  relativePath: string;
  sourcePath: string;
  destPath: string;
  status: "copy" | "skip";
  reason?: string;
};

export type CopyResult = {
  source: string;
  dest: string;
  dryRun: boolean;
  patterns: EffectivePatterns;
  link: boolean;
  planned: PlannedCopy[];
  copied: PlannedCopy[];
  skipped: PlannedCopy[];
};
