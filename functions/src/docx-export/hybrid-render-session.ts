import sizeOf from 'image-size';
import type { HtmlPdfRenderOptions } from '../shared/pdf-html-renderer.js';
import { launchPuppeteerBrowser } from '../shared/puppeteer-browser.js';
import { DocxExportError } from './errors.js';

export interface CapturedElementImage {
  data: Buffer;
  widthPx: number;
  heightPx: number;
}

export interface HybridRenderSessionResult {
  pdfBuffer: Buffer;
  pdfPageCount: number;
  captures: Map<string, CapturedElementImage>;
}

async function loadPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as Record<string, unknown>;
  const getDocument = pdfjs.getDocument as (params: Record<string, unknown>) => { promise: Promise<{ numPages: number }> };
  const document = await getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;
  return document.numPages;
}

async function prepareBrowserPage(html: string, _options: HtmlPdfRenderOptions) {
  const browser = await launchPuppeteerBrowser();

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(480000);

  await page.setRequestInterception(true);
  page.on('request', (request: { url: () => string; continue: () => void; abort: () => void }) => {
    const url = request.url();
    if (url === 'about:blank' || url.startsWith('data:') || url.startsWith('blob:')) {
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
  await new Promise((resolve) => setTimeout(resolve, 500));

  return { browser, page };
}

export async function runHybridRenderSession(
  html: string,
  options: HtmlPdfRenderOptions,
  captureSelectors: string[]
): Promise<HybridRenderSessionResult> {
  if (!html.trim()) {
    throw new DocxExportError('PDF_RENDER_FAILED', 'HTML do relatorio esta vazio.');
  }

  let browser: { close: () => Promise<void> } | null = null;

  try {
    const { browser: launchedBrowser, page } = await prepareBrowserPage(html, options);
    browser = launchedBrowser;

    const captures = new Map<string, CapturedElementImage>();
    const uniqueSelectors = [...new Set(captureSelectors.filter(Boolean))];

    for (const selector of uniqueSelectors) {
      const handle = await page.$(selector);
      if (!handle) {
        console.warn('[docx-export:hybrid-render] Elemento nao encontrado para captura', { selector });
        continue;
      }

      await handle.evaluate((element: Element) => {
        element.scrollIntoView({ block: 'center', inline: 'nearest' });
      });
      await new Promise((resolve) => setTimeout(resolve, 80));

      if (selector.includes('data-docx-capture-id')) {
        await page.evaluate((captureSelector: string) => {
          const target = document.querySelector(captureSelector) as HTMLElement | null;
          if (!target) return;

          const reportTableSelector =
            '.tabela-frequencia, .tabela-distribuicao-notas, .tabela-destaques, .tabela-resumo-medias, .gap-chart-container, .rp-perguntas-abertas-content';

          const isReportTableStructure = (element: Element): boolean => {
            const tag = element.tagName;
            if (tag === 'TABLE') {
              return (element as HTMLElement).matches(reportTableSelector);
            }
            if (tag === 'TH' || tag === 'TD' || tag === 'TR' || tag === 'THEAD' || tag === 'TBODY' || tag === 'TFOOT') {
              return !!element.closest(reportTableSelector);
            }
            return false;
          };

          const enhanceReportTable = (root: HTMLElement): void => {
            if (!root.matches(reportTableSelector)) return;

            root.querySelectorAll('th, td').forEach((cell) => {
              const element = cell as HTMLElement;
              element.style.setProperty('border', '1px solid #555555', 'important');
              const computedSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
              const baseSize = Number.isFinite(computedSize) && computedSize > 0 ? computedSize : 11;
              element.style.setProperty('font-size', `${Math.max(baseSize + 2, 12)}px`, 'important');
              element.style.setProperty('line-height', '1.35', 'important');
            });

            if (root.matches('.tabela-frequencia, .tabela-distribuicao-notas')) {
              root.style.setProperty('border-collapse', 'collapse', 'important');
              root.style.setProperty('border', '1px solid #555555', 'important');
            }
          };

          target.querySelectorAll('*').forEach((node) => {
            const element = node as HTMLElement;
            const inInfo = element.classList.contains('capa-info-block') || !!element.closest('.capa-info-block');
            const preserveTable = isReportTableStructure(element);

            element.style.setProperty('outline', 'none');
            element.style.setProperty('box-shadow', 'none');
            if (!inInfo && !preserveTable) {
              element.style.setProperty('border', 'none');
              element.style.setProperty('border-width', '0');
            }
            if (element.tagName === 'TABLE' && !element.matches(reportTableSelector)) {
              element.setAttribute('border', '0');
            }
          });

          enhanceReportTable(target);
          target.style.setProperty('outline', 'none');
          target.style.setProperty('box-shadow', 'none');
          if (!target.matches(reportTableSelector)) {
            target.style.setProperty('border', 'none');
          }
        }, selector);
      }

      const box = await handle.boundingBox();
      if (!box || box.width < 1 || box.height < 1) {
        console.warn('[docx-export:hybrid-render] Elemento sem dimensao para captura', { selector, box });
        continue;
      }

      const pngBuffer = Buffer.from(await handle.screenshot({
        type: 'png',
        omitBackground: false,
      }));

      if (!pngBuffer.length) continue;

      const dimensions = sizeOf(pngBuffer);
      captures.set(selector, {
        data: pngBuffer,
        widthPx: dimensions.width ?? Math.round(box.width),
        heightPx: dimensions.height ?? Math.round(box.height),
      });
    }

    const pdfBuffer = Buffer.from(await page.pdf({
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

    const pdfPageCount = await loadPdfPageCount(pdfBuffer);

    return {
      pdfBuffer,
      pdfPageCount,
      captures,
    };
  } catch (error) {
    if (error instanceof DocxExportError) {
      throw error;
    }

    const detail = error instanceof Error ? error.message : String(error);
    console.error('[docx-export:hybrid-render] Falha na sessao hibrida', { detail });
    throw new DocxExportError(
      'PDF_RENDER_FAILED',
      `Falha na sessao hibrida de renderizacao DOCX: ${detail}`,
      error
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
