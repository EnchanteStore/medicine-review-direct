import { reportSections, type ReportDocumentModel } from '@mrd/domain';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const BODY = 11;
const LEADING = 15;

function winAnsi(value: string): string {
  return value.replace(/[^\n\r\t\x20-\x7E]/g, '?');
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of winAnsi(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const pieces = splitWide(font, word, size, maxWidth);
      for (const piece of pieces) {
        const next = current ? `${current} ${piece}` : piece;
        if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
          lines.push(current);
          current = piece;
        } else {
          current = next;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function splitWide(font: PDFFont, word: string, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const pieces: string[] = [];
  let rest = word;
  while (rest.length > 0) {
    let take = rest.length;
    while (take > 1 && font.widthOfTextAtSize(rest.slice(0, take), size) > maxWidth) take -= 1;
    pieces.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  return pieces;
}

/** Server-side PDF of the agreed report sections. Multi-page and print-friendly. */
export async function buildReportPdf(model: ReportDocumentModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${model.tradingName} medication review`);
  doc.setCreator(model.tradingName);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const paintFooter = (target: PDFPage, pageNumber: number) => {
    target.drawText('DRAFT pending clinical approval', {
      x: MARGIN,
      y: 28,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    target.drawText(String(pageNumber), {
      x: PAGE_WIDTH - MARGIN - 12,
      y: 28,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
  };

  let pageNumber = 1;
  const nextPage = () => {
    paintFooter(page, pageNumber);
    pageNumber += 1;
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensure = (height: number) => {
    if (y - height < MARGIN + 16) nextPage();
  };

  const drawLines = (lines: string[], used: PDFFont, size: number, gap = LEADING) => {
    for (const line of lines) {
      ensure(gap);
      page.drawText(line, {
        x: MARGIN,
        y: y - size,
        size,
        font: used,
        color: rgb(0.06, 0.14, 0.17),
      });
      y -= gap;
    }
  };

  drawLines(wrap(bold, model.tradingName, 18, maxWidth), bold, 18, 22);
  drawLines(wrap(font, 'Medication review', 13, maxWidth), font, 13, 18);
  y -= 8;

  for (const section of reportSections(model)) {
    ensure(LEADING * 3);
    y -= 8;
    drawLines(wrap(bold, section.title, 13, maxWidth), bold, 13, 18);
    drawLines(wrap(font, section.body, BODY, maxWidth), font, BODY);
  }

  paintFooter(page, pageNumber);
  return doc.save();
}
