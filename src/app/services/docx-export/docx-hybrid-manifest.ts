export interface ExportManifestElement {
  type: 'text' | 'table' | 'image' | 'chart';
  selector: string;
  editable: boolean;
}

export interface ExportTextStyles {
  fontSizePt: number;
  color: string;
  bold: boolean;
  italic: boolean;
  spacingBeforePt: number;
  spacingAfterPt: number;
}

export interface ExportTextRun {
  text: string;
  styles: ExportTextStyles;
}

export type ExportTextHeadingKind = 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'paragraph';

export type ExportManifestContentItem =
  | { kind: 'pageBreak' }
  | {
      kind: 'text';
      text: string;
      runs?: ExportTextRun[];
      heading?: ExportTextHeadingKind;
      styles: ExportTextStyles;
      domPath: number[];
    }
  | {
      kind: 'visual';
      captureId: string;
      domPath: number[];
      useEmbeddedImage: boolean;
      fullPage?: boolean;
    };

export interface ExportHybridManifest {
  version: 2;
  elements: ExportManifestElement[];
  content: ExportManifestContentItem[];
}

const DOCX_SYNC_ATTR = 'data-docx-sync-id';

const MANIFEST_SELECTORS: ExportManifestElement[] = [
  { type: 'text', selector: '.report-section > div > h2', editable: true },
  { type: 'text', selector: '.rp-secao-header > h2', editable: true },
  { type: 'text', selector: '.report-section > div > h3', editable: true },
  { type: 'text', selector: '.report-section > div > h4', editable: true },
  { type: 'text', selector: '.report-rich-text h1', editable: true },
  { type: 'text', selector: '.report-rich-text h2', editable: true },
  { type: 'text', selector: '.report-rich-text h3', editable: true },
  { type: 'text', selector: '.report-rich-text h4', editable: true },
  { type: 'text', selector: '.report-rich-text p', editable: true },
  { type: 'text', selector: '.report-rich-text li', editable: true },
  { type: 'text', selector: '.report-section > div > p', editable: true },
  { type: 'text', selector: '.report-section > div > li', editable: true },
  { type: 'text', selector: '.capa-section h1', editable: true },
  { type: 'text', selector: '.capa-section h2', editable: true },
  { type: 'text', selector: '.capa-section p', editable: true },
  { type: 'text', selector: '.capa-section__html', editable: true },
  { type: 'text', selector: '.rp-secao-header h2', editable: true },
  { type: 'text', selector: '.rp-secao-header p', editable: true },
  { type: 'text', selector: '.rp-graficos-header > h2', editable: true },
  { type: 'text', selector: '.rp-graficos-competencias > h4', editable: true },
  { type: 'text', selector: '.pdf-chip__label', editable: true },
  { type: 'text', selector: '.rp-bar-chart-block > h4', editable: true },
  { type: 'text', selector: '.rp-bar-chart-block > p', editable: true },
  { type: 'text', selector: '.rp-competencia-chart-block > h4', editable: true },
  { type: 'text', selector: '.rp-competencia-chart-block > p', editable: true },
  { type: 'text', selector: '.rp-competencia-block > h3', editable: true },
  { type: 'text', selector: '.rp-competencia-block > p', editable: true },
  { type: 'text', selector: '.rp-competencia-block__intro > h3', editable: true },
  { type: 'text', selector: '.rp-competencia-block__intro > p', editable: true },
  { type: 'text', selector: '.rp-subsecao-block > h3', editable: true },
  { type: 'text', selector: '.rp-subsecao-block > p', editable: true },
  { type: 'text', selector: '.rp-defasagem-item__title', editable: true },
  { type: 'text', selector: '.rp-tabela-notas p', editable: true },
  { type: 'text', selector: '.capa-info-block', editable: true },
  { type: 'text', selector: '.capa-info-block span', editable: true },
  { type: 'table', selector: '.tabela-frequencia', editable: false },
  { type: 'table', selector: '.tabela-distribuicao-notas', editable: false },
  { type: 'table', selector: '.tabela-destaques', editable: false },
  { type: 'table', selector: '.rp-resumo-table', editable: false },
  { type: 'table', selector: '.tabela-resumo-medias', editable: false },
  { type: 'table', selector: '.gap-chart-container', editable: false },
  { type: 'chart', selector: '.rp-bar-chart-layout', editable: false },
  { type: 'chart', selector: '.rp-bar-chart-wrap', editable: false },
  { type: 'table', selector: '.rp-perguntas-abertas-content', editable: false },
  { type: 'table', selector: '.rp-perguntas-abertas-empty', editable: false },
  { type: 'chart', selector: '.pdf-echarts-chart', editable: false },
  { type: 'chart', selector: '.pdf-svg-chart', editable: false },
  { type: 'chart', selector: '.rp-radar-chart', editable: false },
  { type: 'chart', selector: 'app-johari-window-chart', editable: false },
  { type: 'chart', selector: '.rp-johari-wrap', editable: false },
  { type: 'image', selector: '.capa-section img', editable: false },
];

const TEXT_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'SPAN']);

const NON_EDITABLE_ANCESTOR_SELECTORS = [
  '.tabela-frequencia',
  '.tabela-distribuicao-notas',
  '.tabela-destaques',
  '.rp-resumo-table',
  '.tabela-resumo-medias',
  '.pdf-echarts-chart',
  '.pdf-svg-chart',
  '.rp-radar-chart',
  '.rp-johari-wrap',
  '.gap-chart-container',
  '.rp-bar-chart-layout',
  '.rp-bar-chart-wrap',
  '.rp-perguntas-abertas-content',
  '.rp-perguntas-abertas-empty',
];

const EDITABLE_CONTAINER_SELECTORS = new Set([
  '.capa-info-block',
  '.capa-section__html',
  '.report-rich-text',
]);

export function assignDocxSyncIds(root: HTMLElement): void {
  let counter = 0;
  root.querySelectorAll('*').forEach((node) => {
    node.setAttribute(DOCX_SYNC_ATTR, String(counter));
    counter += 1;
  });
  root.setAttribute(DOCX_SYNC_ATTR, String(counter));
}

export function clearDocxSyncIds(root: HTMLElement): void {
  root.querySelectorAll(`[${DOCX_SYNC_ATTR}]`).forEach((node) => {
    node.removeAttribute(DOCX_SYNC_ATTR);
  });
}

export function getDomPath(element: Element, root: Element): number[] {
  const path: number[] = [];
  let current: Element | null = element;

  while (current !== null && current !== root) {
    const parent: Element | null = current.parentElement;
    if (parent === null) break;
    path.unshift(Array.from(parent.children).indexOf(current));
    current = parent;
  }

  return path;
}

export function getElementByDomPath(root: Element, path: number[]): Element | null {
  if (path.length === 0) {
    return null;
  }

  let current: Element = root;

  for (const index of path) {
    const next = current.children.item(index);
    if (!next) return null;
    current = next;
  }

  return current;
}

function findLiveElement(cloneNode: Element, liveRoot: HTMLElement): Element | null {
  const syncId = cloneNode.getAttribute(DOCX_SYNC_ATTR);
  if (!syncId) {
    return cloneNode;
  }
  return liveRoot.querySelector(`[${DOCX_SYNC_ATTR}="${syncId}"]`);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeMultilineText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function extractTextContent(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith(document.createTextNode('\n'));
  });
  clone.querySelectorAll('li').forEach((li) => {
    li.prepend(document.createTextNode('\n'));
  });

  const raw = clone.textContent || '';
  return raw.includes('\n') ? normalizeMultilineText(raw) : normalizeText(raw);
}

function rgbToHex(color: string): string {
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    return trimmed.slice(1, 7).padEnd(6, '0').slice(0, 6);
  }

  const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return '333333';

  const toHex = (value: string) => Number(value).toString(16).padStart(2, '0');
  return `${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

function pxToPt(px: number): number {
  return Math.round(((px * 72) / 96) * 10) / 10;
}

function defaultStylesForTag(tagName: string): ExportTextStyles {
  switch (tagName.toLowerCase()) {
    case 'h1':
      return { fontSizePt: 24, color: '334155', bold: true, italic: false, spacingBeforePt: 0, spacingAfterPt: 14 };
    case 'h2':
      return { fontSizePt: 18, color: '334155', bold: true, italic: false, spacingBeforePt: 12, spacingAfterPt: 14 };
    case 'h3':
      return { fontSizePt: 14, color: '334155', bold: true, italic: false, spacingBeforePt: 10, spacingAfterPt: 10 };
    case 'h4':
      return { fontSizePt: 12, color: '334155', bold: true, italic: false, spacingBeforePt: 8, spacingAfterPt: 8 };
    default:
      return { fontSizePt: 11, color: '333333', bold: false, italic: false, spacingBeforePt: 0, spacingAfterPt: 10 };
  }
}

function applySectionTitleStyles(styles: ExportTextStyles): ExportTextStyles {
  const defaults = defaultStylesForTag('h2');
  return {
    ...styles,
    fontSizePt: Math.max(styles.fontSizePt, defaults.fontSizePt),
    color: styles.color || defaults.color,
    bold: true,
    spacingBeforePt: Math.max(styles.spacingBeforePt, defaults.spacingBeforePt),
    spacingAfterPt: Math.max(styles.spacingAfterPt, defaults.spacingAfterPt),
  };
}

function preserveRichTextStyles(styles: ExportTextStyles): ExportTextStyles {
  return {
    ...styles,
    spacingBeforePt: Math.max(styles.spacingBeforePt, 0),
    spacingAfterPt: Math.max(styles.spacingAfterPt, 4),
  };
}

function measureTextStyles(cloneNode: Element, liveRoot: HTMLElement): ExportTextStyles {
  const liveNode = findLiveElement(cloneNode, liveRoot) || cloneNode;
  const computed = window.getComputedStyle(liveNode);
  const fontSizePx = Number.parseFloat(computed.fontSize);
  const marginTopPx = Number.parseFloat(computed.marginTop) || 0;
  const marginBottomPx = Number.parseFloat(computed.marginBottom) || 0;
  const fontWeight = Number.parseInt(computed.fontWeight, 10) || 400;

  if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) {
    return defaultStylesForTag(cloneNode.tagName);
  }

  return {
    fontSizePt: pxToPt(fontSizePx),
    color: rgbToHex(computed.color || '#333333'),
    bold: fontWeight >= 600 || computed.fontWeight === 'bold',
    italic: computed.fontStyle === 'italic',
    spacingBeforePt: pxToPt(marginTopPx),
    spacingAfterPt: pxToPt(marginBottomPx),
  };
}

function isCompetencyHeadingElement(element: Element): boolean {
  if (element.tagName !== 'H4') {
    return false;
  }

  return !!element.closest('.rp-graficos-competencias, .rp-bar-chart-block, .rp-competencia-chart-block');
}

function isCompetencyTitleElement(element: Element): boolean {
  if (element.tagName !== 'H3') {
    return false;
  }

  return !!element.closest('.rp-competencia-block, .rp-competencia-block__intro, .rp-subsecao-block, .rp-defasagem-item');
}

function resolveTextHeading(element: Element): ExportTextHeadingKind | undefined {
  if (isSectionTitleElement(element)) {
    return 'heading2';
  }
  if (isCompetencyTitleElement(element)) {
    return 'heading3';
  }
  if (isCompetencyHeadingElement(element)) {
    return 'heading4';
  }
  return undefined;
}

function isSectionTitleElement(element: Element): boolean {
  if (element.tagName !== 'H2') {
    return false;
  }

  if (element.closest('.report-rich-text')) {
    return false;
  }

  const parent = element.parentElement;
  if (!parent) {
    return false;
  }

  if (parent.classList.contains('rp-secao-header')) {
    return true;
  }

  if (parent.classList.contains('rp-graficos-header')) {
    return true;
  }

  const grandparent = parent.parentElement;
  return grandparent?.classList.contains('report-section') === true && parent.tagName === 'DIV';
}

function isInsideRichText(element: Element): boolean {
  return !!element.closest('.report-rich-text');
}

function measureElementStyles(element: Element, liveRoot: HTMLElement): ExportTextStyles {
  return measureTextStyles(element, liveRoot);
}

function extractTextRuns(element: Element, liveRoot: HTMLElement): ExportTextRun[] {
  const runs: ExportTextRun[] = [];

  const appendRun = (text: string, source: Element) => {
    const normalized = text.replace(/\s+/g, ' ');
    if (!normalized.trim()) {
      return;
    }
    runs.push({
      text: normalized,
      styles: preserveRichTextStyles(measureElementStyles(source, liveRoot)),
    });
  };

  const walk = (node: Node, styleSource: Element) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendRun(node.textContent || '', styleSource);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const current = node as Element;
    if (current.tagName === 'BR') {
      runs.push({
        text: '\n',
        styles: preserveRichTextStyles(measureElementStyles(styleSource, liveRoot)),
      });
      return;
    }

    const nextStyleSource = ['STRONG', 'B', 'EM', 'I', 'SPAN', 'A', 'U', 'H1', 'H2', 'H3', 'H4', 'P', 'LI'].includes(current.tagName)
      ? current
      : styleSource;

    Array.from(current.childNodes).forEach((child) => walk(child, nextStyleSource));
  };

  walk(element, element);

  return runs.filter((run) => run.text.trim().length > 0 || run.text === '\n');
}

function pushTextContentItem(
  content: ExportManifestContentItem[],
  node: Element,
  liveRoot: HTMLElement,
  root: Element
): void {
  const insideRichText = isInsideRichText(node);
  const measured = measureElementStyles(node, liveRoot);
  const runs = insideRichText ? extractTextRuns(node, liveRoot) : undefined;
  const text = runs?.length
    ? runs.map((run) => (run.text === '\n' ? '\n' : run.text)).join('').replace(/\n+/g, '\n').trim()
    : extractTextContent(node);

  if (!text) {
    return;
  }

  content.push({
    kind: 'text',
    text,
    runs: runs?.length ? runs : undefined,
    heading: resolveTextHeading(node),
    styles: insideRichText
      ? preserveRichTextStyles(measured)
      : isSectionTitleElement(node)
        ? applySectionTitleStyles(measured)
        : preserveRichTextStyles(measured),
    domPath: getDomPath(node, root),
  });
}

function elementMatchesSelector(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function nodeInSelectorList(element: Element, root: Element, selectors: string[]): boolean {
  return selectors.some((selector) => {
    try {
      return root.querySelector(selector) !== null && element.matches(selector);
    } catch {
      return false;
    }
  });
}

function hasMatchingAncestor(element: Element, root: Element, selectors: string[]): boolean {
  let current: Element | null = element.parentElement;

  while (current && current !== root) {
    if (nodeInSelectorList(current, root, selectors)) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

function isInsideOpenQuestionsAnswers(element: Element): boolean {
  return !!element.closest('.rp-perguntas-abertas-content, .rp-perguntas-abertas-empty');
}

function shouldSkipEditableText(root: Element, element: Element): boolean {
  if (hasMatchingAncestor(element, root, NON_EDITABLE_ANCESTOR_SELECTORS)) {
    return true;
  }
  return isInsideOpenQuestionsAnswers(element);
}

function findNonEditableBlockMatch(
  element: Element,
  elements: ExportManifestElement[]
): ExportManifestElement | null {
  for (const entry of elements) {
    if (entry.editable || entry.type === 'text') continue;
    if (elementMatchesSelector(element, entry.selector)) {
      return entry;
    }
  }
  return null;
}

function hasEmbeddedDataImage(element: Element): boolean {
  if (element.tagName === 'IMG') {
    return Boolean((element as HTMLImageElement).getAttribute('src')?.startsWith('data:'));
  }

  const img = element.querySelector(':scope > img, img');
  return Boolean(img?.getAttribute('src')?.startsWith('data:'));
}

function isEditableTextCandidate(element: Element, root: Element, elements: ExportManifestElement[]): boolean {
  if (shouldSkipEditableText(root, element)) return false;

  const tag = element.tagName.toUpperCase();
  if (!TEXT_TAGS.has(tag)) return false;

  const editableSelectors = elements
    .filter((entry) => entry.editable && entry.type === 'text')
    .map((entry) => entry.selector);

  if (!nodeInSelectorList(element, root, editableSelectors)) {
    return false;
  }

  if (tag === 'SPAN') {
    return nodeInSelectorList(element, root, editableSelectors);
  }

  return true;
}

function isEditableContainer(element: Element, elements: ExportManifestElement[]): boolean {
  const editableSelectors = elements
    .filter((entry) => entry.editable && entry.type === 'text')
    .map((entry) => entry.selector);

  return [...EDITABLE_CONTAINER_SELECTORS].some(
    (selector) => editableSelectors.includes(selector) && elementMatchesSelector(element, selector)
  );
}

function isStructuralContentDiv(element: Element): boolean {
  if (element.tagName !== 'DIV') return false;

  return element.querySelector(
    ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > p, :scope > ul, :scope > ol, :scope > div, :scope > table, :scope > blockquote'
  ) !== null;
}

function isSectionIntroDiv(element: Element, root: Element): boolean {
  if (element.tagName !== 'DIV') return false;
  if (element.parentElement?.classList.contains('report-section') !== true) return false;
  if (element.classList.contains('rp-secao-header')) return false;
  if (element.classList.contains('capa-info-block')) return false;
  if (element.classList.contains('capa-section')) return false;
  if (element.classList.contains('capa-section__html')) return false;
  if (isStructuralContentDiv(element)) return false;
  if (element.querySelector(':scope > p')) return false;
  if (shouldSkipEditableText(root, element)) return false;
  if (element.querySelector('table, canvas, svg, img, .pdf-echarts-chart, .gap-chart-container')) {
    return false;
  }

  return normalizeText(element.textContent || '').length > 0;
}

function walkPreviewNode(
  root: Element,
  liveRoot: HTMLElement,
  node: Element,
  elements: ExportManifestElement[],
  content: ExportManifestContentItem[],
  captureCounter: { value: number }
): void {
  if (node.classList.contains('pdf-page-break')) {
    content.push({ kind: 'pageBreak' });
    return;
  }

  if (node.classList.contains('capa-section')) {
    const domPath = getDomPath(node, root);
    if (domPath.length > 0) {
      const captureId = `docx-cap-${captureCounter.value}`;
      captureCounter.value += 1;
      content.push({
        kind: 'visual',
        captureId,
        domPath,
        useEmbeddedImage: false,
        fullPage: true,
      });
      content.push({ kind: 'pageBreak' });
    }
    return;
  }

  const nonEditableMatch = findNonEditableBlockMatch(node, elements);
  if (nonEditableMatch) {
    const domPath = getDomPath(node, root);
    if (domPath.length === 0) {
      return;
    }

    const captureId = `docx-cap-${captureCounter.value}`;
    captureCounter.value += 1;
    content.push({
      kind: 'visual',
      captureId,
      domPath,
      useEmbeddedImage: hasEmbeddedDataImage(node),
    });
    return;
  }

  if (isEditableContainer(node, elements)) {
    Array.from(node.children).forEach((child) => {
      walkPreviewNode(root, liveRoot, child, elements, content, captureCounter);
    });
    return;
  }

  if (isStructuralContentDiv(node)) {
    Array.from(node.children).forEach((child) => {
      walkPreviewNode(root, liveRoot, child, elements, content, captureCounter);
    });
    return;
  }

  if (isSectionIntroDiv(node, root)) {
    pushTextContentItem(content, node, liveRoot, root);
    return;
  }

  if (isEditableTextCandidate(node, root, elements)) {
    pushTextContentItem(content, node, liveRoot, root);
    return;
  }

  Array.from(node.children).forEach((child) => {
    walkPreviewNode(root, liveRoot, child, elements, content, captureCounter);
  });
}

export function buildDocxHybridManifest(
  preparedClone: HTMLElement,
  livePreview: HTMLElement
): ExportHybridManifest {
  const elements = MANIFEST_SELECTORS.filter(({ selector }) => preparedClone.querySelector(selector));
  const content: ExportManifestContentItem[] = [];
  const captureCounter = { value: 0 };

  Array.from(preparedClone.children).forEach((child) => {
    walkPreviewNode(preparedClone, livePreview, child, elements, content, captureCounter);
  });

  return {
    version: 2,
    elements,
    content,
  };
}

export function annotateCloneWithCaptureIds(
  cloneRoot: Element,
  content: ExportManifestContentItem[]
): void {
  for (const item of content) {
    if (item.kind !== 'visual') continue;
    if (item.domPath.length === 0) continue;

    const target = getElementByDomPath(cloneRoot, item.domPath);
    if (!target || target === cloneRoot) continue;
    target.setAttribute('data-docx-capture-id', item.captureId);
  }
}
