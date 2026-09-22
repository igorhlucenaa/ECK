import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const repo = path.resolve(import.meta.dirname, '..');
const i18nDir = path.join(repo, 'src/assets/i18n');
const langs = ['pt-BR', 'en', 'es'];
const dict = Object.fromEntries(
  langs.map((l) => [l, JSON.parse(fs.readFileSync(path.join(i18nDir, `${l}.json`), 'utf8'))])
);

function rg(pattern, globs) {
  try {
    const cmd = `rg -o ${pattern} ${globs.map((g) => `--glob "${g}"`).join(' ')} src/app/pages src/app/components src/app/layouts`;
    return execSync(cmd, { cwd: repo, encoding: 'utf8', shell: true })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

const instantKeys = rg(String.raw`translate\.instant\(['"]([^'"]+)['"]`, ['*.ts']);
const pipeKeys = rg(String.raw`['"]([a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+)['"]\s*\|\s*translate`, ['*.html', '*.ts']);

const dotted = [...new Set([...instantKeys, ...pipeKeys].filter((k) => k.includes('.')))];
const missing = {};
for (const l of langs) {
  missing[l] = dotted.filter((k) => !(k in dict[l]));
}

const enKeys = new Set(Object.keys(dict.en));
const esExtra = Object.keys(dict.es).filter((k) => !enKeys.has(k));
const esMissingInEn = esExtra.filter((k) => !(k in dict.en));

console.log(JSON.stringify({ dottedUsed: dotted.length, missing, esExtraCount: esExtra.length, esExtra }, null, 2));
