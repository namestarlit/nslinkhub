import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Deployment image builds copy sources without `.git`; hook setup only
// applies to development clones.
if (!existsSync(".git")) {
  console.log("setup-git-hooks: no .git entry found; skipping hook setup.");
  process.exit(0);
}

const result = spawnSync("git", ["config", "core.hooksPath", "tooling/git-hooks"], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("setup-git-hooks: core.hooksPath set to tooling/git-hooks.");
