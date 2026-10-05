import { expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkMarkdownLinks } from "./check-docs";

it("checks inline/reference/heading links while ignoring fenced examples and external URLs", () => {
  const root = mkdtempSync(join(tmpdir(), "docs-check-"));
  try {
    writeFileSync(join(root, "target.md"), "# Heading\n# Heading\n```md\n# Example only\n```\n");
    writeFileSync(
      join(root, "readme.md"),
      [
        "[valid](target.md#heading-1)",
        "[external](https://example.invalid)",
        "```md",
        "[example](missing.md)",
        "```",
        "[ref]: target.md#heading",
      ].join("\n"),
    );
    expect(checkMarkdownLinks(root, ["readme.md"])).toEqual([]);
    writeFileSync(
      join(root, "readme.md"),
      "[bad](missing.md)\n[bad anchor](target.md#example-only)\n[ref]: ../outside.md",
    );
    expect(checkMarkdownLinks(root, ["readme.md"])).toHaveLength(3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
