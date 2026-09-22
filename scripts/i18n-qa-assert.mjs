/**
 * QA assertivo de i18n (sem browser): paridade JSON, chaves usadas, HTML hardcoded, TS concat PT.
 * Uso: node scripts/i18n-qa-assert.mjs
 */
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N_DIR = path.join(ROOT, 'src/assets/i18n');

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const pt = flatten(JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'pt-BR.json'), 'utf8')));
const en = flatten(JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'en.json'), 'utf8')));
const es = flatten(JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'es.json'), 'utf8')));

const appFiles = execSync('git ls-files "src/app/**/*.html" "src/app/**/*.ts"', {
  cwd: ROOT,
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean);

const keys = new Set();
const keyPatterns = [
  /translate\.instant\(\s*['"]([^'"]+)['"]/g,
  /\{\{\s*['"]([^'"]+)['"]\s*\|\s*translate/g,
  /this\.t\(\s*['"]([^'"]+)['"]/g,
];

for (const rel of appFiles) {
  const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const pattern of keyPatterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) keys.add(m[1]);
  }
}

const missingPt = [...keys].filter((k) => !(k in pt));
const missingEn = [...keys].filter((k) => k in pt && !(k in en));
const missingEs = [...keys].filter((k) => k in pt && !(k in es));

const usedKeys = [...keys].filter((k) => k in pt);
const enUntranslated = usedKeys.filter((k) => en[k] === pt[k]);
const esUntranslated = usedKeys.filter((k) => es[k] === pt[k]);

/** HTML: texto visível em PT sem pipe translate (heurística). */
const ptWord = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/;
const hardcodedHtml = [];
const htmlFiles = appFiles.filter((f) => f.endsWith('.html'));

for (const rel of htmlFiles) {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('| translate') || line.includes('translate.instant')) return;
    if (line.includes('//') && line.trim().startsWith('//')) return;
    if (!ptWord.test(line)) return;
    if (/\.scss|url\(|matTooltip=|\[matTooltip\]/.test(line) && !/>[^<]*[áéíóú]/.test(line)) {
      // allow some attr-only lines
    }
    if (
      />[^<{]*[áàâãéêíóôõúç][^<]*</.test(line) ||
      (/(subtitle|title|eyebrow|placeholder|mat-label)=["'][^"']*[áàâãéêíóôõúç]/.test(line) &&
        !line.includes('| translate'))
    ) {
      hardcodedHtml.push({ file: rel, line: i + 1, text: line.trim().slice(0, 120) });
    }
  });
}

/** TS: concatenação típica de contadores em português. */
const hardcodedTs = [];
const tsFiles = appFiles.filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
const tsPatterns = [
  /`\$\{[^}]+\}\s*(clientes|projetos|grupos|alertas|modelos|resultados|formulários|participantes)`/,
  /\+\s*['"](clientes|projetos|grupos|alertas|modelos|resultados)['"]/,
  /\$\{[^}]+\}\s*(cliente|projeto|grupo|alerta|modelo|resultado)\$\{/,
];

for (const rel of tsFiles) {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('translate.instant') || line.includes('formatCountLabel')) return;
    for (const re of tsPatterns) {
      if (re.test(line)) {
        hardcodedTs.push({ file: rel, line: i + 1, text: line.trim().slice(0, 120) });
        break;
      }
    }
  });
}

let failed = false;
function assert(name, ok, detail) {
  const status = ok ? 'PASS' : 'FAIL';
  if (!ok) failed = true;
  console.log(`${status} | ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log('=== i18n QA (automático) ===\n');

assert('Chaves usadas no app existem em pt-BR', missingPt.length === 0, `${missingPt.length} faltando`);
assert('Chaves usadas existem em en.json', missingEn.length === 0, `${missingEn.length} faltando`);
assert('Chaves usadas existem em es.json', missingEs.length === 0, `${missingEs.length} faltando`);

assert(
  'EN: chaves usadas traduzidas (<40% idênticas ao PT)',
  enUntranslated.length / Math.max(usedKeys.length, 1) < 0.4,
  `${enUntranslated.length}/${usedKeys.length} idênticas ao PT`
);

assert(
  'ES: chaves usadas traduzidas (<35% idênticas ao PT)',
  esUntranslated.length / Math.max(usedKeys.length, 1) < 0.35,
  `${esUntranslated.length}/${usedKeys.length} idênticas ao PT`
);

assert('HTML hardcoded (heurística) < 120 ocorrências', hardcodedHtml.length < 120, `${hardcodedHtml.length} linhas`);
assert('TS contadores PT hardcoded < 15', hardcodedTs.length < 15, `${hardcodedTs.length} linhas`);

console.log('\n--- Amostra HTML hardcoded (10) ---');
hardcodedHtml.slice(0, 10).forEach((h) => console.log(`  ${h.file}:${h.line} ${h.text}`));

console.log('\n--- TS hardcoded contadores ---');
hardcodedTs.forEach((h) => console.log(`  ${h.file}:${h.line} ${h.text}`));

console.log('\n--- Chaves usadas EN=PT (amostra 15) ---');
enUntranslated.slice(0, 15).forEach((k) => console.log(`  ${k}`));

if (missingPt.length) {
  console.log('\n--- Missing pt-BR (primeiras 10) ---');
  missingPt.slice(0, 10).forEach((k) => console.log(`  ${k}`));
}

process.exit(failed ? 1 : 0);
