import { launchPuppeteerBrowser } from './puppeteer-browser.js';

export type HtmlPdfRenderOptions = {
  format: 'A4' | 'Letter';
  landscape: boolean;
  scale: number;
  preferCssPageSize: boolean;
  margin: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  docxDocumentChrome?: DocxDocumentChrome;
};

export interface DocxDocumentChrome {
  header?: {
    enabled: boolean;
    leftText: string;
    showPageNumbers: boolean;
    color: string;
    borderBottom: boolean;
  };
  footer?: {
    enabled: boolean;
    text: string;
    showYear: boolean;
    showPageNumbers: boolean;
    color: string;
    borderTop: boolean;
  };
}

function parseDocxDocumentChrome(raw: unknown): DocxDocumentChrome | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  const headerRaw = input.header;
  const footerRaw = input.footer;

  const header = headerRaw && typeof headerRaw === 'object'
    ? {
        enabled: Boolean((headerRaw as Record<string, unknown>).enabled),
        leftText: typeof (headerRaw as Record<string, unknown>).leftText === 'string'
          ? (headerRaw as Record<string, unknown>).leftText as string
          : '',
        showPageNumbers: Boolean((headerRaw as Record<string, unknown>).showPageNumbers),
        color: typeof (headerRaw as Record<string, unknown>).color === 'string'
          ? (headerRaw as Record<string, unknown>).color as string
          : '#666666',
        borderBottom: Boolean((headerRaw as Record<string, unknown>).borderBottom),
      }
    : undefined;

  const footer = footerRaw && typeof footerRaw === 'object'
    ? {
        enabled: Boolean((footerRaw as Record<string, unknown>).enabled),
        text: typeof (footerRaw as Record<string, unknown>).text === 'string'
          ? (footerRaw as Record<string, unknown>).text as string
          : '',
        showYear: Boolean((footerRaw as Record<string, unknown>).showYear),
        showPageNumbers: Boolean((footerRaw as Record<string, unknown>).showPageNumbers),
        color: typeof (footerRaw as Record<string, unknown>).color === 'string'
          ? (footerRaw as Record<string, unknown>).color as string
          : '#666666',
        borderTop: Boolean((footerRaw as Record<string, unknown>).borderTop),
      }
    : undefined;

  if (!header && !footer) return undefined;
  return { header, footer };
}

export function normalizeHtmlPdfOptions(raw: unknown): HtmlPdfRenderOptions {
  const input = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const marginInput = (input.marginMm && typeof input.marginMm === 'object')
    ? (input.marginMm as Record<string, unknown>)
    : {};

  const toMm = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    const clamped = Number.isFinite(parsed) ? Math.min(25, Math.max(3, parsed)) : fallback;
    return `${clamped}mm`;
  };

  const scaleRaw = Number(input.scale);
  const scale = Number.isFinite(scaleRaw) ? Math.min(1, Math.max(0.75, scaleRaw)) : 1;

  const format = input.format === 'Letter' ? 'Letter' : 'A4';

  return {
    format,
    landscape: Boolean(input.landscape),
    scale,
    preferCssPageSize: input.preferCssPageSize !== false,
    margin: {
      top: toMm(marginInput.top, 8),
      right: toMm(marginInput.right, 7),
      bottom: toMm(marginInput.bottom, 8),
      left: toMm(marginInput.left, 7),
    },
    displayHeaderFooter: Boolean(input.displayHeaderFooter),
    headerTemplate: typeof input.headerTemplate === 'string' ? input.headerTemplate : '',
    footerTemplate: typeof input.footerTemplate === 'string' ? input.footerTemplate : '',
    docxDocumentChrome: parseDocxDocumentChrome(input.docxDocumentChrome),
  };
}

export async function createPdfBufferFromHtml(html: string, options: HtmlPdfRenderOptions): Promise<Buffer> {
  if (!html.trim()) {
    throw new Error('HTML do relatorio esta vazio.');
  }

  let browser: { close: () => Promise<void>; newPage: () => Promise<any> } | null = null;

  try {
    browser = await launchPuppeteerBrowser();

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(480000);

    await page.setRequestInterception(true);
    page.on('request', (request: { url: () => string; continue: () => void; abort: () => void }) => {
      const url = request.url();

      if (
        url === 'about:blank' ||
        url.startsWith('data:') ||
        url.startsWith('blob:')
      ) {
        request.continue();
        return;
      }

      request.abort();
    });

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.emulateMediaType('print');
    await Promise.race([
      page.evaluateHandle('document.fonts && document.fonts.ready'),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    await page.waitForFunction(
      () => {
        const flag = (globalThis as { __pdfLayoutReady?: boolean }).__pdfLayoutReady;
        return flag === true;
      },
      { timeout: 20000 }
    ).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 120));

    return Buffer.from(await page.pdf({
      format: options.format,
      landscape: options.landscape,
      scale: options.scale,
      printBackground: true,
      preferCSSPageSize: options.preferCssPageSize,
      margin: options.margin,
      displayHeaderFooter: options.displayHeaderFooter,
      headerTemplate: options.displayHeaderFooter ? (options.headerTemplate || '<span></span>') : '<span></span>',
      footerTemplate: options.displayHeaderFooter ? (options.footerTemplate || '<span></span>') : '<span></span>',
      timeout: 480000,
    }));
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
