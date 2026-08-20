import { buildExportPageConfig } from './dimensions.js';
import { buildDocxFromHtml } from './hybrid-docx-builder.js';
import { validateDocxBuffer } from './docx-validator.js';
import { DocxExportError } from './errors.js';
import type {
  DocxExportPipelineInput,
  DocxExportPipelineResult,
  DocxExportStatus,
  ExportDocumentModel,
} from './types.js';

async function updateStatus(
  callback: DocxExportPipelineInput['onStatusChange'],
  status: DocxExportStatus
): Promise<void> {
  if (callback) {
    await callback(status);
  }
}

export async function runDocxExportPipeline(
  input: DocxExportPipelineInput
): Promise<DocxExportPipelineResult> {
  const startedAt = Date.now();
  const metrics: DocxExportPipelineResult['metrics'] = {};
  const pageConfig = buildExportPageConfig(input.options);

  const documentModel: ExportDocumentModel = {
    page: pageConfig,
    pages: [],
    fileName: input.fileName,
    manifest: input.manifest,
  };

  try {
    await updateStatus(input.onStatusChange, 'rendering_pdf');
    const renderStartedAt = Date.now();

    const built = await buildDocxFromHtml({
      html: input.html,
      manifest: input.manifest,
      options: input.options,
      pageConfig,
      fileName: input.fileName,
    });

    metrics.pdfRenderTimeMs = Date.now() - renderStartedAt;
    metrics.pdfSizeBytes = built.pdfSizeBytes;
    metrics.pdfPages = built.pdfPageCount;
    metrics.analysisTimeMs = 0;

    await updateStatus(input.onStatusChange, 'building_docx');
    metrics.docxBuildTimeMs = 0;
    metrics.docxSizeBytes = built.docxBuffer.length;

    await updateStatus(input.onStatusChange, 'validating');
    const validationStartedAt = Date.now();
    await validateDocxBuffer(built.docxBuffer, documentModel);
    metrics.validationTimeMs = Date.now() - validationStartedAt;
    metrics.totalTimeMs = Date.now() - startedAt;

    return {
      docxBuffer: built.docxBuffer,
      metrics,
      documentModel,
    };
  } catch (error) {
    if (error instanceof DocxExportError) {
      throw error;
    }
    throw new DocxExportError(
      'DOCX_BUILD_FAILED',
      'Falha inesperada na pipeline de exportacao DOCX.',
      error
    );
  }
}
