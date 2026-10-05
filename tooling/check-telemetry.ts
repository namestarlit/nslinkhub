import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "generated") return [];
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : path.endsWith(".ts") && !/\.(spec|test)\.ts$/.test(path)
        ? [path]
        : [];
  });
}
const violations: string[] = [];
for (const path of sources("apps/api/src")) {
  const text = readFileSync(path, "utf8");
  if (/\bconsole\.(log|info|warn|error|debug|trace)\s*\(|\bnew\s+Logger\s*\(/.test(text))
    violations.push(`${path}: raw logging bypasses the telemetry boundary`);
  if (!path.includes("/common/observability/") && /from\s+["'](@sentry\/|@logtape\/)/.test(text))
    violations.push(`${path}: vendor SDK access belongs inside common/observability`);
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log("Application logging uses the privacy boundary.");
