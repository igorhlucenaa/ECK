import type { ExportHybridManifest, ExportManifest, ExportManifestContentItem, ExportPageConfig } from './types.js';

import type { HtmlPdfRenderOptions } from '../shared/pdf-html-renderer.js';

import { parse, type HTMLElement } from 'node-html-parser';

import sizeOf from 'image-size';

import { runHybridRenderSession } from './hybrid-render-session.js';

import { DocxExportError } from './errors.js';

import { mmToPx, scaleToMaxWidth } from './dimensions.js';

import { buildDocxBufferFromBlocks, type DocxContentBlock } from './docx-builder.js';



function isHybridManifest(manifest?: ExportManifest): manifest is ExportHybridManifest {

  return Boolean(manifest && manifest.version === 2 && Array.isArray(manifest.content));

}



function getPreviewRoot(root: HTMLElement): HTMLElement {

  const preview = root.querySelector('#report-preview') as HTMLElement | null;

  return preview || root;

}



function getElementByDomPath(root: HTMLElement, path: number[]): HTMLElement | null {

  let current: HTMLElement = root;



  for (const index of path) {

    const elementChildren = current.childNodes.filter((node) => node.nodeType === 1) as HTMLElement[];

    const next = elementChildren[index];

    if (!next) return null;

    current = next;

  }



  return current;

}



function decodeDataUrl(src: string): Buffer | null {

  const trimmed = src.trim();

  if (!trimmed.startsWith('data:')) return null;



  const base64Match = /^data:[^;,]+;base64,([\s\S]+)$/i.exec(trimmed);

  if (base64Match) {

    try {

      return Buffer.from(base64Match[1], 'base64');

    } catch {

      return null;

    }

  }



  const commaIndex = trimmed.indexOf(',');

  if (commaIndex === -1) return null;



  const payload = trimmed.slice(commaIndex + 1);

  try {

    return Buffer.from(decodeURIComponent(payload), 'utf8');

  } catch {

    return Buffer.from(payload, 'utf8');

  }

}



function extractEmbeddedImage(node: HTMLElement): { data: Buffer; widthPx: number; heightPx: number } | null {

  const imgNode = node.tagName?.toUpperCase() === 'IMG'

    ? node

    : (node.querySelector('img') as HTMLElement | null);



  if (!imgNode) return null;



  const src = imgNode.getAttribute('src');

  if (!src?.startsWith('data:')) return null;



  const data = decodeDataUrl(src);

  if (!data?.length) return null;



  const widthAttr = Number(imgNode.getAttribute('width'));

  const heightAttr = Number(imgNode.getAttribute('height'));

  const styleWidth = Number.parseFloat((imgNode.getAttribute('style') || '').match(/width:\s*([0-9.]+)px/i)?.[1] || '');

  const styleHeight = Number.parseFloat((imgNode.getAttribute('style') || '').match(/height:\s*([0-9.]+)px/i)?.[1] || '');



  try {

    const dimensions = sizeOf(data);

    return {

      data,

      widthPx: dimensions.width || styleWidth || widthAttr || 800,

      heightPx: dimensions.height || styleHeight || heightAttr || 300,

    };

  } catch {

    return {

      data,

      widthPx: styleWidth || widthAttr || 800,

      heightPx: styleHeight || heightAttr || 300,

    };

  }

}



function contentItemToBlocks(

  item: ExportManifestContentItem,

  previewRoot: HTMLElement,

  captures: Map<string, { data: Buffer; widthPx: number; heightPx: number }>,

  maxImageWidthPx: number

): DocxContentBlock[] {

  if (item.kind === 'pageBreak') {

    return [{ kind: 'pageBreak' }];

  }



  if (item.kind === 'text') {
    return [{
      kind: 'text',
      text: item.text,
      runs: item.runs,
      heading: item.heading,
      styles: item.styles,
    }];
  }



  const selector = `[data-docx-capture-id="${item.captureId}"]`;

  const captured = captures.get(selector);

  if (captured) {
    const dimensions = item.fullPage
      ? { widthPx: captured.widthPx, heightPx: captured.heightPx }
      : (() => {
          const scaled = scaleToMaxWidth(captured.widthPx, captured.heightPx, maxImageWidthPx);
          return { widthPx: scaled.width, heightPx: scaled.height };
        })();

    return [{
      kind: 'image',
      data: captured.data,
      widthPx: dimensions.widthPx,
      heightPx: dimensions.heightPx,
      fullPage: item.fullPage,
    }];
  }



  if (item.useEmbeddedImage) {

    const node = getElementByDomPath(previewRoot, item.domPath);

    const embedded = node ? extractEmbeddedImage(node) : null;

    if (embedded) {

      const scaled = scaleToMaxWidth(embedded.widthPx, embedded.heightPx, maxImageWidthPx);

      return [{

        kind: 'image',

        data: embedded.data,

        widthPx: scaled.width,

        heightPx: scaled.height,

        fullPage: item.fullPage,

      }];

    }

  }



  return [{

    kind: 'text',

    text: '[Elemento visual indisponivel na exportacao]',

  }];

}



function collectCaptureSelectors(manifest: ExportHybridManifest): string[] {

  return manifest.content

    .filter((item): item is Extract<ExportManifestContentItem, { kind: 'visual' }> => item.kind === 'visual')

    .map((item) => `[data-docx-capture-id="${item.captureId}"]`);

}



export async function buildDocxFromHybridManifest(input: {

  html: string;

  manifest: ExportHybridManifest;

  options: HtmlPdfRenderOptions;

  pageConfig: ExportPageConfig;

}): Promise<{ docxBuffer: Buffer; pdfPageCount: number; pdfSizeBytes: number }> {

  const captureSelectors = collectCaptureSelectors(input.manifest);

  const session = await runHybridRenderSession(input.html, input.options, captureSelectors);



  const parsedRoot = parse(input.html, {

    blockTextElements: {

      script: false,

      style: false,

      pre: false,

    },

  }) as unknown as HTMLElement;



  const previewRoot = getPreviewRoot(parsedRoot);

  const maxImageWidthPx = mmToPx(input.pageConfig.contentWidthMm);

  const blocks: DocxContentBlock[] = [];



  for (const item of input.manifest.content) {

    blocks.push(

      ...contentItemToBlocks(item, previewRoot, session.captures, maxImageWidthPx)

    );

  }



  if (blocks.length === 0) {

    throw new DocxExportError('DOCX_BUILD_FAILED', 'Nenhum conteudo encontrado para exportacao DOCX.');

  }



  const textBlocks = blocks.filter((block) => block.kind === 'text').length;

  const imageBlocks = blocks.filter((block) => block.kind === 'image').length;

  const missingVisuals = blocks.filter((block) =>

    block.kind === 'text' && block.text === '[Elemento visual indisponivel na exportacao]'

  ).length;



  console.log('[docx-export:hybrid] Blocos montados', {

    total: blocks.length,

    textBlocks,

    imageBlocks,

    missingVisuals,

    pageBreaks: blocks.filter((block) => block.kind === 'pageBreak').length,

    captureSelectors: captureSelectors.length,

    capturesResolved: session.captures.size,

  });



  const docxBuffer = await buildDocxBufferFromBlocks({

    blocks,

    pageConfig: input.pageConfig,

    documentChrome: input.options.docxDocumentChrome,

  });



  return {

    docxBuffer,

    pdfPageCount: session.pdfPageCount,

    pdfSizeBytes: session.pdfBuffer.length,

  };

}



export async function buildDocxFromHtml(input: {

  html: string;

  manifest?: ExportManifest;

  options: HtmlPdfRenderOptions;

  pageConfig: ExportPageConfig;

  fileName: string;

}): Promise<{ docxBuffer: Buffer; pdfPageCount?: number; pdfSizeBytes?: number }> {

  if (isHybridManifest(input.manifest)) {

    return buildDocxFromHybridManifest({

      html: input.html,

      manifest: input.manifest,

      options: input.options,

      pageConfig: input.pageConfig,

    });

  }



  throw new DocxExportError(

    'DOCX_BUILD_FAILED',

    'Manifesto hibrido ausente. Atualize o frontend para exportacao DOCX.'

  );

}


