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

function unflatten(flat) {
  const result = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cur)) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return result;
}

const langs = ['pt-BR', 'en', 'es', 'de', 'fr'];
const data = {};
for (const lang of langs) {
  const path = `src/assets/i18n/${lang}.json`;
  data[lang] = flatten(JSON.parse(fs.readFileSync(path, 'utf8')));
}

const pt = data['pt-BR'];
const ptKeys = new Set(Object.keys(pt));

console.log('=== Key counts ===');
for (const lang of langs) {
  console.log(`${lang}: ${Object.keys(data[lang]).length}`);
}

console.log('\n=== Missing vs pt-BR ===');
for (const lang of langs.filter((l) => l !== 'pt-BR')) {
  const missing = [...ptKeys].filter((k) => !(k in data[lang]));
  const extra = Object.keys(data[lang]).filter((k) => !ptKeys.has(k));
  console.log(`${lang}: missing ${missing.length}, extra ${extra.length}`);
}

// Save full missing lists
for (const lang of ['en', 'es']) {
  const missing = [...ptKeys].filter((k) => !(k in data[lang]));
  fs.writeFileSync(`scripts/i18n-missing-${lang}.txt`, missing.join('\n'));
  console.log(`Wrote scripts/i18n-missing-${lang}.txt (${missing.length} keys)`);
}
