import PDFDocument from "pdfkit";
import { ExportDocument, ExportLink } from "../export-document";

const LINK_COLOR = "#1155cc";
const TEXT_COLOR = "#111111";

function writeLink(doc: PDFKit.PDFDocument, link: ExportLink): void {
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(LINK_COLOR)
    .text(link.title, { link: link.url, underline: true });
  doc.moveDown(0.35);
}

export function renderPdf(document: ExportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(20).fillColor(TEXT_COLOR).text(document.title);
    doc.moveDown(0.75);
    if (document.description) {
      doc.font("Helvetica").fontSize(11).fillColor(TEXT_COLOR).text(document.description);
      doc.moveDown(0.75);
    }

    for (const item of document.items) {
      if (item.kind === "link") {
        writeLink(doc, item);
      } else if (item.kind === "collection_ref") {
        doc.font("Helvetica-Oblique").fontSize(11).fillColor(TEXT_COLOR).text(item.title);
        doc.moveDown(0.35);
      } else {
        doc.moveDown(0.5);
        doc.font("Helvetica-Bold").fontSize(15).fillColor(TEXT_COLOR).text(item.title);
        doc.moveDown(0.5);
        if (item.description) {
          doc.font("Helvetica").fontSize(11).fillColor(TEXT_COLOR).text(item.description);
          doc.moveDown(0.5);
        }
        for (const link of item.links) {
          writeLink(doc, link);
        }
      }
    }

    doc.end();
  });
}
