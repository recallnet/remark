# remark-ai

Docs governance for coding agents.

Not because agents are bad at writing docs.

Because they are bad at curating them.

Agents are great at generating markdown that captures context. They are bad at:

- updating old docs instead of writing new ones
- deleting stale docs instead of preserving them forever
- linking docs into a navigable graph
- keeping metadata consistent and truthful
- noticing when a review date has become fiction

So the failure mode is predictable:

- the docs corpus grows
- confidence stays high
- truth decays
- the next agent reads the wrong thing
- the repo gets slower and more confusing to change

That is the value proposition here:

**if your agents maintain docs under deterministic governance, later agents make better decisions because the repo's knowledge stays structured, reachable, and current enough to trust.**

This repo is not primarily about human docs. Humans benefit, but that is the
side effect. The target is agent behavior.

The job is not to politely remind contributors to clean docs up later. The job
is to make the correct docs behavior the path of least resistance for an agent
operating in a loop of edit, lint, fix, repeat.

Some of that friction is annoying for humans.

That is exactly why it works for agents.

## The Failure Pattern

An agent touches a subsystem and decides to "document it better."

It writes:

- `docs/cache-strategy.md`
- `docs/cache-strategy-v2.md`
- `docs/new-cache-design.md`
- `docs/redis-notes.md`

All four are plausible. Two are already drifting. One is never linked from
anywhere. All still sound authoritative.

Six weeks later, another agent needs to change caching behavior. It reads the
wrong doc first, updates code based on dead assumptions, and writes a fifth
document trying to reconcile the mess.

Tests may still pass. Review may still pass.

The docs tree is what failed.

The problem is not "agents fail to write docs."

The problem is "agents are much better at adding markdown than governing it."

## What This Enforces

This repo gives you simple deterministic tooling that forces agents to do the
annoying but correct things:

- all in-scope markdown docs are structured
- all live docs are catalogued into a rooted graph
- optional review windows expire deterministically
- stale docs fail
- orphan docs fail
- repo policy lives in versioned config, not vibes
- doc paths and filenames match the declared taxonomy

The standard is intentionally harsh:

- if a doc matters, keep it fresh
- if it does not matter enough to keep fresh, make it historical or delete it
- if it is live, it should be reachable from rooted docs
- if it is not reachable, fix the graph or remove the doc

Git history is already the archive.

The live docs tree should describe current reality, not every thought an agent
ever had.

`rm` is a governance feature.

## Why This Is Especially Good For Agents

Humans often resist strict docs governance because it feels nitpicky.

Agents respond well to deterministic rules:

- if frontmatter is missing, fail
- if the doc is orphaned, fail
- if the review date expired, fail
- if the doc is in the wrong place, fail
- if the doc should be deleted, deletion is the shortest path to green

That is the whole design.

Do not hope agents will keep the corpus clean.

Force them to.

## The Bonus: Pair It With codecontext

If `remark-ai` governs the markdown corpus, `codecontext` governs high-risk
edit sites in code.

The combination is much stronger than either tool alone:

- `remark-ai` keeps the docs corpus from becoming stale, orphaned, and
  misleading
- `codecontext` stops agents from making locally-reasonable edits that violate
  hidden constraints
- linked repo-local docs and skills make those constraints actionable at edit
  time

With `codecontext`, an inline `@context` can point at a repo-local skill or
doc:

```ts
// @context decision {@link file:docs/context/cache-invalidation.md} !critical [verified:2026-03-25] — read this before changing invalidation rules
```

That gives agents something much better than passive documentation:

- an interrupt at the exact edit site
- a linked playbook with the longer instruction payload
- linted references
- freshness enforcement when guarded code changes

That is a very agent-native control loop:

1. agent reads code
2. agent hits inline context
3. agent loads linked doc or skill
4. agent edits
5. lint forces the repo back into a governed state

The payoff is not just "better docs."

It is better downstream agent behavior because the knowledge around the code is
curated, connected, and still believable.

## Why remark

Because the remark ecosystem already solved the generic markdown problems:

- frontmatter parsing
- markdown AST construction
- link parsing
- heading and anchor handling
- cross-file link validation

This repo builds on:

- `remark-frontmatter`
- `remark-lint-frontmatter-schema`
- `remark-validate-links`

And only adds the missing governance surface:

- `@recallnet/remark-lint-docs-taxonomy`
- `@recallnet/remark-lint-docs-freshness`
- `@recallnet/remark-lint-docs-reachability`
- `@recallnet/docs-governance-policy`
- `@recallnet/docs-governance-preset`

That is the core design principle:

**use the ecosystem for markdown semantics; add only the smallest novel surface needed to force agents to curate better repo knowledge.**

## Canonical Profile

This repo now treats `repo-docs` as the canonical built-in profile.

That profile standardizes:

- `docs/INDEX.md` as the single rooted entry doc
- `docs/templates/` as the template directory
- snake_case frontmatter such as `doc_type`, `review_policy`, `reviewed`, `written`
- deterministic taxonomy rules for decisions, observations, how-to docs,
  reference docs, explanations, and runbooks

The higher-level `repo-docs` skill should orchestrate this profile rather than
maintain a separate docs schema or folder contract.

## Quick Start

```bash
pnpm add -D @recallnet/docs-governance-preset
pnpm exec recall-docs-governance init --profile repo-docs
pnpm exec recall-docs-governance populate --profile repo-docs
pnpm docs:lint
```

That bootstraps:

- `docs/docs-policy.json`
- `docs/docs-frontmatter.schema.json`
- `.remarkrc.mjs`
- `docs/INDEX.md`
- `docs/templates/*.md`
- docs lint scripts
- `AGENTS.md` guidance for repo contributors

Then `populate` can synthesize first-pass docs from committed repo facts such as:

- root `package.json` scripts
- workspace package manifests
- `.github/workflows/*`
- `.husky/*`
- `README.md`
- `AGENTS.md`

The generator is intentionally bounded. It creates canonical explanation/reference/how-to docs from
repo structure instead of inventing freeform prose.

Recommended config:

```js
import { createDocsGovernanceConfig } from "@recallnet/docs-governance-preset";

export default createDocsGovernanceConfig({
  profile: "repo-docs",
  policyPath: "./docs/docs-policy.json",
  frontmatterSchemaPath: "./docs/docs-frontmatter.schema.json",
});
```

## Recommended Defaults

- active docs default to `periodic-7`
- `docs/INDEX.md` is the canonical root
- `docs/templates/**` is excluded from schema, taxonomy, freshness, and orphan checks
- historical docs should be explicit and rare
- `review_policy` controls freshness and `status` remains lifecycle metadata
- if seven-day review feels too aggressive, the first question should be
  whether the repo has too many active docs

Bias toward:

- fewer docs
- fresher docs
- more links
- more deletion

## Package Roles

- `@recallnet/docs-governance-preset`
  one-command adoption path and CLI
- `@recallnet/docs-governance-policy`
  shared repo policy semantics
- `@recallnet/remark-lint-docs-taxonomy`
  path and filename enforcement for declared doc types
- `@recallnet/remark-lint-docs-freshness`
  review-window enforcement
- `@recallnet/remark-lint-docs-reachability`
  rooted graph and orphan enforcement

## Release Model

- Changesets for versioning
- npmjs trusted publishing through GitHub Actions
- Husky hooks for pre-commit and pre-push gates
- ESLint, Prettier, tests, `jscpd`, and `knip`
- `codecontext` for inline high-risk context

To ship:

- add a `.changeset/*.md`
- commit the package changes and pending changeset
- push to `main`
- let CI version and publish through the repo workflow
