import fs from 'fs';
import JSZip from 'jszip';

const files = fs.readdirSync('.').filter((f) => f.includes('sistema_2') && f.endsWith('.pptx'));
const pptx = files.find((f) => f.includes('(1)')) || files[0];
const buffer = fs.readFileSync(pptx);
const zip = await JSZip.loadAsync(buffer);

const slideNames = Object.keys(zip.files)
  .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1], 10) - parseInt(b.match(/slide(\d+)/)[1], 10));

for (const name of slideNames) {
  const xml = await zip.file(name).async('string');
  const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1].trim()).filter(Boolean);
  const num = name.match(/slide(\d+)/)[1];
  console.log(`=== SLIDE ${num} ===`);
  console.log(texts.join('\n'));
  console.log('');
}
