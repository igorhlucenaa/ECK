import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/enviroments/environment';
import { PdfHtmlRenderOptions } from '../report-pdfmake.service';
import type { ExportHybridManifest } from './docx-hybrid-manifest';

export type DocxExportStatus =
  | 'queued'
  | 'rendering_pdf'
  | 'analyzing_pdf'
  | 'building_docx'
  | 'validating'
  | 'completed'
  | 'failed';

export interface ExportManifestElement {
  type: 'text' | 'table' | 'image' | 'chart';
  selector: string;
  editable: boolean;
}

export interface ExportManifest {
  version?: number;
  elements: ExportManifestElement[];
  content?: ExportHybridManifest['content'];
}

export type { ExportHybridManifest } from './docx-hybrid-manifest';

export interface DocxExportJob {
  jobId: string;
  status: DocxExportStatus;
  fileName?: string;
  downloadUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface DocxExportRequest {
  html: string;
  fileName: string;
  options?: PdfHtmlRenderOptions;
  manifest?: ExportManifest;
}

const STATUS_LABELS: Record<DocxExportStatus, string> = {
  queued: 'Aguardando processamento...',
  rendering_pdf: 'Preparando paginas do DOCX...',
  analyzing_pdf: 'Processando layout do DOCX...',
  building_docx: 'Montando documento Word...',
  validating: 'Validando DOCX...',
  completed: 'Finalizando download...',
  failed: 'Falha na exportacao',
};

const STATUS_PROGRESS: Record<DocxExportStatus, number> = {
  queued: 18,
  rendering_pdf: 42,
  analyzing_pdf: 62,
  building_docx: 82,
  validating: 94,
  completed: 100,
  failed: 0,
};

export type DocxExportStatusChange = {
  status: DocxExportStatus;
  label: string;
  progress: number;
};

@Injectable({ providedIn: 'root' })
export class DocxExportService {
  private readonly pollIntervalMs = 3000;
  private readonly pollTimeoutMs = 10 * 60 * 1000;

  constructor(private http: HttpClient) {}

  getStatusLabel(status: DocxExportStatus): string {
    return STATUS_LABELS[status] || STATUS_LABELS.queued;
  }

  getStatusProgress(status: DocxExportStatus): number {
    return STATUS_PROGRESS[status] ?? STATUS_PROGRESS.queued;
  }

  buildStatusChange(status: DocxExportStatus, progressOverride?: number): DocxExportStatusChange {
    return {
      status,
      label: this.getStatusLabel(status),
      progress: progressOverride ?? this.getStatusProgress(status),
    };
  }

  async exportDocx(request: DocxExportRequest): Promise<DocxExportJob> {
    const url = this.getCreateExportUrl();
    try {
      return await firstValueFrom(
        this.http.post<DocxExportJob>(url, {
          html: request.html,
          fileName: request.fileName,
          options: request.options,
          manifest: request.manifest,
        })
      );
    } catch (error) {
      throw this.toExportError(error);
    }
  }

  async getExportStatus(jobId: string): Promise<DocxExportJob> {
    const url = this.getStatusUrl(jobId);
    return firstValueFrom(this.http.get<DocxExportJob>(url));
  }

  async exportAndDownload(
    request: DocxExportRequest,
    onStatusChange?: (change: DocxExportStatusChange) => void
  ): Promise<void> {
    const created = await this.exportDocx(request);
    onStatusChange?.(this.buildStatusChange(created.status));

    const completed = await this.pollUntilComplete(created.jobId, onStatusChange);

    if (completed.status !== 'completed') {
      throw new Error(
        completed.errorMessage
        || 'Exportacao DOCX nao concluida.'
      );
    }

    if (!completed.downloadUrl && !completed.jobId) {
      throw new Error('Exportacao DOCX concluida, mas o link de download nao ficou disponivel.');
    }

    await this.downloadFromUrl(completed.downloadUrl || '', request.fileName, completed.jobId);
  }

  async downloadFromUrl(downloadUrl: string, fileName: string, jobId?: string): Promise<void> {
    const safeName = fileName.endsWith('.docx')
      ? fileName
      : `${fileName.replace(/\.pdf$/i, '')}.docx`;

    const resolvedUrl = this.resolveDownloadUrl(downloadUrl, jobId);

    if (this.isCloudFunctionDownloadUrl(resolvedUrl)) {
      await this.downloadViaHttpBlob(resolvedUrl, safeName);
      return;
    }

    await this.downloadViaHiddenFrame(resolvedUrl, safeName);
  }

  private resolveDownloadUrl(downloadUrl: string, jobId?: string): string {
    const proxyBase = environment.functions.downloadReportDocxExportUrl;
    if (jobId && proxyBase) {
      return `${proxyBase}?jobId=${encodeURIComponent(jobId)}`;
    }

    return downloadUrl;
  }

  private isCloudFunctionDownloadUrl(url: string): boolean {
    return /downloadReportDocxExport|cloudfunctions\.net|\.run\.app/.test(url);
  }

  private async downloadViaHttpBlob(downloadUrl: string, fileName: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.get(downloadUrl, {
        responseType: 'blob',
        observe: 'response',
        headers: { Accept: 'application/octet-stream' },
      })
    );

    const contentType = response.headers.get('Content-Type') || '';
    const blob = response.body;

    if (!response.ok || !blob || blob.size === 0) {
      throw new Error('Falha ao baixar DOCX gerado.');
    }

    if (contentType.includes('application/json') || contentType.includes('text/html')) {
      throw new Error(
        'Endpoint de download indisponivel. Faca deploy da function downloadReportDocxExport.'
      );
    }

    this.triggerBlobDownload(blob, fileName);
  }

  private async downloadViaHiddenFrame(downloadUrl: string, fileName: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.title = fileName;
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Falha ao iniciar download do DOCX.'));
      iframe.src = downloadUrl;
      document.body.appendChild(iframe);

      window.setTimeout(() => {
        iframe.remove();
        resolve();
      }, 15000);
    });
  }

  private triggerBlobDownload(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }

  async pollUntilComplete(
    jobId: string,
    onStatusChange?: (change: DocxExportStatusChange) => void
  ): Promise<DocxExportJob> {
    const startedAt = Date.now();
    let queuedPolls = 0;
    let lastStatus: DocxExportStatus | null = null;

    while (Date.now() - startedAt < this.pollTimeoutMs) {
      const job = await this.getExportStatus(jobId);
      let progress = this.getStatusProgress(job.status);

      if (job.status === 'queued') {
        queuedPolls += 1;
        progress = Math.min(24, 15 + Math.floor(queuedPolls / 2));
      }

      if (job.status === 'completed' && !job.downloadUrl) {
        progress = 97;
        onStatusChange?.(this.buildStatusChange('validating', progress));
      } else if (job.status !== lastStatus || job.status === 'queued') {
        onStatusChange?.(this.buildStatusChange(job.status, progress));
        lastStatus = job.status;
      }

      if (job.status === 'failed') {
        return job;
      }

      // Backend pode marcar completed antes de gravar downloadPath/URL no Storage.
      if (job.status === 'completed' && (job.downloadUrl || job.jobId)) {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    throw new Error('Tempo limite ao aguardar exportacao DOCX.');
  }

  private getCreateExportUrl(): string {
    return environment.functions.createReportDocxExportUrl;
  }

  private getStatusUrl(jobId: string): string {
    const base = environment.functions.getReportDocxExportStatusUrl;
    return `${base}?jobId=${encodeURIComponent(jobId)}`;
  }

  private toExportError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { error?: string; errorCode?: string; detail?: string } | null;
      const parts = [
        body?.error,
        body?.detail && body.detail !== body?.error ? body.detail : '',
      ].filter(Boolean);
      if (parts.length > 0) {
        return new Error(parts.join(' — '));
      }
      return new Error(`Erro HTTP ${error.status} ao iniciar exportacao DOCX.`);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('Erro desconhecido ao exportar DOCX.');
  }
}
