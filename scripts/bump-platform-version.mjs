/**
 * Bump Cubicle platform patch version (x.y.Z → x.y.Z+1).
 * Syncs package.json + lib/app-version.ts.
 *
 * Usage:
 *   node scripts/bump-platform-version.mjs
 *   node scripts/bump-platform-version.mjs --major | --minor | --patch
 *
 * Env:
 *   SKIP_VERSION_BUMP=1  — no-op (useful for CI/docs-only workflows)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
const versionPath = join(root, "lib", "app-version.ts");

if (process.env.SKIP_VERSION_BUMP === "1") {
  console.log("SKIP_VERSION_BUMP=1 — version unchanged");
  process.exit(0);
}

const args = new Set(process.argv.slice(2));
const kind = args.has("--major")
  ? "major"
  : args.has("--minor")
    ? "minor"
    : "patch";

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = String(pkg.version || "0.0.0");
const parts = current.split(".").map((n) => Number.parseInt(n, 10));
if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
  console.error(`Invalid version in package.json: ${current}`);
  process.exit(1);
}

let [major, minor, patch] = parts;
if (kind === "major") {
  major += 1;
  minor = 0;
  patch = 0;
} else if (kind === "minor") {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const next = `${major}.${minor}.${patch}`;
pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

const versionTs = [
  "/**",
  " * Platform version - auto-bumped by git pre-commit (scripts/bump-platform-version.mjs).",
  " * Displayed next to the navbar wordmark.",
  " */",
  `export const APP_VERSION = "${next}";`,
  "",
  "/** Label shown in UI, e.g. v0.1.0 */",
  "export const APP_VERSION_LABEL = `v${APP_VERSION}`;",
  "",
].join("\n");
writeFileSync(versionPath, versionTs, "utf8");

console.log(`Platform version: ${current} → ${next}`);
