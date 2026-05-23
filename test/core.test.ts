import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { runCopy } from "../src/core.js";
import type { CopyOptions, TreePortConfig } from "../src/types.js";

type TestDirs = {
  root: string;
  source: string;
  dest: string;
};

async function makeDirs(): Promise<TestDirs> {
  const root = await mkdtemp(join(tmpdir(), "treeport-"));
  const source = join(root, "source");
  const dest = join(root, "dest");
  await mkdir(source, { recursive: true });
  await mkdir(dest, { recursive: true });
  return { root, source, dest };
}

async function write(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

function options(dirs: TestDirs, overrides: Partial<CopyOptions>): CopyOptions {
  const base: CopyOptions = {
    source: dirs.source,
    dest: dirs.dest,
    cliIncludes: [],
    cliExcludes: [],
    noConfig: false,
    dryRun: false,
    link: false,
    verbose: false,
    config: { includes: [], excludes: [], overwrite: false },
  };

  return { ...base, ...overrides };
}

async function withDirs(run: (dirs: TestDirs) => Promise<void>): Promise<void> {
  const dirs = await makeDirs();
  try {
    await run(dirs);
  } finally {
    await rm(dirs.root, { recursive: true, force: true });
  }
}

describe("treeport copy", () => {
  test("copies nested env files preserving relative paths", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, ".env"), "root");
      await write(join(dirs.source, "apps/web/.env.local"), "web");
      await write(join(dirs.source, "apps/api/.env.production.local"), "api");

      const result = await runCopy(options(dirs, { cliIncludes: ["**/.env*"] }));

      expect(result.copied.map((item) => item.relativePath)).toEqual([
        ".env",
        "apps/api/.env.production.local",
        "apps/web/.env.local",
      ]);
      await expect(readFile(join(dirs.dest, "apps/web/.env.local"), "utf8")).resolves.toBe("web");
    });
  });

  test("copies only specific env pattern", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, ".env"), "root");
      await write(join(dirs.source, "apps/web/.env.local"), "web");
      await write(join(dirs.source, "apps/api/.env.production.local"), "api");

      const result = await runCopy(options(dirs, { cliIncludes: ["**/.env.local"] }));

      expect(result.copied.map((item) => item.relativePath)).toEqual(["apps/web/.env.local"]);
    });
  });

  test("root env pattern does not match nested env files", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, ".env.local"), "root");
      await write(join(dirs.source, "apps/web/.env.local"), "web");

      const result = await runCopy(options(dirs, { cliIncludes: [".env*"] }));

      expect(result.copied.map((item) => item.relativePath)).toEqual([".env.local"]);
    });
  });

  test("skips existing files unless overwrite is set", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, ".env"), "source");
      await write(join(dirs.dest, ".env"), "dest");

      const skipped = await runCopy(options(dirs, { cliIncludes: [".env*"] }));
      expect(skipped.skipped.map((item) => item.relativePath)).toEqual([".env"]);
      await expect(readFile(join(dirs.dest, ".env"), "utf8")).resolves.toBe("dest");

      const overwritten = await runCopy(options(dirs, { cliIncludes: [".env*"], overwrite: true }));
      expect(overwritten.copied.map((item) => item.relativePath)).toEqual([".env"]);
      await expect(readFile(join(dirs.dest, ".env"), "utf8")).resolves.toBe("source");
    });
  });

  test("dry run reports actions without copying", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, ".env"), "source");

      const result = await runCopy(options(dirs, { cliIncludes: [".env*"], dryRun: true }));

      expect(result.copied.map((item) => item.relativePath)).toEqual([".env"]);
      await expect(readFile(join(dirs.dest, ".env"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("link mode creates symlinks and missing destination folders", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, "apps/web/.env.local"), "web");

      const result = await runCopy(options(dirs, { cliIncludes: ["**/.env*"], link: true }));
      const destPath = join(dirs.dest, "apps/web/.env.local");

      expect(result.link).toBe(true);
      await expect(lstat(destPath).then((stats) => stats.isSymbolicLink())).resolves.toBe(true);
      await expect(readlink(destPath)).resolves.toBe(join(dirs.source, "apps/web/.env.local"));
      await expect(readFile(destPath, "utf8")).resolves.toBe("web");
    });
  });

  test("link mode skips existing files unless overwrite is set", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, ".env"), "source");
      await write(join(dirs.dest, ".env"), "dest");

      const skipped = await runCopy(options(dirs, { cliIncludes: [".env*"], link: true }));
      expect(skipped.skipped.map((item) => item.relativePath)).toEqual([".env"]);
      await expect(readFile(join(dirs.dest, ".env"), "utf8")).resolves.toBe("dest");

      const overwritten = await runCopy(options(dirs, { cliIncludes: [".env*"], link: true, overwrite: true }));
      expect(overwritten.copied.map((item) => item.relativePath)).toEqual([".env"]);
      await expect(lstat(join(dirs.dest, ".env")).then((stats) => stats.isSymbolicLink())).resolves.toBe(true);
      await expect(readFile(join(dirs.dest, ".env"), "utf8")).resolves.toBe("source");
    });
  });

  test("uses config includes and appends cli includes", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, ".env"), "env");
      await write(join(dirs.source, "config/app.json"), "config");
      const config: TreePortConfig = { includes: [".env*"], excludes: [], overwrite: false };

      const result = await runCopy(options(dirs, { cliIncludes: ["config/**"], config }));

      expect(result.copied.map((item) => item.relativePath)).toEqual([".env", "config/app.json"]);
    });
  });

  test("no-config ignores global includes", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, ".env"), "env");
      await write(join(dirs.source, "certs/dev.pem"), "cert");
      const config: TreePortConfig = { includes: [".env*"], excludes: [], overwrite: false };

      const result = await runCopy(options(dirs, { cliIncludes: ["certs/**"], noConfig: true, config }));

      expect(result.copied.map((item) => item.relativePath)).toEqual(["certs/dev.pem"]);
    });
  });

  test("excludes win and default excludes are forced", async () => {
    await withDirs(async (dirs) => {
      await write(join(dirs.source, "apps/web/.env.local"), "web");
      await write(join(dirs.source, "node_modules/pkg/.env"), "module");
      await write(join(dirs.source, ".git/hooks/.env"), "git");

      const result = await runCopy(
        options(dirs, {
          cliIncludes: ["**/.env*"],
          cliExcludes: ["apps/**"],
        }),
      );

      expect(result.planned).toEqual([]);
    });
  });

  test("errors when no includes exist", async () => {
    await withDirs(async (dirs) => {
      await expect(runCopy(options(dirs, {}))).rejects.toThrow("NO_INCLUDES");
    });
  });
});
