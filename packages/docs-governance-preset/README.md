# @recallnet/docs-governance-preset

One-package bootstrap for Recall docs governance.

It wires the existing remark ecosystem plus Recall's governance rules:

- `remark-frontmatter`
- `remark-lint-frontmatter-schema`
- `remark-validate-links`
- `@recallnet/remark-lint-docs-taxonomy`
- `@recallnet/remark-lint-docs-freshness`
- `@recallnet/remark-lint-docs-reachability`

## Install

```bash
pnpm add -D @recallnet/docs-governance-preset
pnpm exec recall-docs-governance init --profile repo-docs
pnpm exec recall-docs-governance populate --profile repo-docs
```

Then run:

```bash
pnpm docs:lint
```

`init` creates the canonical structure and config.

`populate` is the deterministic first-pass content generator. It scans repo facts such as
`package.json`, workspace manifests, CI workflows, local hooks, `README.md`, and `AGENTS.md`, then
writes a bounded set of canonical docs and links them into `docs/INDEX.md`.
