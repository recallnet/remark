---
name: docs-governance-setup
description: Install Recall's docs governance stack into a repo. Use this whenever a team repo needs astrochicken-style docs governance, remark-based frontmatter/link validation, freshness checks, orphan detection, docs policy bootstrapping, or a fast one-command setup instead of copied scripts.
---

# Docs Governance Setup

Set up docs governance by installing the preset and generating repo files.

Do not port hand-rolled markdown parsers from older repos. Prefer the smallest novel surface:

- `remark-frontmatter` for frontmatter parsing
- `remark-lint-frontmatter-schema` for frontmatter schema validation
- `remark-validate-links` for markdown link validation
- `@recallnet/remark-lint-docs-freshness` for review-date expiration
- `@recallnet/remark-lint-docs-reachability` for orphan detection

## Default workflow

1. Inspect the target repo root and package manager.
2. Install `@recallnet/docs-governance-preset` as a dev dependency.
3. Run:

```bash
pnpm exec recall-docs-governance init
```

4. Review the generated files:
   - `docs/docs-policy.json`
   - `docs/docs-frontmatter.schema.json`
   - `.remarkrc.mjs`
   - `docs/INDEX.md`
   - `AGENTS.md` docs-governance section
5. Start from the default operating model unless the repo has a real reason not to:
   - default active docs to `periodic-7`
   - set `docs/INDEX.md` to `generated`
   - keep `docs/**` in scope
   - root the graph from `docs/INDEX.md`
   - exclude `docs/templates/**` from freshness and orphan checks
   - use `historical` only for true archival docs
   - use `codebound` only when the doc must change with code
6. Adjust only the repo-specific policy surface:
   - in-scope paths outside `docs/**`
   - extra rooted entry docs
   - orphan allowlists for deliberate exceptions
   - owner/team metadata
   - narrower or broader review windows if the repo truly needs them
7. Run:

```bash
pnpm docs:lint
```

## What good setup looks like

- docs policy is repo-native and committed
- docs linting uses remark plugins instead of copied regex parsers
- every in-scope doc is reachable from rooted entry docs
- review expirations fail lint deterministically
- active docs expire quickly enough to force reality checks instead of passive drift
- repo guidance tells contributors not to bypass the policy

## When customizing

Customize policy, schema, and doc roots. Do not fork the plugin logic unless the repo has a real semantic gap.

If the repo already has older docs scripts, replace them with the preset unless there is a verified behavior the preset cannot express.

## Freshness guidance

- Prefer deleting stale docs before re-dating them.
- Re-date only when the content is already accurate as written.
- Mark docs `historical` only when they are true records, not as a way to dodge upkeep.
