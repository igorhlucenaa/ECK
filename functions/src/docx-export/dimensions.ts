import type { HtmlPdfRenderOptions } from '../shared/pdf-html-renderer.js';
import type { ExportPageConfig } from './types.js';

const PAGE_SIZES_MM: Record<'A4' | 'Letter', { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 216, height: 279 },
};

export function parseMarginMm(value: string, fallback: number): number {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith('mm')) {
    const parsed = Number(trimmed.slice(0, -2));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildExportPageConfig(options: HtmlPdfRenderOptions): ExportPageConfig {
  const base = PAGE_SIZES_MM[options.format] || PAGE_SIZES_MM.A4;
  const widthMm = options.landscape ? base.height : base.width;
  const heightMm = options.landscape ? base.width : base.height;

  const margins = {
    top: parseMarginMm(options.margin.top, 8),
    right: parseMarginMm(options.margin.right, 7),
    bottom: parseMarginMm(options.margin.bottom, 8),
    left: parseMarginMm(options.margin.left, 7),
  };

  return {
    widthMm,
    heightMm,
    margins,
    contentWidthMm: Math.max(1, widthMm - margins.left - margins.right),
    contentHeightMm: Math.max(1, heightMm - margins.top - margins.bottom),
    landscape: options.landscape,
  };
}

export function mmToPx(mm: number, dpi = 96): number {
  return Math.round((mm / 25.4) * dpi);
}

export function scaleToMaxWidth(
  widthPx: number,
  heightPx: number,
  maxWidthPx: number
): { width: number; height: number } {
  if (widthPx <= maxWidthPx) {
    return { width: widthPx, height: heightPx };
  }
  const scale = maxWidthPx / widthPx;
  return {
    width: maxWidthPx,
    height: Math.max(1, Math.round(heightPx * scale)),
  };
}

export function sanitizeDocxFileName(value: unknown): string {
  if (typeof value !== 'string') return 'relatorio-feedback-360.docx';
  const trimmed = value.trim();
  if (!trimmed) return 'relatorio-feedback-360.docx';
  const sanitized = trimmed
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutPdf = sanitized.replace(/\.pdf$/i, '');
  const withExtension = withoutPdf.toLowerCase().endsWith('.docx')
    ? withoutPdf
    : `${withoutPdf}.docx`;
  return withExtension || 'relatorio-feedback-360.docx';
}
