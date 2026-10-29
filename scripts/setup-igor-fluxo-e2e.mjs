/**
 * Monta ambiente E2E completo: Igor Fluxo E2E 2910 → projeto → participantes → e-mails.
 * Pré-requisito: cliente criado, pedido de crédito aprovado (ou rodar após este script falhar em crédito).
 * Uso: npx playwright install chromium && node scripts/setup-igor-fluxo-e2e.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:4200';
const EMAIL = process.env.E2E_EMAIL || 'admin@admin.com';
const PASS = process.env.E2E_PASS || '123@qwe';

const CLIENT_NAME = 'Igor Fluxo E2E 2910';
const PROJECT_NAME = 'Projeto Igor PDF E2E';
const AVALIADO_EMAIL = 'igorhlucenaa@gmail.com';
const GESTOR_EMAIL = 'igorhlucenaa@icloud.com';
const SOURCE_FORM = 'Hydro Way (Eliwelton)';
const COMP_GROUP_SOURCE = 'Princípios do Hydro Way (Eliwelton)';
const REPORT_TEMPLATE_NAME = 'Template Igor PDF E2E';

function log(msg) {
  console.log(`[setup] ${msg}`);
}

async function login(page) {
  await page.goto(`${BASE}/authentication/login`, { waitUntil: 'networkidle', timeout: 120_000 });
  const emailInput = page.locator('input[placeholder*="email"], input[placeholder*="Email"]').first();
  await emailInput.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.getByRole('button', { name: /Entrar|Sign in/i }).click();
  await page.waitForURL(/\/(dashboard|projects|clients)/, { timeout: 60_000 });
}

async function copyAssessmentToClient(page) {
  await page.goto(`${BASE}/assessments`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByPlaceholder(/Nome do formul/i).fill('Hydro Way');
  await page.waitForTimeout(800);
  const row = page.locator('tr').filter({ hasText: SOURCE_FORM }).first();
  await row.getByRole('button').filter({ has: page.locator('mat-icon', { hasText: 'content_copy' }) }).click()
    .catch(() => row.locator('button').nth(1).click());
  await page.getByRole('combobox', { name: /Cliente de destino|destino/i }).click();
  await page.getByRole('option', { name: CLIENT_NAME }).click();
  await page.getByRole('button', { name: /Copiar formul/i }).click();
  await page.waitForTimeout(3000);
  log('Formulário copiado para ' + CLIENT_NAME);
}

async function setupCompetencies(page) {
  await page.goto(`${BASE}/competencies`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: CLIENT_NAME }).click();
  await page.waitForTimeout(1500);

  const groupForClient = page.getByText(/Princípios do Hydro Way.*Igor Fluxo/i).first();
  const groupAny = page.locator('mat-nav-list a, .sidebar-group, mat-list-item').filter({ hasText: /Princípios do Hydro Way/i }).first();
  let hasGroup = await groupForClient.isVisible().catch(() => false);
  if (!hasGroup) hasGroup = await groupAny.isVisible().catch(() => false);

  if (!hasGroup) {
    await page.locator('button').filter({ has: page.locator('mat-icon', { hasText: 'content_copy' }) }).first().click();
    await page.getByRole('combobox', { name: /Grupo de origem|origem/i }).click();
    await page.getByRole('option', { name: /Princípios do Hydro Way \(Eliwelton\) — Eliwelton/ }).click();
    await page.locator('input[placeholder*="Nome"], input[formcontrolname="name"]').last().fill('Princípios Hydro Way Igor');
    await page.getByRole('button', { name: /Copiar compet/i }).click();
    await page.waitForTimeout(4000);
  }

  if (await groupForClient.isVisible().catch(() => false)) {
    await groupForClient.click({ force: true });
  } else {
    await groupAny.click({ force: true });
  }
  await page.waitForTimeout(2000);

  const assessmentSelect = page.locator('mat-select').filter({ hasText: /Hydro Way|Avaliação|Formulário/i }).first();
  if (await assessmentSelect.isVisible().catch(() => false)) {
    await assessmentSelect.click();
    await page.getByRole('option').filter({ hasText: /Hydro Way/i }).last().click();
    await page.waitForTimeout(800);
  }

  const saveBtn = page.getByRole('button', { name: /^Salvar/i });
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(2500);
  }
  log('Competências configuradas e salvas');
}

async function createReportTemplate(page) {
  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByRole('combobox', { name: /Cliente/i }).first().click();
  await page.getByRole('option', { name: CLIENT_NAME }).click();
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: /Templates do cliente/i }).click();
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const manageBtn = page.getByRole('button', { name: /Gerenciar templates do cliente/i });
  if (await manageBtn.isVisible().catch(() => false)) {
    await manageBtn.click({ force: true });
  } else {
    await page.locator('.rp-template-active__manage').click({ force: true });
  }
  await page.waitForTimeout(800);

  const dialog = page.locator('mat-dialog-container');
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });
  await dialog.locator('input').first().click();
  await dialog.locator('input').first().pressSequentially(REPORT_TEMPLATE_NAME, { delay: 30 });
  await dialog.getByRole('button', { name: /Criar template/i }).click();
  await page.waitForTimeout(2500);

  await page.getByRole('button', { name: /^Fechar$/i }).click();
  log('Template de relatório: ' + REPORT_TEMPLATE_NAME);
}

async function ensureUserGroup(page) {
  await page.goto(`${BASE}/users`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByRole('tab', { name: /^Grupos$/i }).click();
  await page.waitForTimeout(1000);

  const groupName = 'Grupo Igor PDF E2E';
  const exists = await page.getByText(groupName).first().isVisible().catch(() => false);
  if (exists) {
    log('Grupo de usuários já existe: ' + groupName);
    return;
  }

  await page.getByRole('button', { name: /Adicionar Grupo|Novo Grupo|Criar Grupo/i }).first().click();
  await page.waitForTimeout(800);
  await page.locator('input[formcontrolname="name"], mat-dialog-container input').first().fill(groupName);
  const clientSel = page.locator('mat-select[formcontrolname="clientId"]').last();
  if (await clientSel.isVisible().catch(() => false)) {
    await clientSel.click();
    await page.getByRole('option', { name: CLIENT_NAME }).click();
  }
  await page.getByRole('button', { name: /Salvar|Criar/i }).last().click();
  await page.waitForTimeout(2000);
  log('Grupo de usuários criado: ' + groupName);
}

async function createProject(page) {
  await ensureUserGroup(page);
  await page.goto(`${BASE}/projects/new`, { waitUntil: 'networkidle', timeout: 120_000 });

  await page.getByLabel(/Nome do Projeto|Nome/i).first().fill(PROJECT_NAME).catch(async () => {
    await page.locator('input[formcontrolname="name"]').fill(PROJECT_NAME);
  });

  const clientSelect = page.locator('mat-select[formcontrolname="clientId"], mat-select').first();
  await clientSelect.click();
  await page.getByRole('option', { name: CLIENT_NAME }).click();

  await page.locator('input[formcontrolname="name"]').fill(PROJECT_NAME);

  await page.waitForTimeout(1500);
  const assessmentSelect = page.locator('mat-select[formcontrolname="assessmentId"]');
  await assessmentSelect.click();
  await page.getByRole('option').filter({ hasText: /Hydro Way/i }).first().click();

  await page.waitForTimeout(1500);
  const templateSelect = page.locator('mat-select[formcontrolname="reportTemplateId"]');
  await templateSelect.click();
  const tplByName = page.getByRole('option', { name: new RegExp(REPORT_TEMPLATE_NAME, 'i') });
  if (await tplByName.isVisible().catch(() => false)) {
    await tplByName.click();
  } else {
    const tpl = page.getByRole('option').filter({ hasText: /.+/ }).first();
    if (await tpl.isVisible().catch(() => false)) await tpl.click();
  }

  const groupSelect = page.locator('mat-select[formcontrolname="groupIds"]');
  await groupSelect.click();
  await page.getByRole('option').filter({ hasText: /Grupo Igor PDF E2E|Igor/i }).first().click();
  await page.keyboard.press('Escape');

  const deadline = page.locator('input[formcontrolname="deadline"]');
  await page.getByRole('button', { name: /Open calendar|calendar/i }).click();
  await page.getByRole('button', { name: /Choose month and year/i }).click();
  await page.getByRole('button', { name: '2026' }).click();
  await page.getByRole('button', { name: /dezembro de 2026/i }).click();
  await page.getByRole('button', { name: /31 de dezembro de 2026/i }).click();
  await deadline.inputValue().catch(() => deadline.fill('31/12/2026'));

  await page.waitForTimeout(500);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/projects/, { timeout: 60_000 }).catch(() => page.waitForTimeout(3000));
  log('Projeto criado: ' + PROJECT_NAME);
}

async function addParticipantsAndSend(page) {
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByRole('combobox', { name: /Filtrar por cliente/i }).click();
  await page.getByRole('option', { name: CLIENT_NAME }).click();
  await page.waitForTimeout(800);
  const search = page.getByRole('textbox', { name: /Buscar projeto/i });
  await search.click();
  await search.pressSequentially(PROJECT_NAME, { delay: 25 });
  await page.waitForTimeout(1500);

  const projectRow = page.locator('mat-row, tr').filter({ hasText: PROJECT_NAME }).filter({ hasText: 'Igor Fluxo' }).first();
  await projectRow.locator('button.act-btn--primary').click();

  await page.waitForTimeout(2000);

  async function addOne(email, name, category) {
    await page.getByRole('button', { name: /Adicionar|Novo participante/i }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    await page.locator('input[formcontrolname="email"], input[type="email"]').last().fill(email);
    await page.locator('input[formcontrolname="name"]').last().fill(name).catch(() => {});
    const cat = page.locator('mat-select[formcontrolname="category"]').last();
    await cat.click();
    await page.getByRole('option', { name: new RegExp(category, 'i') }).click();
    await page.getByRole('button', { name: /Salvar|Adicionar/i }).last().click();
    await page.waitForTimeout(1500);
  }

  await addOne(AVALIADO_EMAIL, 'Igor Gmail', 'Avaliado');
  await addOne(GESTOR_EMAIL, 'Igor iCloud', 'Gestor');

  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByPlaceholder(/Buscar|projeto/i).first().fill(PROJECT_NAME).catch(() => {});
  await page.waitForTimeout(800);
  const row2 = page.locator('tr, mat-row').filter({ hasText: PROJECT_NAME }).first();
  await row2.locator('button.act-btn--send, button').filter({ has: page.locator('mat-icon', { hasText: 'send' }) }).first().click();
  await page.waitForTimeout(2000);

  const checkboxes = page.locator('mat-checkbox input, input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < Math.min(count, 4); i++) {
    await checkboxes.nth(i).check({ force: true }).catch(() => {});
  }

  await page.getByRole('button', { name: /Enviar/i }).last().click();
  await page.waitForTimeout(5000);
  log('E-mails de convite disparados para avaliado e gestor');
}

async function main() {
  const fromStep = process.env.E2E_FROM_STEP || '';
  const skipToProject = fromStep === 'project';
  const participantsOnly = fromStep === 'participants';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page);
    if (!skipToProject && !participantsOnly && fromStep !== 'template') {
      await copyAssessmentToClient(page);
      await setupCompetencies(page);
    }
    if (!skipToProject && !participantsOnly) {
      await createReportTemplate(page);
    }
    if (!participantsOnly) {
      await createProject(page);
    }
    await addParticipantsAndSend(page);
    log('CONCLUÍDO — responda os questionários e avise para gerar o PDF.');
  } catch (e) {
    console.error('[setup] ERRO:', e);
    process.exitCode = 1;
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

main();
