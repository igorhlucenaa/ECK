import type { DocxExportErrorCode } from './types.js';

export class DocxExportError extends Error {
  readonly code: DocxExportErrorCode;

  constructor(code: DocxExportErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'DocxExportError';
    this.code = code;
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export function toPublicErrorMessage(code: DocxExportErrorCode): string {
  switch (code) {
    case 'PDF_RENDER_FAILED':
      return 'Nao foi possivel gerar o PDF de referencia para exportacao.';
    case 'PDF_ANALYSIS_FAILED':
      return 'Nao foi possivel analisar o PDF gerado.';
    case 'DOCX_BUILD_FAILED':
      return 'Nao foi possivel construir o documento Word.';
    case 'DOCX_VALIDATION_FAILED':
      return 'O documento Word gerado nao passou na validacao.';
    case 'STORAGE_UPLOAD_FAILED':
      return 'Nao foi possivel salvar o arquivo exportado.';
    case 'EXPORT_TIMEOUT':
      return 'A exportacao excedeu o tempo limite.';
    case 'EXPORT_MEMORY_LIMIT':
      return 'A exportacao excedeu o limite de memoria.';
    default:
      return 'Erro ao exportar DOCX.';
  }
}
