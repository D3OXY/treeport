# treeport

## 0.2.0

### Minor Changes

- b648033: Add `TREEPORT_SOURCE_PATH` and `TREEPORT_DEST_PATH` env var defaults for source and destination paths.

## 0.1.0

### Minor Changes

- d0f18ce: Add symlink mode and tighten CLI pattern handling.

  - Add `--link` and `--symlink` to create symbolic links at destination paths instead of copying file contents.
  - Preserve the same safety rules in symlink mode: missing destination folders are created, existing destination paths are skipped unless `--overwrite` is passed, and `.git` / `node_modules` remain excluded.
  - Fix installed CLI handling for a single positional glob such as `treeport -s ../main -d ../worktree "**/.env*"`.

## 0.0.4

### Patch Changes

- 8590a3f: Fix CLI startup when installed globally through npm's symlinked binary.

## 0.0.3

### Patch Changes

- 26874d1: Rewrite README with full usage, config, pattern, and release documentation.

## 0.0.2

### Patch Changes

- Fix CLI `--version` output to read from package metadata.

## 0.0.1

### Initial release

- Add TreePort CLI for copying selected files between matching directory trees.
- Add global config, dry-run, overwrite, and default excludes.
