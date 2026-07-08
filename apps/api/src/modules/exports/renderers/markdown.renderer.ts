import { ExportDocument, ExportLink } from "../export-document";

// Link lines end with two spaces (markdown hard break) so consecutive links
// stack like lines in a document rather than merging into one paragraph.
function renderLink(link: ExportLink): string {
  return `[${link.title}](${link.url})  `;
}

export function renderMarkdown(document: ExportDocument): Buffer {
  const lines: string[] = [`# ${document.title}`, ""];
  if (document.description) {
    lines.push(document.description, "");
  }

  for (const item of document.items) {
    if (item.kind === "link") {
      lines.push(renderLink(item));
    } else if (item.kind === "collection_ref") {
      lines.push(`${item.title} _(collection)_  `);
    } else {
      lines.push("", `## ${item.title}`, "");
      if (item.description) {
        lines.push(item.description, "");
      }
      for (const link of item.links) {
        lines.push(renderLink(link));
      }
    }
  }

  return Buffer.from(`${lines.join("\n").trimEnd()}\n`, "utf8");
}
