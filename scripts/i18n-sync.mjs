/**
 * Sincroniza i18n: pt-BR como fonte de chaves, en/es como traduções.
 * Uso: node scripts/i18n-sync.mjs
 */
import fs from 'fs';
import { execSync } from 'child_process';

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function sortObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')));
}

function saveJson(path, data) {
  fs.writeFileSync(path, JSON.stringify(sortObject(data), null, 2) + '\n', 'utf8');
}

function collectReferencedKeys() {
  const content = execSync('rg "." src/app -g"*.html" -g"*.ts" --no-filename -N', {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const keys = new Set();
  const patterns = [
    /translate\.instant\(\s*['"]([^'"]+)['"]/g,
    /\{\{\s*['"]([^'"]+)['"]\s*\|\s*translate/g,
    /this\.t\(\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) keys.add(m[1]);
  }
  return keys;
}

const ptPath = 'src/assets/i18n/pt-BR.json';
const enPath = 'src/assets/i18n/en.json';
const esPath = 'src/assets/i18n/es.json';

let pt = loadJson(ptPath);
let en = loadJson(enPath);
let es = loadJson(esPath);

const referenced = collectReferencedKeys();

// Chaves referenciadas no código → pt-BR (valor = própria chave em PT)
for (const key of referenced) {
  if (!(key in pt)) pt[key] = key;
}

// Chaves presentes em en/es mas ausentes em pt-BR (legado) → incorporar ao pt-BR
for (const key of Object.keys(en)) {
  if (!(key in pt)) pt[key] = key;
}
for (const key of Object.keys(es)) {
  if (!(key in pt)) pt[key] = key;
}

// Sincronizar en e es: mesma lista de chaves que pt-BR
const ptKeys = Object.keys(pt);
let addedEn = 0;
let addedEs = 0;

for (const key of ptKeys) {
  const ptVal = pt[key];
  if (!(key in en)) {
    en[key] = ptVal;
    addedEn++;
  }
  if (!(key in es)) {
    es[key] = en[key] ?? ptVal;
    addedEs++;
  }
}

// Remover chaves órfãs (não estão em pt-BR)
const ptSet = new Set(ptKeys);
let removedEn = 0;
let removedEs = 0;
for (const key of Object.keys({ ...en })) {
  if (!ptSet.has(key)) {
    delete en[key];
    removedEn++;
  }
}
for (const key of Object.keys({ ...es })) {
  if (!ptSet.has(key)) {
    delete es[key];
    removedEs++;
  }
}

saveJson(ptPath, pt);
saveJson(enPath, en);
saveJson(esPath, es);

// Relatório de chaves ainda iguais ao PT (provável tradução faltando)
const enUntranslated = ptKeys.filter((k) => en[k] === pt[k] && /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(k));
const esUntranslated = ptKeys.filter((k) => es[k] === pt[k] && /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(k));

console.log('Sync complete:');
console.log(`  Referenced in code: ${referenced.size}`);
console.log(`  pt-BR: ${ptKeys.length} keys`);
console.log(`  en: +${addedEn} added, -${removedEn} removed → ${Object.keys(en).length}`);
console.log(`  es: +${addedEs} added, -${removedEs} removed → ${Object.keys(es).length}`);
console.log(`  EN likely untranslated (PT chars in key): ${enUntranslated.length}`);
console.log(`  ES likely untranslated (PT chars in key): ${esUntranslated.length}`);

fs.writeFileSync('scripts/i18n-en-untranslated.txt', enUntranslated.join('\n'));
fs.writeFileSync('scripts/i18n-es-untranslated.txt', esUntranslated.join('\n'));

const missingInPt = [...referenced].filter((k) => !(k in loadJson(ptPath)));
console.log(`  Still missing in pt-BR after sync: ${missingInPt.length}`);
