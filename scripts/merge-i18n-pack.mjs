import fs from 'fs';
import path from 'path';

const repo = path.resolve(import.meta.dirname, '..');
const pack = JSON.parse(
  fs.readFileSync(path.join(repo, 'scripts/i18n-pack-new.json'), 'utf8')
);
const i18nDir = path.join(repo, 'src/assets/i18n');
const langs = ['pt-BR', 'en', 'es'];

for (const lang of langs) {
  const file = path.join(i18nDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  for (const [key, translations] of Object.entries(pack)) {
    if (!(key in data)) {
      data[key] = translations[lang];
      added++;
    } else {
      data[key] = translations[lang];
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`${lang}: merged ${Object.keys(pack).length} keys (${added} new)`);
}

// Mirror es-only dashboard EN keys into en.json
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));
const es = JSON.parse(fs.readFileSync(path.join(i18nDir, 'es.json'), 'utf8'));
let mirrored = 0;
for (const key of Object.keys(es)) {
  if (!(key in en) && /^[A-Za-z]/.test(key)) {
    en[key] = key;
    mirrored++;
  }
}
if (mirrored) {
  fs.writeFileSync(path.join(i18nDir, 'en.json'), JSON.stringify(en, null, 2) + '\n');
  console.log(`en: mirrored ${mirrored} keys from es`);
}
