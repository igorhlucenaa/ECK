import { AngularEditorConfig } from '@kolkov/angular-editor';

/** Seções que permitem alternar entre editor visual e HTML bruto. */
export const SECOES_COM_HTML_BRUTO = ['capa', 'introducao', 'texto', 'custom'] as const;

export type SecaoComHtmlBruto = (typeof SECOES_COM_HTML_BRUTO)[number];

export function secaoSuportaHtmlBruto(tipo: string | undefined): tipo is SecaoComHtmlBruto {
  return !!tipo && (SECOES_COM_HTML_BRUTO as readonly string[]).includes(tipo);
}

/** HTML inicial da capa — sem blocos aninhados difíceis de excluir no editor visual. */
export const DEFAULT_CAPA_HTML = [
  '<h1 style="text-align: center; color: #1976d2; margin: 0 0 20px;">Relatório Feedback 360°</h1>',
  '<p style="text-align: center; font-size: 18px; color: #666; margin: 0 0 24px;">',
  'Avaliação de Competências e Desenvolvimento',
  '</p>',
  '<p style="text-align: center; font-size: 22px; color: #1e293b; margin: 16px 0;">',
  '<strong>$%NOME_AVALIADO$%</strong>',
  '</p>',
  '<p style="text-align: center; font-size: 14px; color: #64748b; margin: 0;">',
  '$%DATA_RELATORIO$%',
  '</p>',
].join('');

const BASE_EDITOR_CONFIG: AngularEditorConfig = {
  editable: true,
  spellcheck: true,
  sanitize: false,
  rawPaste: true,
  outline: true,
  placeholder:
    'Use as ferramentas de formatação ou o botão de código-fonte para editar HTML. Centralize com o botão de alinhamento; cores com o seletor de cor.',
  toolbarPosition: 'top',
  showToolbar: true,
  toolbarHiddenButtons: [
    ['subscript', 'superscript'],
    ['indent', 'outdent'],
    ['insertUnorderedList', 'insertOrderedList'],
    ['fontName'],
  ],
};

export const REPORT_RICH_TEXT_EDITOR_CONFIG: AngularEditorConfig = {
  ...BASE_EDITOR_CONFIG,
  height: '300px',
  minHeight: '200px',
};

export const REPORT_CAPA_EDITOR_CONFIG: AngularEditorConfig = {
  ...BASE_EDITOR_CONFIG,
  height: '360px',
  minHeight: '280px',
};

/** CSS injetado no PDF/preview para respeitar HTML customizado da capa. */
export const CAPA_HTML_PDF_STYLES = `
  .capa-section__html {
    display: block;
    width: 100%;
  }
  .capa-section__html img {
    max-width: 100% !important;
    height: auto !important;
  }
  .capa-section__html table {
    border-collapse: collapse;
    max-width: 100%;
  }
  .capa-section__html [style*="text-align: center"],
  .capa-section__html [style*="text-align:center"] {
    text-align: center !important;
  }
  .capa-section__html [style*="text-align: right"],
  .capa-section__html [style*="text-align:right"] {
    text-align: right !important;
  }
  .capa-section__html [style*="text-align: left"],
  .capa-section__html [style*="text-align:left"] {
    text-align: left !important;
  }
  .capa-section__html [style*="display: flex"],
  .capa-section__html [style*="display:flex"] {
    display: flex !important;
  }
  .capa-section__html [style*="display: inline-block"],
  .capa-section__html [style*="display:inline-block"] {
    display: inline-block !important;
  }
`;
