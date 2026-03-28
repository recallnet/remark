import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  createDocsGovernanceConfig,
  initDocsGovernanceRepo,
  lintDocsGovernance,
  populateDocsGovernanceRepo,
} from "../src/index.js";

const cliPath = new URL("../src/cli.js", import.meta.url);

function initLintRepo() {
  const repoDir = mkdtempSync(join(tmpdir(), "docs-governance-lint-"));
  mkdirSync(join(repoDir, "docs"), { recursive: true });
  writeFileSync(
    join(repoDir, "package.json"),
    JSON.stringify({ name: "fixture", private: true, scripts: {} }, null, 2)
  );
  initDocsGovernanceRepo({ cwd: repoDir, today: "2026-03-25", profile: "repo-docs" });
  return repoDir;
}

function installFakeRemark(repoDir, scriptSource) {
  const binDir = join(repoDir, "node_modules", ".bin");
  mkdirSync(binDir, { recursive: true });
  const binaryPath = join(binDir, "remark");
  writeFileSync(binaryPath, scriptSource, "utf8");
  chmodSync(binaryPath, 0o755);
  return binaryPath;
}

test("createDocsGovernanceConfig wires the expected plugin stack", () => {
  const config = createDocsGovernanceConfig({ profile: "repo-docs" });

  assert.equal(Array.isArray(config.plugins), true);
  assert.equal(config.plugins.length, 6);
  assert.equal(config.profile, "repo-docs");
});

test("initDocsGovernanceRepo writes repo-docs profile files, templates, and package scripts", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "docs-governance-preset-"));
  mkdirSync(join(repoDir, "docs"), { recursive: true });
  writeFileSync(
    join(repoDir, "package.json"),
    JSON.stringify({ name: "fixture", private: true, scripts: {} }, null, 2)
  );

  const result = initDocsGovernanceRepo({
    cwd: repoDir,
    today: "2026-03-25",
    profile: "repo-docs",
  });

  assert.match(readFileSync(join(repoDir, ".remarkrc.mjs"), "utf8"), /profile: "repo-docs"/);
  assert.match(readFileSync(join(repoDir, "docs", "INDEX.md"), "utf8"), /reviewed: 2026-03-25/);
  assert.match(
    readFileSync(join(repoDir, "docs", "docs-frontmatter.schema.json"), "utf8"),
    /"deprecated"/
  );
  assert.match(
    readFileSync(join(repoDir, "docs", "docs-policy.json"), "utf8"),
    /"profile": "repo-docs"/
  );
  assert.match(
    readFileSync(join(repoDir, "package.json"), "utf8"),
    /"docs:lint": "recall-docs-governance lint"/
  );
  assert.equal(result.created.includes("docs/docs-policy.json"), true);
  assert.equal(result.created.includes("docs/templates/decision.md"), true);
  assert.equal(result.profile, "repo-docs");
});

test("repo-docs templates use canonical frontmatter field names", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "docs-governance-templates-"));
  mkdirSync(join(repoDir, "docs"), { recursive: true });

  initDocsGovernanceRepo({ cwd: repoDir, today: "2026-03-25", profile: "repo-docs" });

  const template = readFileSync(join(repoDir, "docs", "templates", "decision.md"), "utf8");

  assert.match(template, /doc_type: decision/);
  assert.match(template, /code_paths: \[\]/);
  assert.match(template, /related_docs: \[\]/);
  assert.doesNotMatch(template, /docType:/);
  assert.doesNotMatch(template, /codePaths:/);
});

test("lintDocsGovernance can lint a repo-docs profile fixture end-to-end", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "docs-governance-lint-"));
  mkdirSync(join(repoDir, "docs"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repoDir });
  execFileSync("git", ["remote", "add", "origin", "https://github.com/example/docs-fixture.git"], {
    cwd: repoDir,
  });
  initDocsGovernanceRepo({ cwd: repoDir, today: "2026-03-25", profile: "repo-docs" });
  writeFileSync(
    join(repoDir, ".remarkrc.mjs"),
    `import { createDocsGovernanceConfig } from ${JSON.stringify(
      pathToFileURL(resolve(process.cwd(), "packages/docs-governance-preset/src/index.js")).href
    )};

export default createDocsGovernanceConfig({
  profile: "repo-docs",
  policyPath: "./docs/docs-policy.json",
  frontmatterSchemaPath: "./docs/docs-frontmatter.schema.json",
  schemaPatterns: ["docs/"]
});
`
  );
  writeFileSync(
    join(repoDir, "docs", "decisions", "001-test-decision.md"),
    `---\ndoc_type: decision\nowner: docs-stewards\nreview_policy: periodic-7\nreviewed: 2026-03-25\nstatus: draft\nsummary: Decision summary.\ntags:\n  - docs\n  - decision\nwritten: 2026-03-25\nid: test-decision\ntitle: Test Decision\ncode_paths: []\nrelated_docs: []\n---\n\n# ADR-001: Test Decision\n`
  );
  writeFileSync(
    join(repoDir, "docs", "INDEX.md"),
    `---\ndoc_type: index\nowner: docs-stewards\nreview_policy: generated\nreviewed: 2026-03-25\nstatus: active\nsummary: Root.\ntags:\n  - docs\n  - index\nwritten: 2026-03-25\nid: docs-index\ntitle: Docs Index\ncode_paths: []\nrelated_docs: []\n---\n\n# Docs Index\n\n- [Decision](./decisions/001-test-decision.md)\n`
  );

  const result = lintDocsGovernance({ cwd: repoDir });
  assert.equal(result.status, 0);
  assert.deepEqual(result.files, ["docs/decisions/001-test-decision.md", "docs/INDEX.md"]);
});

test("lintDocsGovernance does not depend on remark-cli/package.json exports", () => {
  const repoDir = initLintRepo();
  writeFileSync(
    join(repoDir, "docs", "docs-policy.json"),
    JSON.stringify(
      {
        "docs_policy/v1": {
          profile: "repo-docs",
          in_scope_paths: [],
        },
      },
      null,
      2
    )
  );

  const result = lintDocsGovernance({ cwd: repoDir });

  assert.deepEqual(result, { status: 0, files: [] });
});

test("lintDocsGovernance --changed ignores non-doc git changes", () => {
  const repoDir = initLintRepo();
  writeFileSync(
    join(repoDir, "docs", "keep.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Keep\n"
  );
  writeFileSync(
    join(repoDir, "docs", "skip.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Skip\n"
  );

  execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: repoDir,
    stdio: "ignore",
  });
  execFileSync("git", ["add", "."], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], {
    cwd: repoDir,
    stdio: "ignore",
  });

  writeFileSync(
    join(repoDir, "package.json"),
    JSON.stringify({ name: "fixture", private: true, scripts: { test: "node --test" } }, null, 2)
  );

  const result = lintDocsGovernance({ cwd: repoDir, changed: true });

  assert.deepEqual(result, { status: 0, files: [] });
});

test("lintDocsGovernance --changed uses staged git diff by default", () => {
  const repoDir = initLintRepo();
  const argvPath = join(repoDir, "remark-argv.json");
  installFakeRemark(
    repoDir,
    `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
writeFileSync(${JSON.stringify(argvPath)}, JSON.stringify(process.argv.slice(2)));
`
  );
  writeFileSync(
    join(repoDir, "docs", "keep.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Keep\n"
  );
  writeFileSync(
    join(repoDir, "docs", "skip.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Skip\n"
  );

  execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: repoDir,
    stdio: "ignore",
  });
  execFileSync("git", ["add", "."], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], {
    cwd: repoDir,
    stdio: "ignore",
  });

  writeFileSync(
    join(repoDir, "docs", "keep.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Keep staged\n"
  );
  writeFileSync(
    join(repoDir, "docs", "skip.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Skip unstaged\n"
  );
  execFileSync("git", ["add", "docs/keep.md"], { cwd: repoDir, stdio: "ignore" });
  writeFileSync(
    join(repoDir, "docs", "skip.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Skip unstaged twice\n"
  );

  const result = lintDocsGovernance({ cwd: repoDir, changed: true });

  assert.deepEqual(result, { status: 0, files: ["docs/keep.md"] });
  assert.deepEqual(JSON.parse(readFileSync(argvPath, "utf8")), ["docs/keep.md", "--frail"]);
});

test("lintDocsGovernance accepts explicit file lists", () => {
  const repoDir = initLintRepo();
  const argvPath = join(repoDir, "remark-argv.json");
  installFakeRemark(
    repoDir,
    `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
writeFileSync(${JSON.stringify(argvPath)}, JSON.stringify(process.argv.slice(2)));
`
  );
  writeFileSync(
    join(repoDir, "docs", "keep.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Keep\n"
  );
  writeFileSync(join(repoDir, "README.md"), "# Root\n");

  const result = lintDocsGovernance({
    cwd: repoDir,
    files: ["docs/keep.md", "README.md"],
  });

  assert.deepEqual(result, { status: 0, files: ["docs/keep.md"] });
  assert.deepEqual(JSON.parse(readFileSync(argvPath, "utf8")), ["docs/keep.md", "--frail"]);
});

test("cli returns exit code 2 for tool crashes", () => {
  const repoDir = initLintRepo();
  installFakeRemark(
    repoDir,
    `#!/usr/bin/env node
process.stderr.write("docs/file.md\\n  error Cannot process file\\n");
process.exit(1);
`
  );
  writeFileSync(
    join(repoDir, "docs", "file.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# File\n"
  );
  writeFileSync(join(repoDir, "docs-file-list.txt"), "docs/file.md\n");

  let error;
  try {
    execFileSync(
      "node",
      [cliPath.pathname, "lint", "--dir", repoDir, "--files-from", "docs-file-list.txt"],
      {
        cwd: repoDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );
  } catch (caught) {
    error = caught;
  }

  assert.equal(error.status, 2);
  assert.match(error.stderr, /\[docs-governance\] fatal=/);
});

test("cli quiet mode suppresses clean-file noise and prints summary", () => {
  const repoDir = initLintRepo();
  installFakeRemark(
    repoDir,
    `#!/usr/bin/env node
process.stdout.write("\\u001B[4m\\u001B[32mdocs/clean.md\\u001B[39m\\u001B[24m: no issues found\\n");
process.stdout.write("\\u001B[4m\\u001B[33mdocs/bad.md\\u001B[39m\\u001B[24m\\n");
process.stderr.write(" warning broken link\\n");
process.exit(1);
`
  );
  const fileListPath = join(repoDir, "docs-file-list.txt");
  writeFileSync(fileListPath, "docs/clean.md\ndocs/bad.md\n");
  writeFileSync(
    join(repoDir, "docs", "clean.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Clean\n"
  );
  writeFileSync(
    join(repoDir, "docs", "bad.md"),
    "---\nreview_policy: historical\nreviewed: 2026-03-25\n---\n\n# Bad\n"
  );

  let error;
  try {
    execFileSync(
      "node",
      [cliPath.pathname, "lint", "--dir", repoDir, "--files-from", "docs-file-list.txt", "--quiet"],
      {
        cwd: repoDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );
  } catch (caught) {
    error = caught;
  }

  assert.equal(error.status, 1);
  assert.doesNotMatch(error.stdout, /no issues found/);
  assert.match(error.stdout, /docs\/bad\.md/);
  assert.match(error.stdout, /\[docs-governance\] summary files=2 status=issues/);
});

test("populateDocsGovernanceRepo writes first-pass docs and updates the index", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "docs-governance-populate-"));
  mkdirSync(join(repoDir, "docs"), { recursive: true });
  mkdirSync(join(repoDir, ".github", "workflows"), { recursive: true });
  mkdirSync(join(repoDir, ".husky"), { recursive: true });
  mkdirSync(join(repoDir, "packages", "alpha"), { recursive: true });
  mkdirSync(join(repoDir, "packages", "beta"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repoDir });
  execFileSync(
    "git",
    ["remote", "add", "origin", "https://github.com/example/populate-fixture.git"],
    {
      cwd: repoDir,
    }
  );
  writeFileSync(
    join(repoDir, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        private: true,
        packageManager: "pnpm@10.32.1",
        workspaces: ["packages/*"],
        scripts: {
          lint: "eslint .",
          test: "node --test packages/*/test/*.test.js",
          build: "node scripts/check-exports.mjs",
          "docs:lint": "recall-docs-governance lint",
          check: "pnpm lint && pnpm test && pnpm build",
        },
      },
      null,
      2
    )
  );
  writeFileSync(join(repoDir, "README.md"), "# Fixture\n\nA fixture repo.\n");
  writeFileSync(join(repoDir, "AGENTS.md"), "# AGENTS\n");
  writeFileSync(join(repoDir, ".github", "workflows", "ci.yml"), "name: ci\n");
  writeFileSync(join(repoDir, ".husky", "pre-commit"), "pnpm lint\n");
  writeFileSync(
    join(repoDir, "packages", "alpha", "package.json"),
    JSON.stringify(
      {
        name: "@fixture/alpha",
        description: "Alpha package.",
        dependencies: { "@fixture/beta": "workspace:*" },
      },
      null,
      2
    )
  );
  writeFileSync(
    join(repoDir, "packages", "beta", "package.json"),
    JSON.stringify(
      {
        name: "@fixture/beta",
        description: "Beta package.",
      },
      null,
      2
    )
  );

  initDocsGovernanceRepo({ cwd: repoDir, today: "2026-03-25", profile: "repo-docs" });
  writeFileSync(
    join(repoDir, ".remarkrc.mjs"),
    `import { createDocsGovernanceConfig } from ${JSON.stringify(
      pathToFileURL(resolve(process.cwd(), "packages/docs-governance-preset/src/index.js")).href
    )};

export default createDocsGovernanceConfig({
  profile: "repo-docs",
  policyPath: "./docs/docs-policy.json",
  frontmatterSchemaPath: "./docs/docs-frontmatter.schema.json",
  schemaPatterns: ["docs/"]
});
`
  );

  const result = populateDocsGovernanceRepo({
    cwd: repoDir,
    today: "2026-03-25",
    profile: "repo-docs",
  });

  assert.equal(result.created.includes("docs/explanation/system-architecture.md"), true);
  assert.equal(result.created.includes("docs/reference/commands-and-quality-gates.md"), true);
  assert.equal(result.created.includes("docs/reference/workspace-packages.md"), true);
  assert.equal(result.created.includes("docs/how-to/run-local-quality-checks.md"), true);

  const indexSource = readFileSync(join(repoDir, "docs", "INDEX.md"), "utf8");
  assert.match(indexSource, /System architecture/);
  assert.match(indexSource, /Workspace packages/);

  const packagesSource = readFileSync(
    join(repoDir, "docs", "reference", "workspace-packages.md"),
    "utf8"
  );
  assert.match(packagesSource, /@fixture\/alpha/);
  assert.match(packagesSource, /@fixture\/beta/);

  const lintResult = lintDocsGovernance({ cwd: repoDir });
  assert.equal(lintResult.status, 0);
});

test("populateDocsGovernanceRepo supports dry-run without writing docs", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "docs-governance-populate-dry-run-"));
  mkdirSync(join(repoDir, "docs"), { recursive: true });
  writeFileSync(
    join(repoDir, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        private: true,
        packageManager: "pnpm@10.32.1",
        scripts: {
          lint: "eslint .",
        },
      },
      null,
      2
    )
  );

  initDocsGovernanceRepo({ cwd: repoDir, today: "2026-03-25", profile: "repo-docs" });

  const result = populateDocsGovernanceRepo({
    cwd: repoDir,
    today: "2026-03-25",
    profile: "repo-docs",
    dryRun: true,
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.wouldCreate.includes("docs/explanation/system-architecture.md"), true);
  assert.equal(existsSync(join(repoDir, "docs", "explanation", "system-architecture.md")), false);
});

test("populateDocsGovernanceRepo keeps sparse repos bounded", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "docs-governance-populate-minimal-"));
  mkdirSync(join(repoDir, "docs"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repoDir });
  execFileSync(
    "git",
    ["remote", "add", "origin", "https://github.com/example/minimal-fixture.git"],
    {
      cwd: repoDir,
    }
  );

  initDocsGovernanceRepo({ cwd: repoDir, today: "2026-03-25", profile: "repo-docs" });
  writeFileSync(
    join(repoDir, ".remarkrc.mjs"),
    `import { createDocsGovernanceConfig } from ${JSON.stringify(
      pathToFileURL(resolve(process.cwd(), "packages/docs-governance-preset/src/index.js")).href
    )};

export default createDocsGovernanceConfig({
  profile: "repo-docs",
  policyPath: "./docs/docs-policy.json",
  frontmatterSchemaPath: "./docs/docs-frontmatter.schema.json",
  schemaPatterns: ["docs/"]
});
`
  );

  const result = populateDocsGovernanceRepo({
    cwd: repoDir,
    today: "2026-03-25",
    profile: "repo-docs",
  });

  assert.deepEqual(result.created, ["docs/explanation/system-architecture.md"]);
  assert.deepEqual(result.updated, ["docs/INDEX.md"]);
  assert.deepEqual(result.warnings, []);
  assert.equal(
    existsSync(join(repoDir, "docs", "reference", "commands-and-quality-gates.md")),
    false
  );
  assert.equal(existsSync(join(repoDir, "docs", "reference", "workspace-packages.md")), false);
  assert.equal(existsSync(join(repoDir, "docs", "how-to", "run-local-quality-checks.md")), false);

  const architectureSource = readFileSync(
    join(repoDir, "docs", "explanation", "system-architecture.md"),
    "utf8"
  );
  assert.match(architectureSource, /does not expose workspace packages/);

  const lintResult = lintDocsGovernance({ cwd: repoDir });
  assert.equal(lintResult.status, 0);
});

test("populateDocsGovernanceRepo reports an unmanaged Start Here section", () => {
  const repoDir = mkdtempSync(join(tmpdir(), "docs-governance-populate-index-warning-"));
  mkdirSync(join(repoDir, "docs"), { recursive: true });
  writeFileSync(
    join(repoDir, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        private: true,
        scripts: {
          lint: "eslint .",
        },
      },
      null,
      2
    )
  );

  initDocsGovernanceRepo({ cwd: repoDir, today: "2026-03-25", profile: "repo-docs" });
  writeFileSync(
    join(repoDir, "docs", "INDEX.md"),
    `---\ndoc_type: index\nid: docs-index\ntitle: Docs Index\nowner: docs-stewards\nreview_policy: generated\nreviewed: 2026-03-25\nstatus: active\nsummary: Root.\ntags:\n  - docs\n  - index\nwritten: 2026-03-25\ncode_paths: []\nrelated_docs: []\n---\n\n# Docs Index\n\n## Start Here\n- hand-edited section\n`
  );

  const result = populateDocsGovernanceRepo({
    cwd: repoDir,
    today: "2026-03-25",
    profile: "repo-docs",
    dryRun: true,
  });

  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /managed section/);
});
