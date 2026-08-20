import type { ExportDocumentModel } from './types.js';
import { DocxExportError } from './errors.js';

const REQUIRED_OOXML_ENTRIES = [
  '[Content_Types].xml',
  'word/document.xml',
  'word/_rels/document.xml.rels',
  '_rels/.rels',
];

function listZipEntries(buffer: Buffer): Set<string> {
  const entries = new Set<string>();
  let offset = 0;

  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);
    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;

    if (fileNameEnd > buffer.length) break;

    const fileName = buffer.subarray(fileNameStart, fileNameEnd).toString('utf8');
    entries.add(fileName);

    const dataStart = fileNameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;
    offset = dataEnd;

    if (compressionMethod === 0 && dataEnd > buffer.length) break;
  }

  return entries;
}

export async function validateDocxBuffer(
  docxBuffer: Buffer,
  _model: ExportDocumentModel
): Promise<void> {
  try {
    if (!docxBuffer || docxBuffer.length < 128) {
      throw new Error('DOCX vazio ou invalido.');
    }

    const signature = docxBuffer.subarray(0, 4).toString('hex');
    if (signature !== '504b0304') {
      throw new Error('Assinatura ZIP invalida para DOCX.');
    }

    const entries = listZipEntries(docxBuffer);
    for (const required of REQUIRED_OOXML_ENTRIES) {
      if (!entries.has(required)) {
        throw new Error(`Entrada OOXML ausente: ${required}`);
      }
    }
  } catch (error) {
    throw new DocxExportError(
      'DOCX_VALIDATION_FAILED',
      'Validacao do DOCX falhou.',
      error
    );
  }
}
