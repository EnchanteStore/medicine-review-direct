import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface PdfCheck {
  pageCount: number;
  pages: string[];
}

/** Reads the real PDF pages with poppler. Used to check sections and page breaks. */
export async function readPdf(bytes: Buffer): Promise<PdfCheck> {
  const dir = await mkdtemp(join(tmpdir(), 'mrd-pdf-'));
  const file = join(dir, 'report.pdf');
  try {
    await writeFile(file, bytes);
    const info = await exec('pdfinfo', [file]);
    const count = Number(/Pages:\s+(\d+)/.exec(info.stdout)?.[1] ?? '0');
    const pages: string[] = [];
    for (let page = 1; page <= count; page += 1) {
      const text = await exec('pdftotext', [
        '-f',
        String(page),
        '-l',
        String(page),
        '-layout',
        file,
        '-',
      ]);
      pages.push(text.stdout);
    }
    return { pageCount: count, pages };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Rasterises the first two pages. Returns PNG paths written under `directory`. */
export async function screenshotPdf(
  bytes: Buffer,
  directory: string,
  stem: string,
): Promise<string[]> {
  const dir = await mkdtemp(join(tmpdir(), 'mrd-pdf-'));
  const file = join(dir, 'report.pdf');
  try {
    await writeFile(file, bytes);
    const prefix = join(directory, stem);
    await exec('pdftoppm', ['-png', '-r', '120', '-f', '1', '-l', '2', file, prefix]);
    const first = `${prefix}-1.png`;
    const second = `${prefix}-2.png`;
    const paths = [first];
    try {
      await readFile(second);
      paths.push(second);
    } catch {
      // A one-page render only produces the first image.
    }
    return paths;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
