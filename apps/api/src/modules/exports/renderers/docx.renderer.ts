import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { ExportDocument, ExportLink, exportLines } from "../export-document";

function linkParagraph(link: ExportLink): Paragraph {
  return new Paragraph({
    children: [
      new ExternalHyperlink({
        link: link.url,
        children: [new TextRun({ text: link.title, style: "Hyperlink" })],
      }),
    ],
  });
}

export function renderDocx(document: ExportDocument): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: document.title, heading: HeadingLevel.HEADING_1 }),
  ];
  if (document.description) {
    children.push(new Paragraph({ text: document.description }));
  }

  for (const item of exportLines(document)) {
    if (item.kind === "link") children.push(linkParagraph(item));
    else
      children.push(
        new Paragraph({
          text: item.title,
          ...(item.kind === "heading"
            ? { heading: item.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 }
            : {}),
        }),
      );
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
