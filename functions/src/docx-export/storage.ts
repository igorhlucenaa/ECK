import { randomUUID } from 'crypto';
import { DocxExportError } from './errors.js';
import { getStorageBucket, getStorageBucketName } from '../shared/firebase-admin.js';

const HTML_INLINE_MAX_BYTES = 900_000;
const EXPORT_PREFIX = 'docx-exports';

function getBucket() {
  return getStorageBucket();
}

export function shouldStoreHtmlInGcs(html: string): boolean {
  return Buffer.byteLength(html, 'utf8') > HTML_INLINE_MAX_BYTES;
}

export async function uploadHtmlInput(jobId: string, html: string): Promise<string> {
  const path = `${EXPORT_PREFIX}/${jobId}/input.html`;
  try {
    await getBucket().file(path).save(html, {
      contentType: 'text/html; charset=utf-8',
      resumable: false,
      metadata: {
        cacheControl: 'no-store',
      },
    });
    return path;
  } catch (error) {
    throw new DocxExportError(
      'STORAGE_UPLOAD_FAILED',
      'Falha ao salvar HTML de entrada no Storage.',
      error
    );
  }
}

export async function downloadHtmlInput(storagePath: string): Promise<string> {
  try {
    const [buffer] = await getBucket().file(storagePath).download();
    return buffer.toString('utf8');
  } catch (error) {
    throw new DocxExportError(
      'STORAGE_UPLOAD_FAILED',
      'Falha ao recuperar HTML de entrada do Storage.',
      error
    );
  }
}

export async function uploadDocxOutput(
  jobId: string,
  docxBuffer: Buffer,
  fileName: string
): Promise<{ path: string; downloadToken: string }> {
  const safeName = fileName.replace(/[^\w.\-() ]+/g, '_');
  const path = `${EXPORT_PREFIX}/${jobId}/${safeName}`;
  const downloadToken = randomUUID();
  try {
    await getBucket().file(path).save(docxBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      resumable: false,
      metadata: {
        cacheControl: 'private, max-age=0',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });
    return { path, downloadToken };
  } catch (error) {
    throw new DocxExportError(
      'STORAGE_UPLOAD_FAILED',
      'Falha ao salvar DOCX no Storage.',
      error
    );
  }
}

export function createFirebaseDownloadUrl(storagePath: string, downloadToken: string): string {
  const bucket = getStorageBucketName();
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}

export async function createSignedDownloadUrl(storagePath: string, downloadToken?: string): Promise<string> {
  if (downloadToken) {
    return createFirebaseDownloadUrl(storagePath, downloadToken);
  }

  try {
    const [url] = await getBucket().file(storagePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
    return url;
  } catch (error) {
    throw new DocxExportError(
      'STORAGE_UPLOAD_FAILED',
      'Falha ao gerar URL de download.',
      error
    );
  }
}

export async function deleteExportArtifacts(jobId: string): Promise<void> {
  try {
    await getBucket().deleteFiles({ prefix: `${EXPORT_PREFIX}/${jobId}/` });
  } catch {
    // Limpeza best-effort.
  }
}
