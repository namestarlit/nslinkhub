import { ExportDocument, exportLines } from "../export-document";

function escapeMarkdown(text: string) {
  return text.replace(/[\\`*_{}[\]()#+!<>|]/g, "\\$&").replace(/\r?\n/g, " ");
}
export function renderMarkdown(document: ExportDocument): Buffer {
  const lines = [`# ${escapeMarkdown(document.title)}`, ""];
  if (document.description) lines.push(document.description, "");
  for (const item of exportLines(document)) {
    if (item.kind === "link")
      lines.push(
        `[${escapeMarkdown(item.title)}](<${item.url.replaceAll(">", "%3E").replaceAll("<", "%3C")}>)  `,
      );
    else if (item.kind === "heading")
      lines.push("", `${"#".repeat(item.level)} ${escapeMarkdown(item.title)}`, "");
    else lines.push(escapeMarkdown(item.title), "");
  }
  return Buffer.from(`${lines.join("\n").trimEnd()}\n`, "utf8");
}
