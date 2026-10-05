import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";

function prose(markdown: string): string {
  // Ignore example code: links there describe syntax, not navigation.
  return markdown
    .replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
}
function anchors(markdown: string): Set<string> {
  markdown = markdown.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "");
  const counts = new Map<string, number>();
  const result = new Set<string>();
  for (const match of markdown.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = match[1]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_\- ]/gu, "")
      .replace(/ /g, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    result.add(count ? `${base}-${count}` : base);
  }
  for (const match of markdown.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) result.add(match[1]);
  return result;
}
export function checkMarkdownLinks(root: string, files: string[]): string[] {
  const failures: string[] = [];
  for (const file of files) {
    const content = prose(readFileSync(resolve(root, file), "utf8"));
    const links = [
      ...content.matchAll(/!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\s*\)/g),
      ...content.matchAll(/^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm),
    ];
    for (const link of links) {
      const href = link[1].replace(/^<|>$/g, "");
      if (/^[a-z][\w+.-]*:/i.test(href) || href.startsWith("//")) continue;
      try {
        const [rawPath, rawAnchor] = href.split("#", 2);
        const path = decodeURIComponent(rawPath.split("?")[0]);
        const target = path ? resolve(root, dirname(file), path) : resolve(root, file);
        const rel = relative(root, target);
        if (rel.startsWith("../") || rel === ".." || !existsSync(target)) {
          failures.push(`${file}: missing or outside repository: ${href}`);
          continue;
        }
        if (
          rawAnchor &&
          extname(target) === ".md" &&
          !anchors(readFileSync(target, "utf8")).has(decodeURIComponent(rawAnchor))
        )
          failures.push(`${file}: missing heading: ${href}`);
      } catch {
        failures.push(`${file}: invalid local link: ${href}`);
      }
    }
  }
  return failures;
}
if (import.meta.main) {
  const listed = Bun.spawnSync([
    "git",
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  if (listed.exitCode !== 0) throw new Error("Cannot discover repository documentation");
  const files = [...new Set(listed.stdout.toString().split("\0"))].filter(
    (path) =>
      path.endsWith(".md") && existsSync(path) && !path.startsWith("docs/exec-plans/completed/"),
  );
  const failures = checkMarkdownLinks(process.cwd(), files);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(
    `Local links and heading anchors resolve in ${files.length} current Markdown documents (historical completed plans excluded).`,
  );
}
