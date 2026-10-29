/**
 * E2E: Projetos → Individual PDF → download
 * Uso: node scripts/e2e-project-pdf.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const downloadDir = path.join(root, '.e2e-downloads');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:4200';
const EMAIL = process.env.E2E_EMAIL || 'admin@admin.com';
const PASS = process.env.E2E_PASS || '123@qwe';

function log(step, detail = '') {
  console.log(`[E2E] ${step}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  fs.mkdirSync(downloadDir, { recursive: true });
  for (const f of fs.readdirSync(downloadDir)) {
    if (f.endsWith('.pdf')) fs.unlinkSync(path.join(downloadDir, f));
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    log('Login', BASE);
    await page.goto(`${BASE}/authentication/login`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.locator('input[placeholder="you@email.com"]').fill(EMAIL);
    await page.locator('input[placeholder="••••••••"]').fill(PASS);
    await page.getByRole('button', { name: /Sign in/i }).click();
    await page.waitForURL(/\/(dashboard|projects)/, { timeout: 60_000 });

    log('Projetos');
    await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle', timeout: 120_000 });

    const reportBtn = page.locator('button.act-btn--report').first();
    await reportBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await reportBtn.click();

    await page.getByRole('button', { name: /Continue/i }).waitFor({ timeout: 15_000 });
    log('Modal export', 'Individual PDF + Continue');
    await page.getByRole('button', { name: /Continue/i }).click();

    await page.waitForURL(/\/reports\?.*exportAction=individualPdf/, { timeout: 60_000 });
    log('Relatórios', page.url());

    const pdfResponsePromise = page
      .waitForResponse(
        (r) => r.url().includes('generateReportPdf') && r.request().method() === 'POST',
        { timeout: 300_000 }
      )
      .catch(() => null);

    const downloadPromise = page.waitForEvent('download', { timeout: 300_000 }).catch(() => null);

    await page.waitForURL(/\/projects/, { timeout: 300_000 }).catch(async () => {
      await page.waitForTimeout(5000);
    });

    const pdfResp = await pdfResponsePromise;
    let pdfBytes = 0;
    if (pdfResp) {
      const buf = await pdfResp.body();
      pdfBytes = buf?.length || 0;
      log('Cloud Function', `HTTP ${pdfResp.status()} body ${pdfBytes} bytes`);
    } else {
      log('Cloud Function', 'POST não capturado (timeout ou outro pipeline)');
    }

    const download = await downloadPromise;
    let savedPath = '';
    if (download) {
      const name = download.suggestedFilename();
      savedPath = path.join(downloadDir, name);
      await download.saveAs(savedPath);
      pdfBytes = Math.max(pdfBytes, fs.statSync(savedPath).size);
      log('Download', `${name} (${pdfBytes} bytes) → ${savedPath}`);
    } else {
      const pdfs = fs.readdirSync(downloadDir).filter((f) => f.endsWith('.pdf'));
      if (pdfs.length) {
        savedPath = path.join(downloadDir, pdfs[0]);
        pdfBytes = fs.statSync(savedPath).size;
        log('Download', `arquivo em pasta: ${pdfs[0]} (${pdfBytes} bytes)`);
      }
    }

    const snackErrors = await page.locator('.mat-mdc-snack-bar-label').allTextContents();
    const errPdf = snackErrors.find((t) => /Erro ao gerar PDF/i.test(t));

    const ok = pdfBytes > 1000 && !errPdf;
    console.log(JSON.stringify({
      ok,
      pdfBytes,
      savedPath: savedPath || null,
      finalUrl: page.url(),
      errPdf: errPdf || null,
      consoleErrors: errors.slice(0, 5),
    }, null, 2));

    process.exitCode = ok ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('[E2E] FATAL', e);
  process.exit(1);
});
