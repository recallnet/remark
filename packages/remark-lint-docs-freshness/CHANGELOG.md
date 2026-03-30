# @recallnet/remark-lint-docs-freshness

## 0.2.6

### Patch Changes

- eca7021: Republish every package so the current release line is available from both
  npmjs and GitHub Packages after the updated publish workflow runs.
- Updated dependencies [eca7021]
  - @recallnet/docs-governance-policy@0.3.1

## 0.2.5

### Patch Changes

- Updated dependencies [aaf1816]
  - @recallnet/docs-governance-policy@0.3.0

## 0.2.4

### Patch Changes

- d1ec56c: Use unified's `vfile-matter` to read YAML frontmatter in the docs freshness
  rule instead of manually parsing the YAML node.

## 0.2.3

### Patch Changes

- 24d3059: Republish the docs-governance packages and refresh plugin package docs for the
  remark ecosystem index.
- Updated dependencies [24d3059]
  - @recallnet/docs-governance-policy@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies
  - @recallnet/docs-governance-policy@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies
  - @recallnet/docs-governance-policy@0.2.1

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
  - @recallnet/docs-governance-policy@0.2.0
