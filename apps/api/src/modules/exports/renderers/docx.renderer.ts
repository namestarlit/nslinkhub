import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { ExportDocument, ExportLink } from "../export-document";

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

  for (const item of document.items) {
    if (item.kind === "link") {
      children.push(linkParagraph(item));
    } else if (item.kind === "collection_ref") {
      children.push(
        new Paragraph({ children: [new TextRun({ text: item.title, italics: true })] }),
      );
    } else {
      children.push(new Paragraph({ text: item.title, heading: HeadingLevel.HEADING_2 }));
      if (item.description) {
        children.push(new Paragraph({ text: item.description }));
      }
      for (const link of item.links) {
        children.push(linkParagraph(link));
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
