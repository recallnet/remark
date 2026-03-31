# @recallnet/docs-governance-preset

## 0.3.4

### Patch Changes

- 424aed6: Improve `populate` repo discovery so generated docs reflect declared workspaces and common implementation roots like `src/`, `internal/`, and `executors/` instead of assuming only `packages/*` layouts.

## 0.3.3

### Patch Changes

- 958956c: Republish the docs governance runtime packages through packed tarballs so published manifests contain concrete internal dependency versions instead of unresolved `workspace:*` ranges.
- Updated dependencies [958956c]
  - @recallnet/remark-lint-docs-freshness@0.2.7
  - @recallnet/remark-lint-docs-reachability@0.2.7
  - @recallnet/remark-lint-docs-taxonomy@0.2.3

## 0.3.2

### Patch Changes

- eca7021: Republish every package so the current release line is available from both
  npmjs and GitHub Packages after the updated publish workflow runs.
- Updated dependencies [eca7021]
  - @recallnet/docs-governance-policy@0.3.1
  - @recallnet/remark-lint-docs-freshness@0.2.6
  - @recallnet/remark-lint-docs-reachability@0.2.6
  - @recallnet/remark-lint-docs-taxonomy@0.2.2

## 0.3.1

### Patch Changes

- 20757a8: Fix taxonomy package published with unresolved workspace:\* dependency. Republish with correct version reference through Changesets.
- Updated dependencies [20757a8]
  - @recallnet/remark-lint-docs-taxonomy@0.2.1

## 0.3.0

### Minor Changes

- aaf1816: Add the canonical `repo-docs` profile to the docs governance preset, including policy-driven taxonomy enforcement, generated templates, and profile-aware init/config support.

### Patch Changes

- Updated dependencies [aaf1816]
  - @recallnet/docs-governance-policy@0.3.0
  - @recallnet/remark-lint-docs-taxonomy@0.2.0
  - @recallnet/remark-lint-docs-freshness@0.2.5
  - @recallnet/remark-lint-docs-reachability@0.2.5

## 0.2.8

### Patch Changes

- 4f2ef7c: Improve pre-commit integration by making `lint --changed` use staged
  git changes by default, adding explicit file-list input support,
  returning a distinct fatal exit code for tool crashes, and providing a
  quiet summary mode that suppresses clean-file noise.

## 0.2.7

### Patch Changes

- 2f50d29: Reduce docs governance hook latency by short-circuiting `lint --changed`
  before full remark startup and caching the reachability report for the
  life of a single lint process.
- Updated dependencies [2f50d29]
  - @recallnet/remark-lint-docs-reachability@0.2.4

## 0.2.6

### Patch Changes

- Updated dependencies [d1ec56c]
  - @recallnet/remark-lint-docs-freshness@0.2.4

## 0.2.5

### Patch Changes

- 24d3059: Republish the docs-governance packages and refresh plugin package docs for the
  remark ecosystem index.
- Updated dependencies [24d3059]
  - @recallnet/docs-governance-policy@0.2.3
  - @recallnet/remark-lint-docs-freshness@0.2.3
  - @recallnet/remark-lint-docs-reachability@0.2.3

## 0.2.4

### Patch Changes

- Avoid whole-repo traversal for docs collection by deriving traversal roots from `in_scope_paths` and skipping common runtime/cache directories during descent.
- Updated dependencies
  - @recallnet/docs-governance-policy@0.2.2
  - @recallnet/remark-lint-docs-reachability@0.2.2
  - @recallnet/remark-lint-docs-freshness@0.2.2

## 0.2.3

### Patch Changes

- Generate the default docs frontmatter schema as draft-07 so it is compatible with `remark-lint-frontmatter-schema`.

## 0.2.2

### Patch Changes

- Stop resolving `remark-cli/package.json` directly during `recall-docs-governance lint`, and invoke the `remark` executable in an exports-safe way instead.

## 0.2.1

### Patch Changes

- Skip broken symlinks that raise ENOENT during repository scans so docs linting does not crash on invalid repo-local skill links.
- Updated dependencies
  - @recallnet/docs-governance-policy@0.2.1
  - @recallnet/remark-lint-docs-reachability@0.2.1
  - @recallnet/remark-lint-docs-freshness@0.2.1

## 0.2.0

### Minor Changes

- cdbb6ff: Initial public release of the docs governance packages.
  - add shared docs policy loader and path matching helpers
  - add one-command preset and bootstrap CLI for internal repo adoption
  - add remark lint rule for review-policy freshness enforcement
  - add remark lint rule for docs reachability and orphan detection
  - add Changesets-based npmjs publishing and repo QA baseline

### Patch Changes

- 82f1de7: Fix published package manifests to use real semver dependency ranges instead of `workspace:*`.
- Updated dependencies [cdbb6ff]
- Updated dependencies [82f1de7]
  - @recallnet/docs-governance-policy@0.2.0
  - @recallnet/remark-lint-docs-freshness@0.2.0
  - @recallnet/remark-lint-docs-reachability@0.2.0
