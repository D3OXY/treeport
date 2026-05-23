# TreePort

Selectively port files and folders across matching directory trees.

```bash
treeport -s ../main -d ../worktree "**/.env*"
```

## Usage

```bash
treeport -s <source-dir> -d <dest-dir> <patterns...>
treeport -s ../main -d ../worktree --include "**/.env*" --dry-run
treeport config add "**/.env*"
treeport config exclude add "**/dist/**"
```

TreePort preserves relative paths, skips existing destination files by default, and never copies `.git` or `node_modules`.
