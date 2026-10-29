import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appFiles = execSync('git ls-files "src/app/**/*.html"', { cwd: ROOT, encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const ptWord = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/;
const hardcodedHtml = [];

for (const rel of appFiles) {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('| translate') || line.includes('translate.instant')) return;
    if (!ptWord.test(line)) return;
    if (
      />[^<{]*[áàâãéêíóôõúç][^<]*</.test(line) ||
      (/(subtitle|title|eyebrow|placeholder|mat-label)=["'][^"']*[áàâãéêíóôõúç]/.test(line) &&
        !line.includes('| translate'))
    ) {
      hardcodedHtml.push({ file: rel, line: i + 1, text: line.trim().slice(0, 120) });
    }
  });
}

const outPath = path.join(ROOT, 'scripts/i18n-html-leaks.json');
fs.writeFileSync(outPath, JSON.stringify(hardcodedHtml, null, 2) + '\n', 'utf8');
console.log(`Wrote ${hardcodedHtml.length} entries to ${outPath}`);
