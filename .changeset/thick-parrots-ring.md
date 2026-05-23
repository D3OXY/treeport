---
"treeport": minor
---

Add symlink mode and tighten CLI pattern handling.

- Add `--link` and `--symlink` to create symbolic links at destination paths instead of copying file contents.
- Preserve the same safety rules in symlink mode: missing destination folders are created, existing destination paths are skipped unless `--overwrite` is passed, and `.git` / `node_modules` remain excluded.
- Fix installed CLI handling for a single positional glob such as `treeport -s ../main -d ../worktree "**/.env*"`.
