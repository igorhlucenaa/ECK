import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { normalizeHtmlPdfOptions } from '../shared/pdf-html-renderer.js';
import { getFirestoreDb, getStorageBucket } from '../shared/firebase-admin.js';
import { sanitizeDocxFileName } from './dimensions.js';
import { DocxExportError, toPublicErrorMessage } from './errors.js';
import { runDocxExportPipeline } from './pipeline.js';
import {
  deleteExportArtifacts,
  downloadHtmlInput,
  shouldStoreHtmlInGcs,
  uploadDocxOutput,
  uploadHtmlInput,
} from './storage.js';
import type {
  DocxExportJobRecord,
  DocxExportStatus,
  ExportManifest,
  ExportManifestContentItem,
  ExportTextHeadingKind,
  ExportTextRun,
  ExportTextStyles,
} from './types.js';

const JOBS_COLLECTION = 'docxExportJobs';
const HTML_INLINE_MAX_CHARS = 900_000;

function omitUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function getDb(): Firestore {
  return getFirestoreDb();
}

function parseTextStyles(raw: unknown): ExportTextStyles | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;
  const fontSizePt = Number(entry.fontSizePt);
  const color = typeof entry.color === 'string' ? entry.color : '333333';

  return {
    fontSizePt: Number.isFinite(fontSizePt) ? fontSizePt : 11,
    color: color.replace('#', '').slice(0, 6),
    bold: Boolean(entry.bold),
    italic: Boolean(entry.italic),
    spacingBeforePt: Number(entry.spacingBeforePt) || 0,
    spacingAfterPt: Number(entry.spacingAfterPt) || 0,
  };
}

function parseDomPath(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const path = raw.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0);
  return path.length > 0 ? path : [];
}

function parseManifestContent(raw: unknown): ExportManifestContentItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const content: ExportManifestContentItem[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const kind = entry.kind;

    if (kind === 'pageBreak') {
      content.push({ kind: 'pageBreak' });
      continue;
    }

    if (kind === 'text') {
      const text = typeof entry.text === 'string' ? entry.text.trim() : '';
      const styles = parseTextStyles(entry.styles);
      const domPath = parseDomPath(entry.domPath);
      if (!text || !styles || domPath === null) continue;

      const headingRaw = entry.heading;
      const heading = typeof headingRaw === 'string'
        ? headingRaw as ExportTextHeadingKind
        : undefined;

      const runsRaw = entry.runs;
      const runs = Array.isArray(runsRaw)
        ? runsRaw
          .map((run) => {
            if (!run || typeof run !== 'object') return null;
            const runEntry = run as Record<string, unknown>;
            const runText = typeof runEntry.text === 'string' ? runEntry.text : '';
            const runStyles = parseTextStyles(runEntry.styles);
            if (!runText || !runStyles) return null;
            return { text: runText, styles: runStyles } satisfies ExportTextRun;
          })
          .filter((run): run is ExportTextRun => run !== null)
        : undefined;

      content.push({
        kind: 'text',
        text,
        runs: runs?.length ? runs : undefined,
        heading,
        styles,
        domPath,
      });
      continue;
    }

      if (kind === 'visual') {
      const captureId = typeof entry.captureId === 'string' ? entry.captureId.trim() : '';
      const domPath = parseDomPath(entry.domPath);
      if (!captureId || domPath === null || domPath.length === 0) continue;

      content.push({
        kind: 'visual',
        captureId,
        domPath,
        useEmbeddedImage: Boolean(entry.useEmbeddedImage),
        fullPage: Boolean(entry.fullPage),
      });
    }
  }

  return content.length > 0 ? content : undefined;
}

function parseManifest(raw: unknown): ExportManifest | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const manifestRaw = raw as Record<string, unknown>;
  const elementsRaw = manifestRaw.elements;

  const elements = Array.isArray(elementsRaw)
    ? elementsRaw
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const entry = item as Record<string, unknown>;
        const type = entry.type;
        const selector = entry.selector;
        if (
          (type !== 'text' && type !== 'table' && type !== 'image' && type !== 'chart') ||
          typeof selector !== 'string'
        ) {
          return null;
        }
        return {
          type,
          selector,
          editable: entry.editable !== false,
        };
      })
      .filter((item): item is ExportManifest['elements'][number] => item !== null)
    : [];

  const content = parseManifestContent(manifestRaw.content);
  const version = Number(manifestRaw.version);

  if (elements.length === 0 && !content?.length) {
    return undefined;
  }

  if (version === 2 && !content?.length) {
    return undefined;
  }

  return {
    version: version === 2 ? 2 : undefined,
    elements,
    content,
  };
}

function getManifestStats(manifest?: ExportManifest): Record<string, number> | null {
  if (!manifest?.content?.length) {
    return null;
  }

  return {
    version: manifest.version ?? 1,
    textBlocks: manifest.content.filter((item) => item.kind === 'text').length,
    visualBlocks: manifest.content.filter((item) => item.kind === 'visual').length,
    pageBreaks: manifest.content.filter((item) => item.kind === 'pageBreak').length,
  } as Record<string, number>;
}

async function updateJobStatus(
  jobId: string,
  status: DocxExportStatus,
  extra: Partial<DocxExportJobRecord> = {}
): Promise<void> {
  await getDb().collection(JOBS_COLLECTION).doc(jobId).set(
    omitUndefined({
      status,
      updatedAt: FieldValue.serverTimestamp(),
      ...extra,
    }),
    { merge: true }
  );
}

function logExportError(scope: string, jobId: string | undefined, error: unknown): void {
  const details = error instanceof DocxExportError
    ? { code: error.code, message: error.message }
    : error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { raw: String(error) };

  console.error(`[docx-export:${scope}]`, {
    jobId,
    ...details,
  });
}

function buildDocxDownloadUrl(jobId: string): string {
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'pwa-workana';
  return `https://us-central1-${project}.cloudfunctions.net/downloadReportDocxExport?jobId=${encodeURIComponent(jobId)}`;
}

function getProcessDocxExportUrl(): string {
  if (process.env.PROCESS_REPORT_DOCX_EXPORT_URL) {
    return process.env.PROCESS_REPORT_DOCX_EXPORT_URL;
  }

  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'pwa-workana';
    const port = process.env.FUNCTIONS_EMULATOR_PORT || '5001';
    return `http://127.0.0.1:${port}/${project}/us-central1/processReportDocxExportHttp`;
  }

  return `https://us-central1-${process.env.GCLOUD_PROJECT || 'pwa-workana'}.cloudfunctions.net/processReportDocxExportHttp`;
}

async function kickoffDocxExportProcessing(jobId: string): Promise<void> {
  const url = getProcessDocxExportUrl();
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

  console.log('[docx-export:create] Disparando processamento', {
    jobId,
    url,
    isEmulator,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.warn('[docx-export:create] Falha ao disparar processamento HTTP', {
        jobId,
        url,
        status: response.status,
        body: body.slice(0, 500),
      });
      return;
    }

    console.log('[docx-export:create] Processamento HTTP aceito', { jobId, url });
  } catch (error) {
    console.warn('[docx-export:create] Erro ao disparar processamento HTTP', {
      jobId,
      url,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function claimQueuedJob(jobId: string): Promise<DocxExportJobRecord | null> {
  const ref = getDb().collection(JOBS_COLLECTION).doc(jobId);

  return getDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      return null;
    }

    const job = snapshot.data() as DocxExportJobRecord;
    if (job.status !== 'queued') {
      return null;
    }

    transaction.set(ref, {
      status: 'rendering_pdf',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return job;
  });
}

async function executeDocxExportJob(jobId: string): Promise<void> {
  const job = await claimQueuedJob(jobId);
  if (!job) {
    console.log('[docx-export:process] Job ignorado (ausente ou ja processado)', { jobId });
    return;
  }

  const startedAt = Date.now();

  try {
    const html = job.htmlInline
      ? job.htmlInline
      : job.htmlStoragePath
        ? await downloadHtmlInput(job.htmlStoragePath)
        : '';

    if (!html.trim()) {
      throw new DocxExportError('DOCX_BUILD_FAILED', 'HTML de entrada ausente para exportacao.');
    }

    const manifestStats = getManifestStats(job.manifest);
    console.log('[docx-export:process] Iniciando pipeline hibrido', {
      jobId,
      fileName: job.fileName,
      htmlSource: job.htmlInline ? 'inline' : 'gcs',
      manifestStats,
    });

    if (job.manifest?.version === 2 && manifestStats && manifestStats.textBlocks === 0) {
      throw new DocxExportError(
        'DOCX_BUILD_FAILED',
        'Manifesto hibrido sem blocos de texto editavel. Atualize o frontend e tente novamente.'
      );
    }

    const result = await runDocxExportPipeline({
      jobId,
      html,
      options: job.options,
      fileName: job.fileName,
      manifest: job.manifest,
      onStatusChange: async (status) => {
        await updateJobStatus(jobId, status);
      },
    });

    const uploadResult = await uploadDocxOutput(jobId, result.docxBuffer, job.fileName);

    await updateJobStatus(jobId, 'completed', {
      downloadPath: uploadResult.path,
      downloadToken: uploadResult.downloadToken,
      metrics: result.metrics,
    });

    console.log('[docx-export:process] Exportacao concluida', {
      jobId,
      fileName: job.fileName,
      pdfPages: result.metrics.pdfPages,
      totalTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    const exportError = error instanceof DocxExportError
      ? error
      : new DocxExportError('DOCX_BUILD_FAILED', 'Falha ao processar exportacao DOCX.', error);

    await updateJobStatus(jobId, 'failed', {
      errorCode: exportError.code,
      errorMessage: exportError.message,
      metrics: {
        totalTimeMs: Date.now() - startedAt,
      },
    });

    await deleteExportArtifacts(jobId);
    logExportError('process', jobId, exportError);
  }
}

export const createReportDocxExport = onRequest(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send({ error: 'Metodo nao permitido. Use POST.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const rawHtml = body.html;
    const fileName = sanitizeDocxFileName(body.fileName);
    const options = normalizeHtmlPdfOptions(body.options);
    const manifest = parseManifest(body.manifest);

    if (typeof rawHtml !== 'string' || !rawHtml.trim()) {
      res.status(400).send({ error: 'Campo obrigatorio ausente: html (string).' });
      return;
    }

    const jobId = randomUUID();
    const db = getDb();
    const createdAt = FieldValue.serverTimestamp();

    try {
      let htmlStoragePath: string | undefined;
      let htmlInline: string | undefined;
      const htmlBytes = Buffer.byteLength(rawHtml, 'utf8');
      const useGcs = shouldStoreHtmlInGcs(rawHtml);

      console.log('[docx-export:create] Iniciando job', {
        jobId,
        fileName,
        htmlBytes,
        useGcs,
        hasManifest: Boolean(manifest?.content?.length || manifest?.elements?.length),
        manifestStats: getManifestStats(manifest),
      });

      if (useGcs) {
        htmlStoragePath = await uploadHtmlInput(jobId, rawHtml);
      } else if (rawHtml.length <= HTML_INLINE_MAX_CHARS) {
        htmlInline = rawHtml;
      } else {
        htmlStoragePath = await uploadHtmlInput(jobId, rawHtml);
      }

      await db.collection(JOBS_COLLECTION).doc(jobId).set(
        omitUndefined({
          jobId,
          status: 'queued',
          fileName,
          htmlStoragePath,
          htmlInline,
          options,
          manifest,
          createdAt,
          updatedAt: createdAt,
        })
      );

      console.log('[docx-export:create] Job enfileirado', {
        jobId,
        htmlStoragePath: htmlStoragePath || null,
        htmlInlineBytes: htmlInline ? Buffer.byteLength(htmlInline, 'utf8') : 0,
      });

      void kickoffDocxExportProcessing(jobId);

      res.status(202).send({
        jobId,
        status: 'queued',
      });
    } catch (error) {
      logExportError('create', jobId, error);
      const exportError = error instanceof DocxExportError
        ? error
        : new DocxExportError('DOCX_BUILD_FAILED', 'Falha ao criar job de exportacao DOCX.', error);
      res.status(500).send({
        error: toPublicErrorMessage(exportError.code),
        errorCode: exportError.code,
        detail: exportError.message,
      });
    }
  }
);

export const getReportDocxExportStatus = onRequest(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).send({ error: 'Metodo nao permitido. Use GET.' });
      return;
    }

    const jobId = typeof req.query.jobId === 'string'
      ? req.query.jobId
      : typeof req.params?.jobId === 'string'
        ? req.params.jobId
        : '';

    if (!jobId) {
      res.status(400).send({ error: 'Parametro obrigatorio ausente: jobId.' });
      return;
    }

    try {
      const snapshot = await getDb().collection(JOBS_COLLECTION).doc(jobId).get();
      if (!snapshot.exists) {
        res.status(404).send({ error: 'Job de exportacao nao encontrado.' });
        return;
      }

      const job = snapshot.data() as DocxExportJobRecord;
      let downloadUrl: string | undefined;

      if (job.status === 'completed' && job.downloadPath) {
        downloadUrl = buildDocxDownloadUrl(jobId);
      }

      res.status(200).send({
        jobId: job.jobId,
        status: job.status,
        fileName: job.fileName,
        downloadUrl,
        errorCode: job.errorCode,
        errorMessage: job.errorCode ? toPublicErrorMessage(job.errorCode) : undefined,
        metrics: job.metrics,
      });
    } catch (error) {
      logExportError('status', jobId, error);
      res.status(500).send({
        error: 'Nao foi possivel consultar status da exportacao DOCX.',
      });
    }
  }
);

export const downloadReportDocxExport = onRequest(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).send({ error: 'Metodo nao permitido. Use GET.' });
      return;
    }

    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId.trim() : '';
    if (!jobId) {
      res.status(400).send({ error: 'Parametro obrigatorio ausente: jobId.' });
      return;
    }

    try {
      const snapshot = await getDb().collection(JOBS_COLLECTION).doc(jobId).get();
      if (!snapshot.exists) {
        res.status(404).send({ error: 'Job de exportacao nao encontrado.' });
        return;
      }

      const job = snapshot.data() as DocxExportJobRecord;
      if (job.status !== 'completed' || !job.downloadPath) {
        res.status(404).send({ error: 'Arquivo DOCX ainda nao disponivel.' });
        return;
      }

      const [buffer] = await getStorageBucket().file(job.downloadPath).download();
      const fileName = job.fileName || 'relatorio.docx';
      const encodedName = encodeURIComponent(fileName);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
      );
      res.setHeader('Cache-Control', 'private, max-age=0, no-store');
      res.status(200).send(buffer);
    } catch (error) {
      logExportError('download', jobId, error);
      res.status(500).send({ error: 'Nao foi possivel baixar o DOCX gerado.' });
    }
  }
);

export const processReportDocxExportHttp = onRequest(
  {
    region: 'us-central1',
    cors: false,
    timeoutSeconds: 540,
    memory: '4GiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send({ error: 'Metodo nao permitido. Use POST.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';

    if (!jobId) {
      res.status(400).send({ error: 'Campo obrigatorio ausente: jobId.' });
      return;
    }

    console.log('[docx-export:http] Processamento solicitado', { jobId });
    await executeDocxExportJob(jobId);
    res.status(200).send({ jobId, status: 'processed' });
  }
);

export const processReportDocxExportJob = onDocumentCreated(
  {
    document: `${JOBS_COLLECTION}/{jobId}`,
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '4GiB',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const jobId = event.params.jobId;
    await executeDocxExportJob(jobId);
  }
);
