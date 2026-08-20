import { createCanvas } from '@napi-rs/canvas';
import sizeOf from 'image-size';
import type { ExportDocumentModel, ExportPageModel, ExportTextLine } from './types.js';
import { DocxExportError } from './errors.js';
import { buildExportPageConfig, mmToPx, scaleToMaxWidth } from './dimensions.js';
import type { HtmlPdfRenderOptions } from '../shared/pdf-html-renderer.js';

const PDF_RENDER_SCALE = 2;

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  fontSize: number;
}

let pdfjsModulePromise: Promise<Record<string, unknown>> | null = null;

async function getPdfJs(): Promise<Record<string, unknown>> {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<Record<string, unknown>>;
  }
  return pdfjsModulePromise;
}

function groupTextIntoLines(items: PdfTextItem[], tolerance = 3): ExportTextLine[] {
  if (items.length === 0) return [];

  const filtered = items
    .map((item) => ({ ...item, str: item.str.replace(/\s+/g, ' ').trim() }))
    .filter((item) => item.str.length > 0);

  filtered.sort((a, b) => {
    if (Math.abs(a.y - b.y) > tolerance) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: ExportTextLine[] = [];
  let current: PdfTextItem[] = [];
  let currentY = filtered[0]?.y ?? 0;

  for (const item of filtered) {
    if (current.length === 0 || Math.abs(item.y - currentY) <= tolerance) {
      current.push(item);
      currentY = item.y;
      continue;
    }

    current.sort((a, b) => a.x - b.x);
    lines.push({
      text: current.map((entry) => entry.str).join(' ').trim(),
      fontSize: Math.max(...current.map((entry) => entry.fontSize)),
    });
    current = [item];
    currentY = item.y;
  }

  if (current.length > 0) {
    current.sort((a, b) => a.x - b.x);
    lines.push({
      text: current.map((entry) => entry.str).join(' ').trim(),
      fontSize: Math.max(...current.map((entry) => entry.fontSize)),
    });
  }

  return lines.filter((line) => line.text.length > 0);
}

async function loadPdfDocument(pdfBuffer: Buffer) {
  const pdfjs = await getPdfJs();
  const getDocument = pdfjs.getDocument as (params: Record<string, unknown>) => { promise: Promise<any> };
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  return loadingTask.promise;
}

async function renderPageToPng(pdfBuffer: Buffer, pageNumber: number, scale: number): Promise<Buffer> {
  const pdfDocument = await loadPdfDocument(pdfBuffer);
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  return canvas.toBuffer('image/png');
}

async function extractPageTextLines(pdfBuffer: Buffer, pageNumber: number): Promise<ExportTextLine[]> {
  const pdfDocument = await loadPdfDocument(pdfBuffer);
  const page = await pdfDocument.getPage(pageNumber);
  const textContent = await page.getTextContent();

  const items: PdfTextItem[] = [];

  for (const rawItem of textContent.items) {
    const item = rawItem as {
      str?: string;
      transform?: number[];
      height?: number;
    };
    if (typeof item.str !== 'string' || !item.str.trim()) continue;

    items.push({
      str: item.str,
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
      fontSize: Math.abs(item.transform?.[3] ?? item.height ?? 12),
    });
  }

  return groupTextIntoLines(items);
}

export async function analyzePdfBuffer(
  pdfBuffer: Buffer,
  options: HtmlPdfRenderOptions,
  fileName: string
): Promise<ExportDocumentModel> {
  try {
    const pageConfig = buildExportPageConfig(options);
    const fullPageWidthPx = mmToPx(pageConfig.widthMm);

    const pdfDocument = await loadPdfDocument(pdfBuffer);
    const totalPages = pdfDocument.numPages;

    const pages: ExportPageModel[] = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const [pngBuffer, textLines] = await Promise.all([
        renderPageToPng(pdfBuffer, pageNumber, PDF_RENDER_SCALE),
        extractPageTextLines(pdfBuffer, pageNumber),
      ]);

      const dimensions = sizeOf(pngBuffer);
      const widthPx = dimensions.width ?? fullPageWidthPx;
      const heightPx = dimensions.height ?? fullPageWidthPx;
      const scaled = scaleToMaxWidth(widthPx, heightPx, fullPageWidthPx);
      const fullPageHeightPx = mmToPx(pageConfig.heightMm);

      pages.push({
        number: pageNumber,
        image: {
          data: pngBuffer,
          widthPx,
          heightPx,
          displayWidthPx: scaled.width,
          displayHeightPx: Math.min(scaled.height, fullPageHeightPx),
        },
        textLines,
      });
    }

    return {
      page: pageConfig,
      pages,
      fileName,
    };
  } catch (error) {
    throw new DocxExportError(
      'PDF_ANALYSIS_FAILED',
      'Falha ao analisar PDF para exportacao DOCX.',
      error
    );
  }
}
