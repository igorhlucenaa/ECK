import type { HtmlPdfRenderOptions } from '../shared/pdf-html-renderer.js';

export type DocxExportStatus =
  | 'queued'
  | 'rendering_pdf'
  | 'analyzing_pdf'
  | 'building_docx'
  | 'validating'
  | 'completed'
  | 'failed';

export type DocxExportErrorCode =
  | 'PDF_RENDER_FAILED'
  | 'PDF_ANALYSIS_FAILED'
  | 'DOCX_BUILD_FAILED'
  | 'DOCX_VALIDATION_FAILED'
  | 'STORAGE_UPLOAD_FAILED'
  | 'EXPORT_TIMEOUT'
  | 'EXPORT_MEMORY_LIMIT';

export type ExportManifestElementType = 'text' | 'table' | 'image' | 'chart';

export interface ExportManifestElement {
  type: ExportManifestElementType;
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

export interface ExportManifest {
  version?: number;
  elements: ExportManifestElement[];
  content?: ExportManifestContentItem[];
}

export interface ExportHybridManifest extends ExportManifest {
  version: 2;
  content: ExportManifestContentItem[];
}

export interface ExportPageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ExportPageConfig {
  widthMm: number;
  heightMm: number;
  margins: ExportPageMargins;
  contentWidthMm: number;
  contentHeightMm: number;
  landscape: boolean;
}

export interface ExportTextLine {
  text: string;
  fontSize?: number;
  bold?: boolean;
}

export interface ExportPageImage {
  data: Buffer;
  widthPx: number;
  heightPx: number;
  displayWidthPx: number;
  displayHeightPx: number;
}

export interface ExportPageModel {
  number: number;
  image: ExportPageImage;
  textLines: ExportTextLine[];
}

export interface ExportEditableBlock {
  text: string;
  kind: 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'paragraph';
  selector: string;
}

export interface ExportDocumentModel {
  page: ExportPageConfig;
  pages: ExportPageModel[];
  fileName: string;
  manifest?: ExportManifest;
  editableBlocks?: ExportEditableBlock[];
}

export interface DocxExportJobMetrics {
  pdfRenderTimeMs?: number;
  pdfSizeBytes?: number;
  pdfPages?: number;
  analysisTimeMs?: number;
  docxBuildTimeMs?: number;
  docxSizeBytes?: number;
  validationTimeMs?: number;
  totalTimeMs?: number;
}

export interface DocxExportJobRecord {
  jobId: string;
  status: DocxExportStatus;
  fileName: string;
  htmlStoragePath?: string;
  htmlInline?: string;
  options: HtmlPdfRenderOptions;
  manifest?: ExportManifest;
  downloadPath?: string;
  downloadToken?: string;
  errorCode?: DocxExportErrorCode;
  errorMessage?: string;
  metrics?: DocxExportJobMetrics;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface DocxExportPipelineInput {
  jobId: string;
  html: string;
  options: HtmlPdfRenderOptions;
  fileName: string;
  manifest?: ExportManifest;
  onStatusChange?: (status: DocxExportStatus) => Promise<void>;
}

export interface DocxExportPipelineResult {
  docxBuffer: Buffer;
  metrics: DocxExportJobMetrics;
  documentModel: ExportDocumentModel;
}

export interface PdfRenderer {
  render(html: string, options: HtmlPdfRenderOptions): Promise<Buffer>;
}

export interface PdfAnalyzer {
  analyze(pdf: Buffer, pageConfig: ExportPageConfig): Promise<ExportDocumentModel>;
}

export interface DocxBuilder {
  build(model: ExportDocumentModel): Promise<Buffer>;
}

export interface DocxValidator {
  validate(docx: Buffer, model: ExportDocumentModel): Promise<void>;
}
