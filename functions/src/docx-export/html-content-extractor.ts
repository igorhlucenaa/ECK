import { parse, type HTMLElement } from 'node-html-parser';
import type { ExportEditableBlock, ExportManifest } from './types.js';

const NON_EDITABLE_ANCESTOR_SELECTORS = [
  '.rp-doc-cabecalho',
  '.rp-doc-rodape',
  '.tabela-frequencia',
  '.tabela-distribuicao-notas',
  '.tabela-destaques',
  '.rp-resumo-table',
  '.pdf-echarts-chart',
  '.pdf-svg-chart',
  '.rp-radar-chart',
  '.rp-defasagem-preview',
  '.rp-johari-wrap',
];

function collectMatchingNodes(root: HTMLElement, selector: string): HTMLElement[] {
  try {
    return root.querySelectorAll(selector) as unknown as HTMLElement[];
  } catch {
    return [];
  }
}

function walkElementsInOrder(root: HTMLElement, visit: (node: HTMLElement) => void): void {
  visit(root);
  for (const child of root.childNodes) {
    if (child.nodeType !== 1) continue;
    walkElementsInOrder(child as HTMLElement, visit);
  }
}

function orderNodesDocumentPosition(root: HTMLElement, nodes: HTMLElement[]): HTMLElement[] {
  const wanted = new Set(nodes);
  const ordered: HTMLElement[] = [];

  walkElementsInOrder(root, (node) => {
    if (wanted.has(node)) {
      ordered.push(node);
    }
  });

  return ordered;
}

function findOpenQuestionsSection(node: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = node;

  while (current) {
    if (current.getAttribute('data-secao-tipo') === 'perguntas_abertas') {
      return current;
    }
    current = current.parentNode as HTMLElement | null;
  }

  return null;
}

function isInsideOpenQuestionsAnswers(node: HTMLElement): boolean {
  const section = findOpenQuestionsSection(node);
  if (!section) {
    return false;
  }

  const tag = node.tagName?.toUpperCase() ?? '';
  if (tag === 'H2' && node.parentNode === section) {
    return false;
  }

  if (tag === 'DIV' && node.parentNode === section) {
    const style = node.getAttribute('style') || '';
    return style.includes('margin-top');
  }

  return true;
}

function hasMatchingAncestor(
  root: HTMLElement,
  node: HTMLElement,
  selectors: string[]
): boolean {
  let current: HTMLElement | null = node.parentNode as HTMLElement | null;

  while (current) {
    for (const selector of selectors) {
      if (collectMatchingNodes(root, selector).includes(current)) {
        return true;
      }
    }
    current = current.parentNode as HTMLElement | null;
  }

  return false;
}

function shouldSkipNode(root: HTMLElement, node: HTMLElement): boolean {
  if (hasMatchingAncestor(root, node, NON_EDITABLE_ANCESTOR_SELECTORS)) {
    return true;
  }

  if (isInsideOpenQuestionsAnswers(node)) {
    return true;
  }

  return false;
}

function inferBlockKind(tagName: string): ExportEditableBlock['kind'] {
  switch (tagName.toLowerCase()) {
    case 'h1':
      return 'heading1';
    case 'h2':
      return 'heading2';
    case 'h3':
      return 'heading3';
    case 'h4':
      return 'heading4';
    default:
      return 'paragraph';
  }
}

export function extractEditableBlocks(
  html: string,
  manifest?: ExportManifest
): ExportEditableBlock[] {
  if (!manifest?.elements?.length || !html.trim()) {
    return [];
  }

  const root = parse(html, {
    blockTextElements: {
      script: false,
      style: false,
      pre: false,
    },
  }) as unknown as HTMLElement;

  const editableSelectors = manifest.elements
    .filter((element) => element.editable && element.type === 'text')
    .map((element) => element.selector);

  if (editableSelectors.length === 0) {
    return [];
  }

  const matchedNodes = editableSelectors.flatMap((selector) =>
    collectMatchingNodes(root, selector)
  );

  const orderedNodes = orderNodesDocumentPosition(root, matchedNodes);
  const seenTexts = new Set<string>();
  const blocks: ExportEditableBlock[] = [];

  for (const node of orderedNodes) {
    if (shouldSkipNode(root, node)) {
      continue;
    }

    const text = node.text.replace(/\s+/g, ' ').trim();
    if (!text || seenTexts.has(text)) {
      continue;
    }

    const selector = editableSelectors.find((entry) =>
      collectMatchingNodes(root, entry).includes(node)
    );

    seenTexts.add(text);
    blocks.push({
      text,
      kind: inferBlockKind(node.tagName || 'p'),
      selector: selector || '',
    });
  }

  return blocks;
}
