import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { main } from "../src/index.js";

const originalConfigHome = process.env.XDG_CONFIG_HOME;
const originalSourcePath = process.env.TREEPORT_SOURCE_PATH;
const originalDestPath = process.env.TREEPORT_DEST_PATH;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

afterEach(() => {
  restoreEnv("XDG_CONFIG_HOME", originalConfigHome);
  restoreEnv("TREEPORT_SOURCE_PATH", originalSourcePath);
  restoreEnv("TREEPORT_DEST_PATH", originalDestPath);
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

async function withConfigHome(run: (configHome: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "treeport-cli-"));
  try {
    process.env.XDG_CONFIG_HOME = join(root, "config-home");
    await run(process.env.XDG_CONFIG_HOME);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("treeport cli", () => {
  test("config add routes to config command", async () => {
    await withConfigHome(async (configHome) => {
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

      await main(["node", "treeport", "config", "add", "**/.env*"]);

      await expect(readFile(join(configHome, "treeport/config.json"), "utf8")).resolves.toContain("**/.env*");
      expect(log).toHaveBeenCalledWith("Include patterns:\n  **/.env*");
      expect(process.exitCode).toBeUndefined();
    });
  });

  test("copy command uses saved config includes", async () => {
    await withConfigHome(async (configHome) => {
      const source = join(configHome, "source");
      const dest = join(configHome, "dest");
      await mkdir(source, { recursive: true });
      await mkdir(dest, { recursive: true });
      await writeFile(join(source, ".env.local"), "secret", "utf8");
      await mkdir(join(configHome, "treeport"), { recursive: true });
      await writeFile(join(configHome, "treeport/config.json"), '{"includes":[".env*"],"excludes":[]}\n', "utf8");

      vi.spyOn(console, "log").mockImplementation(() => undefined);

      await main(["node", "treeport", "-s", source, "-d", dest]);

      await expect(readFile(join(dest, ".env.local"), "utf8")).resolves.toBe("secret");
      expect(process.exitCode).toBeUndefined();
    });
  });

  test("copy command uses env source and dest paths", async () => {
    await withConfigHome(async (configHome) => {
      const source = join(configHome, "source");
      const dest = join(configHome, "dest");
      await mkdir(source, { recursive: true });
      await mkdir(dest, { recursive: true });
      await writeFile(join(source, ".env.local"), "secret", "utf8");
      process.env.TREEPORT_SOURCE_PATH = source;
      process.env.TREEPORT_DEST_PATH = dest;

      vi.spyOn(console, "log").mockImplementation(() => undefined);

      await main(["node", "treeport", ".env*"]);

      await expect(readFile(join(dest, ".env.local"), "utf8")).resolves.toBe("secret");
      expect(process.exitCode).toBeUndefined();
    });
  });

  test("copy command source and dest flags override env paths", async () => {
    await withConfigHome(async (configHome) => {
      const envSource = join(configHome, "env-source");
      const envDest = join(configHome, "env-dest");
      const cliSource = join(configHome, "cli-source");
      const cliDest = join(configHome, "cli-dest");
      await mkdir(envSource, { recursive: true });
      await mkdir(envDest, { recursive: true });
      await mkdir(cliSource, { recursive: true });
      await mkdir(cliDest, { recursive: true });
      await writeFile(join(envSource, ".env.local"), "env-secret", "utf8");
      await writeFile(join(cliSource, ".env.local"), "cli-secret", "utf8");
      process.env.TREEPORT_SOURCE_PATH = envSource;
      process.env.TREEPORT_DEST_PATH = envDest;

      vi.spyOn(console, "log").mockImplementation(() => undefined);

      await main(["node", "treeport", "-s", cliSource, "-d", cliDest, ".env*"]);

      await expect(readFile(join(cliDest, ".env.local"), "utf8")).resolves.toBe("cli-secret");
      await expect(readFile(join(envDest, ".env.local"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect(process.exitCode).toBeUndefined();
    });
  });

  test("copy command accepts a single positional pattern and creates missing destination folders", async () => {
    await withConfigHome(async (configHome) => {
      const source = join(configHome, "source");
      const dest = join(configHome, "dest");
      await mkdir(join(source, "apps/web"), { recursive: true });
      await mkdir(dest, { recursive: true });
      await writeFile(join(source, "apps/web/.env.local"), "web-secret", "utf8");

      vi.spyOn(console, "log").mockImplementation(() => undefined);

      await main(["node", "treeport", "-s", source, "-d", dest, "**/.env*"]);

      await expect(readFile(join(dest, "apps/web/.env.local"), "utf8")).resolves.toBe("web-secret");
      expect(process.exitCode).toBeUndefined();
    });
  });

  test("copy command supports symlink mode", async () => {
    await withConfigHome(async (configHome) => {
      const source = join(configHome, "source");
      const dest = join(configHome, "dest");
      await mkdir(join(source, "apps/web"), { recursive: true });
      await mkdir(dest, { recursive: true });
      await writeFile(join(source, "apps/web/.env.local"), "web-secret", "utf8");

      vi.spyOn(console, "log").mockImplementation(() => undefined);

      await main(["node", "treeport", "-s", source, "-d", dest, "**/.env*", "--symlink"]);

      await expect(lstat(join(dest, "apps/web/.env.local")).then((stats) => stats.isSymbolicLink())).resolves.toBe(
        true,
      );
      await expect(readFile(join(dest, "apps/web/.env.local"), "utf8")).resolves.toBe("web-secret");
      expect(process.exitCode).toBeUndefined();
    });
  });
});
