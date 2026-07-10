import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";

// The developer onboarding walkthrough pins the commit it was last verified
// against. This check fails verification when any file the guide references
// changes after that pin, so the guide cannot drift silently. The guide's
// own markdown links define its dependency set. Clear a failure by sweeping
// the guide and moving the pin to the latest commit in a guide-only commit;
// guide-only commits never re-trigger the check.

const guidePath = "docs/guides/developer-onboarding-walkthrough.md";
const guideDirectory = posix.dirname(guidePath);

// Intentional pointers, not restatements: changes here never stale the guide.
const excludedPrefixes = [guidePath, "docs/exec-plans", "CHANGELOG.md"];

// Referenced by content (root-scripts table in Appendix B) without a link.
const implicitDependencies = ["package.json"];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function git(...args: string[]): { status: number | null; stdout: string } {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout ?? "" };
}

const guide = readFileSync(guidePath, "utf8");

const pinMatch = guide.match(/verified against commit `([0-9a-f]{7,40})`/);
if (!pinMatch) {
  fail(`${guidePath} must declare a pin: "verified against commit \`<hash>\`".`);
}
const pin = pinMatch[1];

if (git("rev-parse", "--verify", "--quiet", `${pin}^{commit}`).status !== 0) {
  if (git("rev-parse", "--is-shallow-repository").stdout.trim() === "true") {
    console.log(`Guide pin ${pin} is outside this shallow clone; skipping the guide-pin check.`);
    process.exit(0);
  }
  fail(`Guide pin ${pin} in ${guidePath} is not a commit in this repository.`);
}

if (git("merge-base", "--is-ancestor", pin, "HEAD").status !== 0) {
  fail(`Guide pin ${pin} in ${guidePath} is not an ancestor of HEAD.`);
}

const dependencies = new Set<string>(implicitDependencies);
for (const match of guide.matchAll(/\]\(([^)#?\s]+)\)/g)) {
  const href = match[1];
  if (!href.startsWith("./") && !href.startsWith("../")) {
    continue;
  }

  const resolved = posix.normalize(posix.join(guideDirectory, href));
  if (resolved === "docs" || resolved.startsWith("..")) {
    continue;
  }

  if (
    !excludedPrefixes.some((prefix) => resolved === prefix || resolved.startsWith(`${prefix}/`))
  ) {
    dependencies.add(resolved);
  }
}

const changedFiles = git("diff", "--name-only", pin, "HEAD")
  .stdout.split("\n")
  .filter((line) => line.length > 0);

const staleFiles = changedFiles.filter(
  (file) =>
    !excludedPrefixes.some((prefix) => file === prefix || file.startsWith(`${prefix}/`)) &&
    [...dependencies].some(
      (dependency) => file === dependency || file.startsWith(`${dependency}/`),
    ),
);

if (staleFiles.length > 0) {
  fail(
    [
      `Guide pin ${pin} is stale. Files the walkthrough references changed after the pin:`,
      ...staleFiles.map((file) => `- ${file}`),
      `Sweep ${guidePath} for drift, then move its pin to the latest commit in a guide-only commit.`,
    ].join("\n"),
  );
}

console.log(`Developer onboarding walkthrough pin ${pin} covers all referenced files.`);
