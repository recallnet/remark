#!/usr/bin/env node

// @context decision: Release publishes must originate from tarballs created by
// `pnpm pack`, not raw package directories, because pnpm resolves workspace
// dependency ranges during packing while `npm publish .` does not.
//
// @context risk: A successful build is not enough to prove a publishable
// manifest is safe. Inspect the packed `package.json` and hard-fail if any
// runtime dependency still uses `workspace:` so broken artifacts never reach a
// registry again.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag.startsWith("--") || value === undefined) {
      throw new Error(`Invalid arguments: ${argv.slice(2).join(" ")}`);
    }
    args[flag.slice(2)] = value;
    index += 1;
  }
  return args;
}

function findWorkspaceProtocols(value, path = []) {
  if (typeof value === "string") {
    return value.startsWith("workspace:") ? [path.join(".")] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findWorkspaceProtocols(entry, [...path, String(index)]));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) =>
      findWorkspaceProtocols(entry, [...path, key])
    );
  }

  return [];
}

function readPackedManifest(tarballPath) {
  const manifestSource = execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(manifestSource);
}

const args = parseArgs(process.argv);
const manifestPath = resolve(args.manifest);
const outputPath = resolve(args.output);
const tarballDir = resolve(args["tarball-dir"]);

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(tarballDir, { recursive: true });

const releases = JSON.parse(readFileSync(manifestPath, "utf8"));
const packedReleases = releases.map((release) => {
  const packOutput = execFileSync("pnpm", ["pack", "--json", "--pack-destination", tarballDir], {
    cwd: release.directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const packed = JSON.parse(packOutput);
  const tarballPath = packed.filename;
  const packedManifest = readPackedManifest(tarballPath);
  const workspaceFields = findWorkspaceProtocols({
    dependencies: packedManifest.dependencies,
    optionalDependencies: packedManifest.optionalDependencies,
    peerDependencies: packedManifest.peerDependencies,
  });

  if (workspaceFields.length > 0) {
    throw new Error(
      `${release.packageName}@${release.version} packed with unresolved workspace protocol fields: ${workspaceFields.join(", ")}`
    );
  }

  return {
    ...release,
    tarballPath,
  };
});

writeFileSync(outputPath, `${JSON.stringify(packedReleases, null, 2)}\n`);
