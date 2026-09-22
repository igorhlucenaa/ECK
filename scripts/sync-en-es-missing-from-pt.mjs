/**
 * Para chaves presentes em pt-BR e usadas no app: preenche en/es se faltarem.
 * Valor inicial: cópia de en.json legado em disco antes do sync, ou tradução já existente em en para chave igual.
 * Se en não tinha a chave, usa pt como placeholder EN e ES (melhor que quebrar UI); prioriza en[k] de backup merge.
 */
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N = path.join(ROOT, 'src/assets/i18n');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(I18N, name), 'utf8'));
}
function save(name, data) {
  fs.writeFileSync(path.join(I18N, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const pt = load('pt-BR.json');
const en = load('en.json');
const es = load('es.json');

const content = execSync('rg "." src/app -g"*.html" -g"*.ts" --no-filename -N', {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});
const keys = new Set();
for (const pattern of [
  /translate\.instant\(\s*['"]([^'"]+)['"]/g,
  /\{\{\s*['"]([^'"]+)['"]\s*\|\s*translate/g,
  /this\.t\(\s*['"]([^'"]+)['"]/g,
]) {
  let m;
  while ((m = pattern.exec(content)) !== null) keys.add(m[1]);
}

const used = [...keys].filter((k) => k in pt);
let addedEn = 0;
let addedEs = 0;

for (const k of used) {
  if (!(k in en)) {
    en[k] = es[k] ?? k;
    addedEn++;
  }
  if (!(k in es)) {
    es[k] = en[k] ?? k;
    addedEs++;
  }
}

save('en.json', en);
save('es.json', es);
console.log(`Added to en.json: ${addedEn}, es.json: ${addedEs}`);
