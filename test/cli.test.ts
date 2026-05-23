import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { main } from "../src/index.js";

const originalConfigHome = process.env.XDG_CONFIG_HOME;

afterEach(() => {
  process.env.XDG_CONFIG_HOME = originalConfigHome;
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
});
