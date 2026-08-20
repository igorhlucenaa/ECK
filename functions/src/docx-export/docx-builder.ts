import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  convertMillimetersToTwip,
} from 'docx';
import type { DocxDocumentChrome } from '../shared/pdf-html-renderer.js';
import type { ExportEditableBlock, ExportPageConfig, ExportTextStyles } from './types.js';
import { DocxExportError } from './errors.js';
import { mmToPx, scaleToMaxWidth } from './dimensions.js';

const DOCX_FONT = 'Arial';

export type DocxContentBlock =
  | { kind: 'pageBreak' }
  | {
      kind: 'text';
      text: string;
      runs?: import('./types.js').ExportTextRun[];
      heading?: ExportEditableBlock['kind'];
      styles?: ExportTextStyles;
    }
  | { kind: 'image'; data: Buffer; widthPx: number; heightPx: number; fullPage?: boolean }
  | { kind: 'imageCapture'; selector: string };

function ptToTwip(pt: number): number {
  return Math.max(0, Math.round(pt * 20));
}

function headingLevelForKind(kind: ExportEditableBlock['kind'] | undefined) {
  switch (kind) {
    case 'heading1':
      return HeadingLevel.HEADING_1;
    case 'heading2':
      return HeadingLevel.HEADING_2;
    case 'heading3':
      return HeadingLevel.HEADING_3;
    case 'heading4':
      return HeadingLevel.HEADING_4;
    default:
      return undefined;
  }
}

function buildSectionProperties(pageConfig: ExportPageConfig, documentChrome?: DocxDocumentChrome) {
  const headerExtraMm = documentChrome?.header?.enabled ? 4 : 0;
  const footerExtraMm = documentChrome?.footer?.enabled ? 4 : 0;

  return {
    page: {
      size: {
        width: convertMillimetersToTwip(pageConfig.widthMm),
        height: convertMillimetersToTwip(pageConfig.heightMm),
        orientation: pageConfig.landscape ? ('landscape' as const) : ('portrait' as const),
      },
      margin: {
        top: convertMillimetersToTwip(pageConfig.margins.top + headerExtraMm),
        right: convertMillimetersToTwip(pageConfig.margins.right),
        bottom: convertMillimetersToTwip(pageConfig.margins.bottom + footerExtraMm),
        left: convertMillimetersToTwip(pageConfig.margins.left),
      },
    },
  };
}

function buildTextRun(text: string, heading?: ExportEditableBlock['kind'], styles?: ExportTextStyles): TextRun {
  const fontSizePt = styles?.fontSizePt ?? (heading ? 14 : 11);

  return new TextRun({
    text,
    bold: styles?.bold ?? (heading ? true : false),
    italics: styles?.italic ?? false,
    size: Math.max(16, Math.round(fontSizePt * 2)),
    color: (styles?.color || '333333').replace('#', '').slice(0, 6),
    font: DOCX_FONT,
  });
}

function buildDocumentHeader(chrome?: DocxDocumentChrome['header']): Header | undefined {
  if (!chrome?.enabled) {
    return undefined;
  }

  const color = (chrome.color || '666666').replace('#', '').slice(0, 6);
  const children: TextRun[] = [
    new TextRun({
      text: `${chrome.leftText}\t`,
      size: 18,
      color,
      font: DOCX_FONT,
    }),
  ];

  if (chrome.showPageNumbers) {
    children.push(
      new TextRun({ children: [PageNumber.CURRENT], size: 18, color, font: DOCX_FONT }),
      new TextRun({ text: ' / ', size: 18, color, font: DOCX_FONT }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color, font: DOCX_FONT }),
    );
  }

  return new Header({
    children: [
      new Paragraph({
        border: chrome.borderBottom
          ? {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 4,
                color,
                space: 1,
              },
            }
          : undefined,
        spacing: { before: 80, after: 160 },
        tabStops: [
          {
            type: TabStopType.RIGHT,
            position: TabStopPosition.MAX,
          },
        ],
        children,
      }),
    ],
  });
}

function buildDocumentFooter(chrome?: DocxDocumentChrome['footer']): Footer | undefined {
  if (!chrome?.enabled) {
    return undefined;
  }

  const color = (chrome.color || '666666').replace('#', '').slice(0, 6);
  const leftParts = [chrome.text || ''].filter(Boolean);
  if (chrome.showYear) {
    leftParts.push(String(new Date().getFullYear()));
  }

  const children: TextRun[] = [
    new TextRun({
      text: `${leftParts.join('  ')}\t`,
      size: 18,
      color,
      font: DOCX_FONT,
    }),
  ];

  if (chrome.showPageNumbers) {
    children.push(
      new TextRun({ children: [PageNumber.CURRENT], size: 18, color, font: DOCX_FONT }),
      new TextRun({ text: ' / ', size: 18, color, font: DOCX_FONT }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color, font: DOCX_FONT }),
    );
  }

  return new Footer({
    children: [
      new Paragraph({
        border: chrome.borderTop
          ? {
              top: {
                style: BorderStyle.SINGLE,
                size: 4,
                color,
                space: 1,
              },
            }
          : undefined,
        spacing: { before: 160, after: 80 },
        tabStops: [
          {
            type: TabStopType.RIGHT,
            position: TabStopPosition.MAX,
          },
        ],
        children,
      }),
    ],
  });
}

function scaleImageBlock(
  block: Extract<DocxContentBlock, { kind: 'image' }>,
  pageConfig: ExportPageConfig
): { widthPx: number; heightPx: number } {
  const maxWidthPx = mmToPx(pageConfig.contentWidthMm);

  if (block.fullPage) {
    const maxHeightPx = mmToPx(pageConfig.contentHeightMm);
    const widthScale = maxWidthPx / block.widthPx;
    const heightScale = maxHeightPx / block.heightPx;
    const scale = Math.min(widthScale, heightScale, 1);
    return {
      widthPx: Math.max(1, Math.round(block.widthPx * scale)),
      heightPx: Math.max(1, Math.round(block.heightPx * scale)),
    };
  }

  const scaled = scaleToMaxWidth(block.widthPx, block.heightPx, maxWidthPx);
  return {
    widthPx: scaled.width,
    heightPx: scaled.height,
  };
}

function buildTextParagraphs(block: Extract<DocxContentBlock, { kind: 'text' }>): Paragraph[] {
  const heading = headingLevelForKind(block.heading);
  const spacingBefore = block.styles ? ptToTwip(block.styles.spacingBeforePt) : heading ? 240 : 0;
  const spacingAfter = block.styles
    ? ptToTwip(block.styles.spacingAfterPt)
    : heading
      ? 280
      : 200;
  const lineSpacing = heading ? undefined : 276;

  if (block.runs?.length) {
    const children = block.runs.flatMap((run, index) => {
      if (run.text === '\n') {
        return index < block.runs!.length - 1 ? [new TextRun({ break: 1 })] : [];
      }
      return [buildTextRun(run.text, undefined, run.styles)];
    });

    if (children.length === 0) {
      return [];
    }

    return [
      new Paragraph({
        heading,
        children,
        spacing: {
          before: spacingBefore,
          after: spacingAfter,
          line: lineSpacing,
        },
        keepNext: Boolean(heading),
      }),
    ];
  }

  const lines = block.text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  if (lines.length === 1) {
    return [
      new Paragraph({
        heading,
        children: [buildTextRun(lines[0], block.heading, block.styles)],
        spacing: {
          before: spacingBefore,
          after: spacingAfter,
          line: lineSpacing,
        },
        keepNext: Boolean(heading),
      }),
    ];
  }

  return lines.map((line, index) =>
    new Paragraph({
      heading: index === 0 ? heading : undefined,
      children: [buildTextRun(line, index === 0 ? block.heading : undefined, block.styles)],
      spacing: {
        before: index === 0 ? spacingBefore : 80,
        after: index === lines.length - 1 ? spacingAfter : 80,
        line: lineSpacing,
      },
      keepNext: index === 0 && Boolean(heading),
    })
  );
}

function buildParagraphsFromBlocks(blocks: DocxContentBlock[], pageConfig: ExportPageConfig): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const block of blocks) {
    if (block.kind === 'pageBreak') {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [new PageBreak()],
        })
      );
      continue;
    }

    if (block.kind === 'text') {
      paragraphs.push(...buildTextParagraphs(block));
      continue;
    }

    if (block.kind === 'image') {
      const scaled = scaleImageBlock(block, pageConfig);
      paragraphs.push(
        new Paragraph({
          alignment: block.fullPage ? AlignmentType.CENTER : AlignmentType.CENTER,
          spacing: {
            before: block.fullPage ? 0 : 120,
            after: block.fullPage ? 0 : 120,
          },
          children: [
            new ImageRun({
              type: 'png',
              data: block.data,
              transformation: {
                width: scaled.widthPx,
                height: scaled.heightPx,
              },
            }),
          ],
        })
      );
    }
  }

  return paragraphs;
}

function splitCoverBlocks(blocks: DocxContentBlock[]): {
  coverBlocks: DocxContentBlock[];
  bodyBlocks: DocxContentBlock[];
} {
  const coverIndex = blocks.findIndex((block) => block.kind === 'image' && block.fullPage);
  if (coverIndex < 0) {
    return { coverBlocks: [], bodyBlocks: blocks };
  }

  const coverBlocks = [blocks[coverIndex]];
  let bodyBlocks = blocks.slice(coverIndex + 1);
  if (bodyBlocks[0]?.kind === 'pageBreak') {
    bodyBlocks = bodyBlocks.slice(1);
  }

  return { coverBlocks, bodyBlocks };
}

export async function buildDocxBufferFromBlocks(input: {
  blocks: DocxContentBlock[];
  pageConfig: ExportPageConfig;
  documentChrome?: DocxDocumentChrome;
}): Promise<Buffer> {
  try {
    const { coverBlocks, bodyBlocks } = splitCoverBlocks(input.blocks);
    const header = buildDocumentHeader(input.documentChrome?.header);
    const footer = buildDocumentFooter(input.documentChrome?.footer);
    const sectionProperties = buildSectionProperties(input.pageConfig, input.documentChrome);
    const coverSectionProperties = buildSectionProperties(input.pageConfig);
    const sections = [];

    if (coverBlocks.length > 0) {
      sections.push({
        properties: coverSectionProperties,
        children: buildParagraphsFromBlocks(coverBlocks, input.pageConfig),
      });
    }

    sections.push({
      properties: sectionProperties,
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      children: buildParagraphsFromBlocks(bodyBlocks, input.pageConfig),
    });

    const doc = new Document({ sections });
    return Buffer.from(await Packer.toBuffer(doc));
  } catch (error) {
    throw new DocxExportError(
      'DOCX_BUILD_FAILED',
      'Falha ao montar documento DOCX.',
      error
    );
  }
}
