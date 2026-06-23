import fs from 'fs';
import { execSync } from 'child_process';

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const pt = flatten(JSON.parse(fs.readFileSync('src/assets/i18n/pt-BR.json', 'utf8')));
const enData = flatten(JSON.parse(fs.readFileSync('src/assets/i18n/en.json', 'utf8')));
const esData = flatten(JSON.parse(fs.readFileSync('src/assets/i18n/es.json', 'utf8')));

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

const missingPt = [...keys].filter((k) => !(k in pt));
const missingEn = [...keys].filter((k) => k in pt && !(k in enData));
const missingEs = [...keys].filter((k) => k in pt && !(k in esData));

console.log('Referenced keys:', keys.size);
console.log('Missing in pt-BR:', missingPt.length);
missingPt.forEach((k) => console.log('  [pt]', k));
console.log('Missing in EN (used in app):', missingEn.length);
missingEn.slice(0, 50).forEach((k) => console.log('  [en]', k));
if (missingEn.length > 50) console.log(`  ... +${missingEn.length - 50}`);
console.log('Missing in ES (used in app):', missingEs.length);
missingEs.slice(0, 50).forEach((k) => console.log('  [es]', k));
if (missingEs.length > 50) console.log(`  ... +${missingEs.length - 50}`);
