import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const COMMON_IMPLEMENTATION_ROOTS = [
  "src",
  "app",
  "apps",
  "services",
  "executors",
  "internal",
  "lib",
  "server",
  "client",
];

function normalizePath(pathValue) {
  return pathValue.replace(/\\/g, "/");
}

function relativePath(cwd, pathValue) {
  return normalizePath(relative(cwd, pathValue));
}

function ensureDirectory(pathValue) {
  mkdirSync(dirname(pathValue), { recursive: true });
}

function readTextIfExists(pathValue) {
  if (!existsSync(pathValue)) {
    return null;
  }

  return readFileSync(pathValue, "utf8");
}

function readJsonIfExists(pathValue) {
  const source = readTextIfExists(pathValue);
  if (!source) {
    return null;
  }

  return JSON.parse(source);
}

function readWorkspacePatterns(cwd, rootPackageJson) {
  const patterns = [];

  if (Array.isArray(rootPackageJson?.workspaces)) {
    patterns.push(...rootPackageJson.workspaces);
  } else if (Array.isArray(rootPackageJson?.workspaces?.packages)) {
    patterns.push(...rootPackageJson.workspaces.packages);
  }

  const pnpmWorkspaceSource = readTextIfExists(resolve(cwd, "pnpm-workspace.yaml"));
  if (pnpmWorkspaceSource) {
    let inPackagesBlock = false;

    for (const line of pnpmWorkspaceSource.split(/\r?\n/u)) {
      const trimmed = line.trim();

      if (!inPackagesBlock) {
        if (trimmed === "packages:") {
          inPackagesBlock = true;
        }
        continue;
      }

      if (trimmed === "" || trimmed.startsWith("#")) {
        continue;
      }

      if (/^\s*-\s+/u.test(line)) {
        const value = line
          .replace(/^\s*-\s+/u, "")
          .trim()
          .replace(/^['"]|['"]$/gu, "");
        if (value) {
          patterns.push(value);
        }
        continue;
      }

      if (!/^\s/u.test(line)) {
        break;
      }
    }
  }

  return [...new Set(patterns.map((pattern) => normalizePath(pattern).replace(/^\.\//u, "")))];
}

function detectPackageManager(cwd, rootPackageJson) {
  if (typeof rootPackageJson?.packageManager === "string") {
    return rootPackageJson.packageManager.split("@")[0];
  }

  if (existsSync(resolve(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (existsSync(resolve(cwd, "package-lock.json"))) {
    return "npm";
  }

  if (existsSync(resolve(cwd, "yarn.lock"))) {
    return "yarn";
  }

  if (existsSync(resolve(cwd, "bun.lockb"))) {
    return "bun";
  }

  return "pnpm";
}

function resolveWorkspaceDirectories(cwd, pattern) {
  const normalizedPattern = normalizePath(pattern).replace(/^\.\//u, "");
  if (!normalizedPattern || normalizedPattern.startsWith("!")) {
    return [];
  }

  const segments = normalizedPattern.split("/").filter(Boolean);
  const matches = [];

  function visit(currentAbsolutePath, currentRelativePath, index) {
    if (index === segments.length) {
      matches.push({
        absolutePath: currentAbsolutePath,
        relativePath: currentRelativePath,
      });
      return;
    }

    const segment = segments[index];

    if (segment === "*") {
      if (!existsSync(currentAbsolutePath)) {
        return;
      }

      for (const entry of readdirSync(currentAbsolutePath, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }

        visit(
          join(currentAbsolutePath, entry.name),
          normalizePath(join(currentRelativePath, entry.name)),
          index + 1
        );
      }
      return;
    }

    const nextAbsolutePath = join(currentAbsolutePath, segment);
    if (!existsSync(nextAbsolutePath)) {
      return;
    }

    visit(nextAbsolutePath, normalizePath(join(currentRelativePath, segment)), index + 1);
  }

  visit(cwd, "", 0);
  return matches;
}

function collectWorkspaceManifests(cwd, workspacePatterns) {
  const fallbackPatterns =
    workspacePatterns.length > 0
      ? workspacePatterns
      : existsSync(resolve(cwd, "packages"))
        ? ["packages/*"]
        : [];
  const manifestMap = new Map();

  for (const pattern of fallbackPatterns) {
    for (const directory of resolveWorkspaceDirectories(cwd, pattern)) {
      const manifestPath = join(directory.absolutePath, "package.json");
      const manifest = readJsonIfExists(manifestPath);
      if (!manifest) {
        continue;
      }

      const pathValue = directory.relativePath;
      manifestMap.set(pathValue, {
        path: pathValue,
        manifestPath: relativePath(cwd, manifestPath),
        name: manifest.name ?? pathValue.split("/").at(-1),
        description: manifest.description ?? "",
        bin: manifest.bin ?? {},
        exports: manifest.exports ?? {},
        dependencies: manifest.dependencies ?? {},
        devDependencies: manifest.devDependencies ?? {},
        optionalDependencies: manifest.optionalDependencies ?? {},
        peerDependencies: manifest.peerDependencies ?? {},
      });
    }
  }

  return [...manifestMap.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function collectFiles(cwd, relativeDir, extensions) {
  const absoluteDir = resolve(cwd, relativeDir);
  if (!existsSync(absoluteDir)) {
    return [];
  }

  return readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.has(extname(entry.name)))
    .map((entry) => normalizePath(join(relativeDir, entry.name)))
    .sort();
}

function collectHookFiles(cwd) {
  const hooksDir = resolve(cwd, ".husky");
  if (!existsSync(hooksDir)) {
    return [];
  }

  return readdirSync(hooksDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => normalizePath(join(".husky", entry.name)))
    .sort();
}

function hasMeaningfulDirectoryEntries(pathValue) {
  return readdirSync(pathValue, { withFileTypes: true }).some(
    (entry) => !entry.name.startsWith(".") && (entry.isDirectory() || entry.isFile())
  );
}

function collectImplementationRoots(cwd, workspacePatterns, workspacePackages) {
  const roots = [];
  const workspacePatternRoots = new Set(
    workspacePatterns.map((pattern) => pattern.split("/").filter(Boolean)[0]).filter(Boolean)
  );
  const candidateRoots = [...new Set([...COMMON_IMPLEMENTATION_ROOTS, ...workspacePatternRoots])];

  for (const rootName of candidateRoots) {
    const absolutePath = resolve(cwd, rootName);
    if (!existsSync(absolutePath) || !hasMeaningfulDirectoryEntries(absolutePath)) {
      continue;
    }

    const workspaceUnitCount = workspacePackages.filter(
      (pkg) => pkg.path === rootName || pkg.path.startsWith(`${rootName}/`)
    ).length;

    roots.push({
      path: rootName,
      kind:
        workspacePatternRoots.has(rootName) || workspaceUnitCount > 0
          ? "workspace-root"
          : "code-root",
      workspaceUnitCount,
    });
  }

  return roots;
}

function extractReadmeSummary(source) {
  if (!source) {
    return null;
  }

  let inFence = false;
  const paragraph = [];

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }

    if (inFence || trimmed === "" || trimmed.startsWith("#")) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    paragraph.push(trimmed);
  }

  return paragraph.length > 0 ? paragraph.join(" ").replace(/\s+/gu, " ") : null;
}

function inferPackageRole(pkg) {
  if (pkg.description) {
    return pkg.description;
  }

  if (Object.keys(pkg.bin).length > 0) {
    return "CLI package.";
  }

  if (Object.keys(pkg.exports).length > 0) {
    return "Library package.";
  }

  return "Workspace package.";
}

function escapeTableCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function formatBullets(values) {
  return values.map((value) => `- ${value}`).join("\n");
}

function formatCodePaths(values) {
  if (values.length === 0) {
    return "code_paths: []";
  }

  return `code_paths:\n${values.map((value) => `  - ${value}`).join("\n")}`;
}

function formatRelatedDocs(values) {
  if (values.length === 0) {
    return "related_docs: []";
  }

  return `related_docs:\n${values.map((value) => `  - ${value}`).join("\n")}`;
}

function createFrontmatter(options) {
  // Keep this canonical field order aligned with createTemplateFrontmatter in templates.js.
  return `---
doc_type: ${options.docType}
id: ${options.id}
title: ${options.title}
owner: ${options.owner ?? "docs-stewards"}
review_policy: ${options.reviewPolicy ?? "codebound"}
reviewed: ${options.today}
status: ${options.status ?? "active"}
summary: ${options.summary}
tags:
${options.tags.map((tag) => `  - ${tag}`).join("\n")}
written: ${options.today}
${formatCodePaths(options.codePaths ?? [])}
${formatRelatedDocs(options.relatedDocs ?? [])}
---
`;
}

function createDocSource(options) {
  return `${createFrontmatter(options)}

# ${options.heading}

${options.body.replace(/^\n+/, "")}
`;
}

function scanRepoFacts(cwd) {
  const rootPackageJson = readJsonIfExists(resolve(cwd, "package.json")) ?? {};
  const packageManager = detectPackageManager(cwd, rootPackageJson);
  const workspacePatterns = readWorkspacePatterns(cwd, rootPackageJson);
  const workspacePackages = collectWorkspaceManifests(cwd, workspacePatterns);
  const implementationRoots = collectImplementationRoots(cwd, workspacePatterns, workspacePackages);
  const workflowFiles = collectFiles(cwd, ".github/workflows", new Set([".yml", ".yaml"]));
  const hookFiles = collectHookFiles(cwd);
  const rootReadmePath = existsSync(resolve(cwd, "README.md")) ? "README.md" : null;
  const rootReadmeSummary = rootReadmePath
    ? extractReadmeSummary(readTextIfExists(resolve(cwd, rootReadmePath)))
    : null;
  const agentsPath = existsSync(resolve(cwd, "AGENTS.md")) ? "AGENTS.md" : null;
  const scripts = rootPackageJson.scripts ?? {};

  const packageNames = new Set(workspacePackages.map((pkg) => pkg.name));
  for (const pkg of workspacePackages) {
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.optionalDependencies,
      ...pkg.peerDependencies,
    };
    pkg.internalDependencies = Object.keys(allDeps)
      .filter((dependencyName) => packageNames.has(dependencyName))
      .sort();
  }

  return {
    rootPackageJson,
    packageManager,
    workspacePatterns,
    workspacePackages,
    implementationRoots,
    workflowFiles,
    hookFiles,
    rootReadmePath,
    rootReadmeSummary,
    agentsPath,
    scripts,
    hasWorkspaces: workspacePatterns.length > 0 || workspacePackages.length > 0,
    hasQualityScripts: ["check", "lint", "test", "build", "docs:lint"].some(
      (name) => name in scripts
    ),
  };
}

function renderArchitectureDoc(facts, today) {
  const intro =
    facts.rootReadmeSummary ??
    rootPackageJsonDescription(facts.rootPackageJson) ??
    "This document summarizes the repo's committed structure, major implementation surfaces, and how to navigate the codebase.";
  const implementationRootBullets =
    facts.implementationRoots.length > 0
      ? facts.implementationRoots.map((root) => {
          const detail =
            root.workspaceUnitCount > 0
              ? `${root.workspaceUnitCount} manifest-backed unit${root.workspaceUnitCount === 1 ? "" : "s"} beneath this root.`
              : "Direct code root without workspace package manifests.";
          return `\`${root.path}/\` — ${detail}`;
        })
      : ["No common implementation roots were detected."];

  const packageBullets =
    facts.workspacePackages.length > 0
      ? facts.workspacePackages.map((pkg) => {
          const relation =
            pkg.internalDependencies.length > 0
              ? ` Depends on ${pkg.internalDependencies.map((value) => `\`${value}\``).join(", ")}.`
              : "";
          return `\`${pkg.name}\` (${pkg.path}) — ${inferPackageRole(pkg)}${relation}`;
        })
      : [
          "No workspace package manifests were detected; the root package is the main implementation surface.",
        ];

  const workspacePatternBullets =
    facts.workspacePatterns.length > 0
      ? formatBullets(facts.workspacePatterns.map((pattern) => `\`${pattern}\``))
      : "- No workspace patterns declared.";

  const body = `${intro}

## Current Shape

- Package manager: \`${facts.packageManager}\`
- Workspace patterns: ${facts.workspacePatterns.length}
- Workspace units with package manifests: ${facts.workspacePackages.length}
- Implementation roots: ${facts.implementationRoots.length}
- CI workflows: ${facts.workflowFiles.length}
- Local hooks: ${facts.hookFiles.length}

## Workspace Roots

${workspacePatternBullets}

## Implementation Roots

${formatBullets(implementationRootBullets)}

## Manifest-Backed Units

${formatBullets(packageBullets)}

## Supporting Sources

- ${facts.rootReadmePath ? `\`${facts.rootReadmePath}\`` : "No root README detected"}
- ${facts.agentsPath ? `\`${facts.agentsPath}\`` : "No AGENTS.md detected"}
- ${
    facts.workspacePackages.length > 0
      ? "Workspace package manifests discovered from declared workspace patterns."
      : "No workspace package manifests detected."
  }

## Reading Order

1. Start with \`docs/INDEX.md\` for the rooted docs graph.
2. Use the implementation reference docs to identify the main code roots and units.
3. Use the commands reference and repo scripts to understand quality gates and local workflows.`;

  return {
    path: "docs/explanation/system-architecture.md",
    source: createDocSource({
      docType: "explanation",
      id: "system-architecture",
      title: "System Architecture",
      summary:
        "Overview of the repo structure, workspace units, and primary implementation surfaces.",
      tags: ["architecture", "repo-map", "workspace"],
      today,
      codePaths: [
        ...(facts.rootReadmePath ? [facts.rootReadmePath] : []),
        ...(facts.agentsPath ? [facts.agentsPath] : []),
        ...facts.implementationRoots.map((root) => root.path),
        ...facts.workspacePackages.map((pkg) => pkg.path),
      ],
      relatedDocs: [
        "../reference/commands-and-quality-gates.md",
        ...(facts.workspacePackages.length > 0 ? ["../reference/workspace-packages.md"] : []),
        ...(facts.implementationRoots.length > 0 ? ["../reference/implementation-roots.md"] : []),
        ...(facts.hasQualityScripts ? ["../how-to/run-local-quality-checks.md"] : []),
      ],
      heading: "System Architecture",
      body,
    }),
    label: "System architecture",
  };
}

function rootPackageJsonDescription(rootPackageJson) {
  return typeof rootPackageJson?.description === "string" && rootPackageJson.description.trim()
    ? rootPackageJson.description.trim()
    : null;
}

function renderCommandsDoc(facts, today) {
  const commandRows = Object.entries(facts.scripts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([name, command]) =>
        `| \`${facts.packageManager} ${name}\` | \`${escapeTableCell(command)}\` |`
    )
    .join("\n");
  const hookBullets =
    facts.hookFiles.length > 0
      ? formatBullets(facts.hookFiles.map((file) => `\`${file}\``))
      : "- No local hook files detected.";
  const workflowBullets =
    facts.workflowFiles.length > 0
      ? formatBullets(facts.workflowFiles.map((file) => `\`${file}\``))
      : "- No CI workflow files detected.";

  const body = `## Root Commands

| Command | Underlying Script |
| --- | --- |
${commandRows || "| [none detected] | [no root scripts] |"}

## Hook Surface

${hookBullets}

## CI Surface

${workflowBullets}

## Notes

- This page is generated from committed repo facts such as \`package.json\`, \`.husky/\`, and \`.github/workflows/\`.
- If a command disappears from source control, regenerate or update this doc instead of preserving stale instructions.`;

  return {
    path: "docs/reference/commands-and-quality-gates.md",
    source: createDocSource({
      docType: "reference",
      id: "commands-and-quality-gates",
      title: "Commands And Quality Gates",
      summary: "Reference for root scripts, hook files, and CI entry points.",
      tags: ["commands", "ci", "quality"],
      today,
      codePaths: ["package.json", ...facts.hookFiles, ...facts.workflowFiles],
      relatedDocs: [
        "../explanation/system-architecture.md",
        ...(facts.hasQualityScripts ? ["../how-to/run-local-quality-checks.md"] : []),
      ],
      heading: "Commands And Quality Gates",
      body,
    }),
    label: "Commands and quality gates",
  };
}

function renderWorkspacePackagesDoc(facts, today) {
  const rows = facts.workspacePackages
    .map((pkg) => {
      const dependencySummary =
        pkg.internalDependencies.length > 0 ? pkg.internalDependencies.join(", ") : "None";
      return `| \`${escapeTableCell(pkg.name)}\` | \`${escapeTableCell(pkg.path)}\` | ${escapeTableCell(
        inferPackageRole(pkg)
      )} | ${escapeTableCell(dependencySummary)} |`;
    })
    .join("\n");

  const body = `## Package Map

| Package | Path | Role | Internal Dependencies |
| --- | --- | --- | --- |
${rows}

## Reading Order

- Start with the package description column for high-level intent.
- Use the dependency column to understand how responsibilities flow across the workspace.
- Fall back to each package's local README when package-specific install or usage details matter.`;

  return {
    path: "docs/reference/workspace-packages.md",
    source: createDocSource({
      docType: "reference",
      id: "workspace-packages",
      title: "Workspace Packages",
      summary: "Reference map for workspace packages, package roles, and internal dependencies.",
      tags: ["packages", "workspace", "reference"],
      today,
      codePaths: facts.workspacePackages.map((pkg) => pkg.path),
      relatedDocs: [
        "../explanation/system-architecture.md",
        "../reference/commands-and-quality-gates.md",
      ],
      heading: "Workspace Packages",
      body,
    }),
    label: "Workspace packages",
  };
}

function renderImplementationRootsDoc(facts, today) {
  const rows = facts.implementationRoots
    .map(
      (root) =>
        `| \`${escapeTableCell(root.path)}/\` | ${escapeTableCell(root.kind)} | ${escapeTableCell(
          root.workspaceUnitCount > 0
            ? `${root.workspaceUnitCount} manifest-backed unit${root.workspaceUnitCount === 1 ? "" : "s"}`
            : "Direct implementation root"
        )} |`
    )
    .join("\n");

  const body = `## Implementation Roots

| Root | Type | Notes |
| --- | --- | --- |
${rows}

## Reading Order

- Start with the roots that contain the repo's main runtime or product logic.
- Use package/unit docs when a root contains manifest-backed workspace units.
- Use local README files or entrypoints under each root when deeper subsystem detail is needed.`;

  return {
    path: "docs/reference/implementation-roots.md",
    source: createDocSource({
      docType: "reference",
      id: "implementation-roots",
      title: "Implementation Roots",
      summary: "Reference map for the repo's primary implementation roots and major code surfaces.",
      tags: ["reference", "repo-map", "structure"],
      today,
      codePaths: facts.implementationRoots.map((root) => root.path),
      relatedDocs: [
        "../explanation/system-architecture.md",
        ...(facts.workspacePackages.length > 0 ? ["./workspace-packages.md"] : []),
        "../reference/commands-and-quality-gates.md",
      ],
      heading: "Implementation Roots",
      body,
    }),
    label: "Implementation roots",
  };
}

function renderHowToDoc(facts, today) {
  const commands = ["check", "lint", "test", "build", "docs:lint"].filter(
    (name) => name in facts.scripts
  );
  const commandBullets =
    commands.length > 0
      ? commands.map((name) => `1. Run \`${facts.packageManager} ${name}\`.`).join("\n")
      : "1. Run the repo's equivalent validation commands before pushing changes.";

  const body = `## Prerequisites

- the repo's package manager installed locally (\`${facts.packageManager}\`)
- dependencies installed

## Steps

${commandBullets}

## Verification

- local commands exit successfully
- CI-relevant checks match the source-controlled scripts and workflow files
- docs changes stay green under \`${facts.packageManager} docs:lint\` when that script exists

## Troubleshooting

- If \`docs:lint\` is missing, re-run \`recall-docs-governance init --profile repo-docs\`.
- If local hooks fail, inspect the corresponding file under \`.husky/\` before bypassing the check.`;

  return {
    path: "docs/how-to/run-local-quality-checks.md",
    source: createDocSource({
      docType: "how-to",
      id: "run-local-quality-checks",
      title: "Run Local Quality Checks",
      summary: "Repeatable local workflow for running the repo's scripted validation checks.",
      tags: ["how-to", "quality", "workflow"],
      today,
      codePaths: ["package.json", ...facts.hookFiles],
      relatedDocs: [
        "../reference/commands-and-quality-gates.md",
        "../explanation/system-architecture.md",
      ],
      heading: "Run Local Quality Checks",
      body,
    }),
    label: "Run local quality checks",
  };
}

function planPopulateDocs(facts, today) {
  const docs = [];

  docs.push(renderArchitectureDoc(facts, today));

  if (
    Object.keys(facts.scripts).length > 0 ||
    facts.hookFiles.length > 0 ||
    facts.workflowFiles.length > 0
  ) {
    docs.push(renderCommandsDoc(facts, today));
  }

  if (facts.workspacePackages.length > 0) {
    docs.push(renderWorkspacePackagesDoc(facts, today));
  }

  if (facts.implementationRoots.length > 0) {
    docs.push(renderImplementationRootsDoc(facts, today));
  }

  if (facts.hasQualityScripts || facts.hookFiles.length > 0) {
    docs.push(renderHowToDoc(facts, today));
  }

  return docs;
}

function createIndexStartHereSection(links) {
  return `## Start Here

${links.map((link) => `- [${link.label}](${link.path})`).join("\n")}`;
}

function upsertIndexLinks(currentSource, links) {
  const sectionSource = createIndexStartHereSection(links);
  if (!currentSource.includes("## Start Here")) {
    return {
      source: `${currentSource.replace(/\s*$/, "")}\n\n${sectionSource}\n`,
      warning: null,
    };
  }

  const sectionPattern = /## Start Here\n\n([\s\S]*?)(?=\n## |\s*$)/;
  const match = currentSource.match(sectionPattern);
  if (!match) {
    return {
      source: currentSource,
      warning:
        "Index contains '## Start Here' but it is not formatted as a managed section. Populate could not add generated links automatically.",
    };
  }

  const existingBlock = match[1].trimEnd();
  const missingLines = links
    .map((link) => `- [${link.label}](${link.path})`)
    .filter((line) => !existingBlock.includes(line));

  if (missingLines.length === 0) {
    return { source: currentSource, warning: null };
  }

  const nextBlock = `${existingBlock}\n${missingLines.join("\n")}`;
  return {
    source: currentSource.replace(sectionPattern, `## Start Here\n\n${nextBlock}\n`),
    warning: null,
  };
}

function writeManagedFile(pathValue, contents, options = {}) {
  const exists = existsSync(pathValue);
  const allowUpdate = options.allowUpdate === true;

  if (exists && options.force !== true && !allowUpdate) {
    return "skipped";
  }

  if (options.dryRun !== true) {
    ensureDirectory(pathValue);
    writeFileSync(pathValue, contents, "utf8");
  }

  return exists ? "updated" : "created";
}

export function populateDocsGovernanceRepo(options = {}) {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const profile = options.profile ?? "repo-docs";
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const docsDir = resolve(cwd, "docs");
  const indexPath = resolve(cwd, "docs", "INDEX.md");

  if (!existsSync(docsDir) || !existsSync(indexPath)) {
    throw new Error(
      "Docs governance is not initialized for this repo. Run 'recall-docs-governance init --profile repo-docs' first."
    );
  }

  const facts = scanRepoFacts(cwd);
  const plan = planPopulateDocs(facts, today);

  const created = [];
  const updated = [];
  const skipped = [];
  const warnings = [];

  // @context decision !high [verified:2026-03-27] — Populate is intentionally bounded by repo facts.
  // It should synthesize first-pass docs from committed structure, not invent deep subsystem intent.
  for (const doc of plan) {
    const status = writeManagedFile(resolve(cwd, doc.path), doc.source, options);
    if (status === "created") {
      created.push(doc.path);
    } else if (status === "updated") {
      updated.push(doc.path);
    } else {
      skipped.push(doc.path);
    }
  }

  const indexSource = readFileSync(indexPath, "utf8");
  const { source: nextIndexSource, warning: indexWarning } = upsertIndexLinks(
    indexSource,
    plan.map((doc) => ({
      label: doc.label,
      path: `./${relativePath(resolve(cwd, "docs"), resolve(cwd, doc.path)).replace(/^\.\//, "")}`,
    }))
  );

  if (indexWarning) {
    warnings.push(indexWarning);
  }

  if (nextIndexSource !== indexSource) {
    const indexStatus = writeManagedFile(indexPath, nextIndexSource, {
      ...options,
      allowUpdate: true,
    });
    if (indexStatus === "created") {
      created.push("docs/INDEX.md");
    } else if (indexStatus === "updated") {
      updated.push("docs/INDEX.md");
    } else {
      skipped.push("docs/INDEX.md");
    }
  }

  if (options.dryRun === true) {
    return {
      cwd,
      profile,
      dryRun: true,
      wouldCreate: created,
      wouldUpdate: updated,
      wouldSkip: skipped,
      warnings,
    };
  }

  return {
    cwd,
    profile,
    dryRun: false,
    created,
    updated,
    skipped,
    warnings,
  };
}
