/**
 * Fixes UTF-8 mojibake — strings that were stored in Firestore as Latin-1 bytes
 * instead of proper UTF-8 (e.g. "Ã©" → "é", "Ã§Ã£o" → "ção").
 *
 * How it works: re-interprets each char code as a raw byte and decodes the
 * resulting byte array as UTF-8. If the string is already correct (not
 * mojibake), the decoding will fail and the original string is returned.
 */
export function fixMojibake(value: string): string {
  if (!value) return value;
  try {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code > 255) return value; // Has multi-byte chars → already correct
      bytes[i] = code;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return value; // Original is valid; decoding failed → not mojibake
  }
}

/** Apply fixMojibake to every string field of a plain object (shallow). */
export function fixObjectEncoding<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = { ...obj };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      result[key] = fixMojibake(result[key]);
    }
  }
  return result as T;
}
