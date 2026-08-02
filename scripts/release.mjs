#!/usr/bin/env node
// Semi-automated release flow: bump version, tag, push, and publish GitHub
// release notes. The pushed "vX.Y.Z" tag also triggers the container
// workflow (.github/workflows/container.yml), which builds and publishes
// the matching Docker image tags.
import { execSync } from "node:child_process";

const RELEASE_BRANCH = "main";
const VALID_BUMPS = [
  "patch",
  "minor",
  "major",
  "prepatch",
  "preminor",
  "premajor",
  "prerelease",
];

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function capture(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

function fail(message) {
  console.error(`\nrelease: ${message}`);
  process.exit(1);
}

const bump = process.argv[2];
if (!bump) {
  fail(`missing version argument. Usage: npm run release <${VALID_BUMPS.join("|")}|X.Y.Z>`);
}
if (!VALID_BUMPS.includes(bump) && !/^\d+\.\d+\.\d+/.test(bump)) {
  fail(`invalid version argument "${bump}".`);
}

const branch = capture("git rev-parse --abbrev-ref HEAD");
if (branch !== RELEASE_BRANCH) {
  fail(`must be run from "${RELEASE_BRANCH}" (currently on "${branch}").`);
}

if (capture("git status --porcelain")) {
  fail("working directory is not clean. Commit or stash your changes first.");
}

try {
  capture("gh auth status");
} catch {
  fail('GitHub CLI is not authenticated. Run "gh auth login" first.');
}

console.log(`release: fetching latest ${RELEASE_BRANCH} from origin...`);
run(`git fetch origin ${RELEASE_BRANCH}`);
if (capture("git rev-parse HEAD") !== capture(`git rev-parse origin/${RELEASE_BRANCH}`)) {
  fail(`local ${RELEASE_BRANCH} is out of sync with origin/${RELEASE_BRANCH}. Pull or push first.`);
}

console.log(`release: bumping version (${bump})...`);
const tag = capture(`npm version ${bump} -m "chore(release): v%s"`);

console.log(`release: pushing ${RELEASE_BRANCH} and ${tag} to origin...`);
run(`git push origin ${RELEASE_BRANCH}`);
run(`git push origin ${tag}`);

console.log("release: creating GitHub release with auto-generated notes...");
run(`gh release create ${tag} --title ${tag} --generate-notes`);

console.log(`\nrelease: ${tag} published.`);
console.log("release: container image build: https://github.com/panteLx/BetterTracker/actions/workflows/container.yml");
console.log(`release: notes: https://github.com/panteLx/BetterTracker/releases/tag/${tag}`);
