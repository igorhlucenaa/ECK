/**
 * Adiciona ao pt-BR.json chaves usadas no app que ainda não existem (valor = própria chave).
 * Uso: node scripts/sync-pt-br-missing-keys.mjs
 */
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ptPath = path.join(ROOT, 'src/assets/i18n/pt-BR.json');

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const ptFlat = flatten(JSON.parse(fs.readFileSync(ptPath, 'utf8')));
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

const missing = [...keys].filter((k) => !(k in ptFlat));
if (!missing.length) {
  console.log('Nenhuma chave faltando em pt-BR.');
  process.exit(0);
}

const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
for (const k of missing.sort()) {
  pt[k] = k;
}
fs.writeFileSync(ptPath, `${JSON.stringify(pt, null, 2)}\n`, 'utf8');
console.log(`Adicionadas ${missing.length} chaves em pt-BR.json`);
