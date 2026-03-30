# @recallnet/docs-governance-policy

## 0.3.1

### Patch Changes

- eca7021: Republish every package so the current release line is available from both
  npmjs and GitHub Packages after the updated publish workflow runs.

## 0.3.0

### Minor Changes

- aaf1816: Add the canonical `repo-docs` profile to the docs governance preset, including policy-driven taxonomy enforcement, generated templates, and profile-aware init/config support.

## 0.2.3

### Patch Changes

- 24d3059: Republish the docs-governance packages and refresh plugin package docs for the
  remark ecosystem index.

## 0.2.2

### Patch Changes

- Avoid whole-repo traversal for docs collection by deriving traversal roots from `in_scope_paths` and skipping common runtime/cache directories during descent.

## 0.2.1

### Patch Changes

- Skip broken symlinks that raise ENOENT during repository scans so docs linting does not crash on invalid repo-local skill links.

## 0.2.0

### Minor Changes

- cdbb6ff: Initial public release of the docs governance packages.
  - add shared docs policy loader and path matching helpers
  - add one-command preset and bootstrap CLI for internal repo adoption
  - add remark lint rule for review-policy freshness enforcement
  - add remark lint rule for docs reachability and orphan detection
  - add Changesets-based npmjs publishing and repo QA baseline
