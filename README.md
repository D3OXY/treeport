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

## Releases

Create a changeset for user-facing changes:

```bash
pnpm changeset
```

Merging to `main` creates or updates the Changesets version PR. Merging that PR publishes to npm from GitHub Actions through trusted publishing.

Configure npm trusted publishing for package `treeport`:

- Publisher: GitHub Actions
- Organization/user: `D3OXY`
- Repository: `treeport`
- Workflow filename: `release.yml`
- Environment: unset
- Allowed action: `npm publish`
