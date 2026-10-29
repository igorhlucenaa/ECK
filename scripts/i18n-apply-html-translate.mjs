/**
 * Aplica | translate em textos PT hardcoded (lista scripts/i18n-html-leaks.json).
 * Ignora eyebrow/subtitle (app-page-header já traduz) e customizer de idiomas.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leaksRaw = fs.readFileSync(path.join(ROOT, 'scripts/i18n-html-leaks.json'), 'utf8').replace(/^\uFEFF/, '');
const leaks = JSON.parse(leaksRaw);

const SKIP_FILES = ['customizer.component.html'];
const SKIP_PATTERNS = [
  /eyebrow=/,
  /subtitle=/,
  /ngNonBindable/,
  /vars-example/,
  /setLang\(/,
  /placeholder="Ex:/,
  /Pág\. 1\/10/,
];

/** @type {Map<string, string[]>} file -> replacements applied */
const stats = new Map();

function shouldSkip(entry) {
  if (SKIP_FILES.some((f) => entry.file.includes(f))) return true;
  if (SKIP_PATTERNS.some((re) => re.test(entry.text))) return true;
  return false;
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchLine(line) {
  let out = line;
  // >Plain text< (no nested tags in text)
  out = out.replace(/>([^<>{}\n]+)</g, (m, text) => {
    const t = text.trim();
    if (!t || !/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(t)) return m;
    if (t.includes('{{') || t.includes('| translate')) return m;
    if (/^\s*$/.test(t)) return m;
    return `>{{ '${t.replace(/'/g, "\\'")}' | translate }}<`;
  });
  // mat-label>text</mat-label>
  out = out.replace(/<mat-label>([^<]+)<\/mat-label>/g, (m, text) => {
    const t = text.trim();
    if (!/[áàâãéêíóôõúç]/.test(t)) return m;
    return `<mat-label>{{ '${t.replace(/'/g, "\\'")}' | translate }}</mat-label>`;
  });
  // placeholder="pt text"
  out = out.replace(/placeholder="([^"]*[áàâãéêíóôõúç][^"]*)"/g, (m, text) => {
    if (m.includes('| translate')) return m;
    return `[placeholder]="'${text.replace(/'/g, "\\'")}' | translate"`;
  });
  return out;
}

for (const entry of leaks) {
  if (shouldSkip(entry)) continue;
  const abs = path.join(ROOT, entry.file);
  if (!fs.existsSync(abs)) continue;
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const idx = entry.line - 1;
  if (idx < 0 || idx >= lines.length) continue;
  const before = lines[idx];
  const after = patchLine(before);
  if (after !== before) {
    lines[idx] = after;
    fs.writeFileSync(abs, lines.join('\n'), 'utf8');
    const n = stats.get(entry.file) ?? 0;
    stats.set(entry.file, n + 1);
  }
}

console.log('HTML patches by file:');
for (const [f, n] of [...stats.entries()].sort()) console.log(`  ${f}: ${n}`);
console.log(`Total lines patched: ${[...stats.values()].reduce((a, b) => a + b, 0)}`);
