import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';
import { defineString } from 'firebase-functions/params';
import path from 'path';

const PdfPrinter = require('pdfmake/js/Printer').default as {
  new (fonts: Record<string, unknown>): {
    createPdfKitDocument: (docDefinition: Record<string, unknown>) => Promise<{
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      end: () => void;
    }>;
  };
};

let firestoreDb: admin.firestore.Firestore | null = null;
const DEFAULT_FRONTEND_URL = 'https://eck360.web.app';

const EMAIL_USER_PARAM = defineString('EMAIL_USER', { default: '' });
const EMAIL_PASS_PARAM = defineString('EMAIL_PASS', { default: '' });

function getDb(): admin.firestore.Firestore {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  if (!firestoreDb) {
    firestoreDb = admin.firestore();
  }
  return firestoreDb;
}

interface ReminderSettingsDoc {
  clientId?: string;
  projectId?: string;
  enabled?: boolean;
  startDate?: admin.firestore.Timestamp;
  intervalDays?: number;
  maxReminders?: number;
  templateId?: string;
  templateIdAvaliado?: string;
  templateIdAvaliador?: string;
  sendTime?: string;
  timezone?: string;
  weekdays?: number[];
  lastRunWindowKey?: string;
}

interface ReminderRunStats {
  sent: number;
  skipped: number;
  errors: number;
}

interface ProcessRemindersOptions {
  now?: Date;
  targetClientIds?: string[];
  targetProjectIds?: string[];
  trigger: 'schedule' | 'manual_http';
}

interface ScheduleState {
  canRun: boolean;
  windowKey?: string;
}

interface SendAssessmentEmailInput {
  email: string;
  templateId: string;
  participantId: string;
  assessmentId: string;
  evaluatedParticipantId?: string;
  tokenOverride?: string;
  persistParticipantLink?: boolean;
  transporter: nodemailer.Transporter;
  emailUser: string;
}

interface SendAssessmentEmailResult {
  token: string;
  clientId?: string;
}

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

interface PdfDocumentoConfig {
  cabecalho?: {
    ativo?: boolean;
    ocultarNaCapa?: boolean;
    textoEsquerda?: string;
    mostrarNomeProjeto?: boolean;
    mostrarNumeroPagina?: boolean;
    cor?: string;
    linhaInferior?: boolean;
    logoUrl?: string;
  };
  rodape?: {
    ativo?: boolean;
    ocultarNaCapa?: boolean;
    texto?: string;
    mostrarNumeroPagina?: boolean;
    mostrarAno?: boolean;
    cor?: string;
    linhaSuperior?: boolean;
  };
}

interface PdfDocumentRuntimeMeta {
  documentoConfig?: PdfDocumentoConfig;
  projectName?: string;
}

function getTransporter(emailUser: string, emailPass: string): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
}

function getEmailCredentials(): { emailUser: string; emailPass: string } {
  const emailUser = EMAIL_USER_PARAM.value() || process.env.EMAIL_USER || '';
  const emailPass = EMAIL_PASS_PARAM.value() || process.env.EMAIL_PASS || '';

  if (!emailUser || !emailPass) {
    throw new Error(
      'Configuracao de email nao encontrada. Configure EMAIL_USER e EMAIL_PASS.'
    );
  }

  return { emailUser, emailPass };
}

async function getTemplateById(templateId: string): Promise<Record<string, unknown>> {
  const templateRef = getDb().collection('mailTemplates');
  const snapshot = await templateRef.doc(templateId).get();

  if (!snapshot.exists) {
    throw new Error('Modelo de e-mail nao encontrado.');
  }

  return (snapshot.data() || {}) as Record<string, unknown>;
}

function linkifyPlainUrls(html: string): string {
  const urlRegex = /(^|[\s>])(https?:\/\/[^\s<>"']+)/g;
  return html.replace(urlRegex, (_, before: string, url: string) => {
    return `${before}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function asDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date };
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return undefined;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calcula o próximo disparo respeitando sendTime e timezone configurados.
 * Ex: base=14/04 22:06, intervalDays=1, sendTime="20:50", tz="America/Sao_Paulo"
 * → resultado: 15/04 20:50 horário de Sao Paulo (= 15/04 23:50 UTC)
 * Usa formatToParts para extrair hora/minuto sem depender de separadores do locale.
 */
function buildNextReminderAt(
  base: Date,
  intervalDays: number,
  sendTime: string,
  timezone: string,
  weekdays: number[] = []
): admin.firestore.Timestamp {
  let targetDay = new Date(base.getTime() + intervalDays * 86400000);
  const allowedWeekdays = normalizeWeekdays(weekdays);

  if (allowedWeekdays.length) {
    for (let offset = 0; offset < 7; offset++) {
      const candidate = addDays(targetDay, offset);
      const candidateWeekday = getZonedDateParts(candidate, timezone).weekday;
      if (allowedWeekdays.includes(candidateWeekday)) {
        targetDay = candidate;
        break;
      }
    }
  }

  // Data do dia alvo no timezone configurado (extrai year/month/day individualmente)
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dp = dateFmt.formatToParts(targetDay);
  const year  = dp.find((p) => p.type === 'year')?.value  ?? '2000';
  const month = dp.find((p) => p.type === 'month')?.value ?? '01';
  const day   = dp.find((p) => p.type === 'day')?.value   ?? '01';
  const datePart = `${year}-${month}-${day}`; // "YYYY-MM-DD"

  // Offset do timezone: hora/minuto do meio-dia UTC convertido para o timezone alvo
  const noonUtc = new Date(`${datePart}T12:00:00Z`);
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: false,
  });
  const tp = timeFmt.formatToParts(noonUtc);
  const tzH = Number(tp.find((p) => p.type === 'hour')?.value   ?? '0');
  const tzM = Number(tp.find((p) => p.type === 'minute')?.value ?? '0');
  const offsetMin = tzH * 60 + tzM - 720; // ex: -180 para UTC-3

  // sendTime em minutos desde meia-noite local
  const [sh, sm] = sendTime.split(':').map(Number);
  const sendMin = sh * 60 + sm;

  // UTC = local − offset
  const utcMin = sendMin - offsetMin;

  const dayStartUtc = new Date(`${datePart}T00:00:00Z`).getTime();
  return admin.firestore.Timestamp.fromDate(new Date(dayStartUtc + utcMin * 60000));
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function sanitizeIntervalDays(value: unknown, fallback = 3): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return fallback;
  return rounded;
}

function formatDatePtBr(date: Date | undefined): string {
  if (!date) return '';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function normalizeTime(value: unknown, fallback = '09:00'): string {
  if (typeof value !== 'string') return fallback;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = value.split(':');
  return {
    hour: Number(hourRaw),
    minute: Number(minuteRaw),
  };
}

function normalizeWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
    )
  ).sort((a, b) => a - b);
}

function isValidTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const partMap = new Map<string, string>();
  formatter.formatToParts(date).forEach((part) => {
    partMap.set(part.type, part.value);
  });

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const weekdayRaw = partMap.get('weekday') || 'Sun';
  const weekday = weekdayMap[weekdayRaw] ?? 0;

  return {
    year: Number(partMap.get('year') || '0'),
    month: Number(partMap.get('month') || '0'),
    day: Number(partMap.get('day') || '0'),
    hour: Number(partMap.get('hour') || '0'),
    minute: Number(partMap.get('minute') || '0'),
    weekday,
  };
}

function buildScheduleState(setting: ReminderSettingsDoc, now: Date): ScheduleState {
  const timezoneCandidate = normalizeOptionalString(setting.timezone) || 'America/Fortaleza';
  const timezone = isValidTimeZone(timezoneCandidate)
    ? timezoneCandidate
    : 'America/Fortaleza';
  const scheduledTime = normalizeTime(setting.sendTime, '09:00');
  const weekdays = normalizeWeekdays(setting.weekdays);

  const zoned = getZonedDateParts(now, timezone);
  const { hour, minute } = parseTime(scheduledTime);

  if (weekdays.length && !weekdays.includes(zoned.weekday)) {
    return {
      canRun: false,
      windowKey: `${zoned.year}-${pad2(zoned.month)}-${pad2(zoned.day)}@${scheduledTime}`,
    };
  }

  const scheduledMinuteOfDay = hour * 60 + minute;
  const nowMinuteOfDay = zoned.hour * 60 + zoned.minute;
  const inWindow =
    nowMinuteOfDay >= scheduledMinuteOfDay &&
    nowMinuteOfDay < scheduledMinuteOfDay + 15;

  const windowKey = `${zoned.year}-${pad2(zoned.month)}-${pad2(zoned.day)}@${scheduledTime}`;
  if (!inWindow) {
    return { canRun: false, windowKey };
  }

  if (setting.lastRunWindowKey === windowKey) {
    return { canRun: false, windowKey };
  }

  return { canRun: true, windowKey };
}

function applyTemplateVariables(source: string, replacements: Record<string, string>): string {
  let text = source;

  const participantName = replacements.participantName || 'Participante';
  const avaliadoName = replacements.avaliadoName || '-';
  const projectDeadline = replacements.projectDeadline || '';
  const projectName = replacements.projectName || '';
  const clientName = replacements.clientName || '';
  const linkAvaliacao = replacements.LINK_AVALIACAO || '';
  const linkRelatorio = replacements.LINK_RELATORIO || '';

  text = text.replace(/\{\{\s*nome_participante\s*\}\}/gi, participantName);
  text = text.replace(/\{\{\s*nome_avaliado\s*\}\}/gi, avaliadoName);
  text = text.replace(/\{\{\s*data_expiracao\s*\}\}/gi, projectDeadline);
  text = text.replace(/\{\{\s*nome_projeto\s*\}\}/gi, projectName);
  text = text.replace(/\{\{\s*nome_projeto\s*\}\}+/gi, projectName);
  text = text.replace(/\{\{\s*nome_cliente\s*\}\}/gi, clientName);

  text = text.replace(/\$%NOME DO PROJETO\$%/gi, projectName);
  text = text.replace(/\$%NOME_DO_PROJETO\$%/gi, projectName);
  text = text.replace(/\$%NOME DO CLIENTE\$%/gi, clientName);

  if (projectDeadline) {
    text = text.replace(/\*\$%DATA DE EXPIRACAO DO PROJETO\$%\*/gi, projectDeadline);
    text = text.replace(/\$%DATA DE EXPIRACAO DO PROJETO\$%/gi, projectDeadline);
    text = text.replace(/\*\$%DATA DE EXPIRAÇÃO DO PROJETO\$%\*/g, projectDeadline);
    text = text.replace(/\$%DATA DE EXPIRAÇÃO DO PROJETO\$%/g, projectDeadline);
  }

  text = text.replace(/\$%NOME_DO_AVALIADO\$%/gi, avaliadoName);
  text = text.replace(/\$%Nome do usuario preenchido dinamicamente\$%/gi, participantName);
  text = text.replace(/\$%Nome do usuário preenchido dinâmicamente\$%/g, participantName);

  if (linkAvaliacao) {
    text = text.replace(/\[LINK_AVALIACAO\]/g, linkAvaliacao);
  }
  if (linkRelatorio) {
    text = text.replace(/\[LINK_RELATORIO\]/g, linkRelatorio);
  }

  text = text.replace(/\$%.*?\$%/g, participantName);
  return linkifyPlainUrls(text);
}

function renderTemplateToHtml(
  templateContent: Record<string, unknown>,
  replacements: Record<string, string>
): string {
  const body = (templateContent.body || {}) as Record<string, unknown>;
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    throw new Error('Template sem conteudo valido. Estrutura do template invalida.');
  }

  const bodyValues = (body.values || {}) as Record<string, unknown>;
  const fontFamily =
    normalizeOptionalString((bodyValues.fontFamily as Record<string, unknown> | undefined)?.value) ||
    'Arial, sans-serif';
  const textColor = normalizeOptionalString(bodyValues.textColor) || '#111827';
  const backgroundColor = normalizeOptionalString(bodyValues.backgroundColor) || '#ffffff';
  const contentAlign = normalizeOptionalString(bodyValues.contentAlign) || 'left';
  const contentWidth = normalizeOptionalString(bodyValues.contentWidth) || '100%';

  let html = '';
  html += `<div style="font-family:${fontFamily};color:${textColor};background-color:${backgroundColor};text-align:${contentAlign};width:${contentWidth};margin:0 auto;">`;

  for (const rowItem of rows) {
    const row = (rowItem || {}) as Record<string, unknown>;
    const rowValues = (row.values || {}) as Record<string, unknown>;
    const rowPadding = normalizeOptionalString(rowValues.padding) || '0';
    const rowBackground = normalizeOptionalString(rowValues.backgroundColor) || 'transparent';
    html += `<div style="padding:${rowPadding};background-color:${rowBackground};">`;

    const columns = Array.isArray(row.columns) ? row.columns : [];
    for (const columnItem of columns) {
      const column = (columnItem || {}) as Record<string, unknown>;
      const contents = Array.isArray(column.contents) ? column.contents : [];
      html += '<div>';

      for (const contentItem of contents) {
        const content = (contentItem || {}) as Record<string, unknown>;
        const values = (content.values || {}) as Record<string, unknown>;
        const containerPadding = normalizeOptionalString(values.containerPadding) || '0';
        const contentType = normalizeOptionalString(content.type) || '';
        const rawText = normalizeOptionalString(values.text) || '';

        if (contentType === 'heading') {
          const headingType = normalizeOptionalString(values.headingType) || 'h2';
          const headingSize = normalizeOptionalString(values.fontSize) || '24px';
          const headingAlign = normalizeOptionalString(values.textAlign) || 'left';
          const headingLineHeight = normalizeOptionalString(values.lineHeight) || '1.4';
          const headingText = applyTemplateVariables(rawText, replacements);

          html += `<${headingType} style="padding:${containerPadding};font-size:${headingSize};text-align:${headingAlign};line-height:${headingLineHeight};">${headingText}</${headingType}>`;
          continue;
        }

        if (contentType === 'text') {
          const textSize = normalizeOptionalString(values.fontSize) || '16px';
          const textAlign = normalizeOptionalString(values.textAlign) || 'left';
          const textLineHeight = normalizeOptionalString(values.lineHeight) || '1.5';
          const textContent = applyTemplateVariables(rawText, replacements);

          html += `<div style="padding:${containerPadding};font-size:${textSize};text-align:${textAlign};line-height:${textLineHeight};">${textContent}</div>`;
          continue;
        }

        if (contentType === 'html') {
          const htmlContent = applyTemplateVariables(rawText, replacements);
          html += `<div style="padding:${containerPadding};">${htmlContent}</div>`;
          continue;
        }

        if (contentType === 'social') {
          const align = normalizeOptionalString(values.align) || 'left';
          html += `<div style="padding:${containerPadding};text-align:${align};">Icones sociais</div>`;
        }
      }

      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function sendAssessmentEmail(
  input: SendAssessmentEmailInput
): Promise<SendAssessmentEmailResult> {
  const {
    email,
    templateId,
    participantId,
    assessmentId,
    evaluatedParticipantId,
    tokenOverride,
    persistParticipantLink = true,
    transporter,
    emailUser,
  } = input;

  const participantRef = getDb().collection('participants').doc(participantId);
  const participantDoc = await participantRef.get();
  if (!participantDoc.exists) {
    throw new Error('Participante nao encontrado.');
  }

  const participantData = (participantDoc.data() || {}) as Record<string, unknown>;
  const participantName = normalizeOptionalString(participantData.name) || 'Participante';
  const participantType = (normalizeOptionalString(participantData.type) || '').toLowerCase();
  const projectId = normalizeOptionalString(participantData.projectId);
  let clientId = normalizeOptionalString(participantData.clientId);
  const participantAvaliadoId = normalizeOptionalString(participantData.avaliadoId);

  let projectName = '';
  let projectDeadline = '';
  if (projectId) {
    try {
      const projectDoc = await getDb().collection('projects').doc(projectId).get();
      if (projectDoc.exists) {
        const projectData = (projectDoc.data() || {}) as Record<string, unknown>;
        projectName = normalizeOptionalString(projectData.name) || '';
        if (!clientId) {
          clientId = normalizeOptionalString(projectData.clientId);
        }
        projectDeadline = formatDatePtBr(asDate(projectData.deadline));
      }
    } catch (error) {
      console.error('Erro ao buscar dados do projeto:', error);
    }
  }

  let clientName = '';
  if (clientId) {
    try {
      const clientDoc = await getDb().collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = (clientDoc.data() || {}) as Record<string, unknown>;
        clientName = normalizeOptionalString(clientData.companyName) || '';
      }
    } catch (error) {
      console.error('Erro ao buscar dados do cliente:', error);
    }
  }

  let avaliadoName = '';
  const explicitEvaluatedId = normalizeOptionalString(evaluatedParticipantId);
  const evaluatedId = explicitEvaluatedId || participantAvaliadoId;
  if (evaluatedId) {
    const evaluatedDoc = await getDb().collection('participants').doc(evaluatedId).get();
    if (evaluatedDoc.exists) {
      const evaluatedData = (evaluatedDoc.data() || {}) as Record<string, unknown>;
      avaliadoName = normalizeOptionalString(evaluatedData.name) || '';
    }
  }

  if (!avaliadoName && projectId && participantType === 'avaliador') {
    const avaliadosSnap = await getDb()
      .collection('participants')
      .where('projectId', '==', projectId)
      .where('type', '==', 'avaliado')
      .get();
    const names: string[] = [];
    avaliadosSnap.docs.forEach((docSnap: admin.firestore.QueryDocumentSnapshot) => {
      const data = (docSnap.data() || {}) as Record<string, unknown>;
      const name = normalizeOptionalString(data.name);
      if (name) names.push(name);
    });
    avaliadoName = names.join(', ');
  }

  const template = await getTemplateById(templateId);
  const templateContentRaw = normalizeOptionalString(template.content);
  if (!templateContentRaw) {
    throw new Error('Template sem conteudo valido.');
  }

  const parsedContent = JSON.parse(templateContentRaw) as Record<string, unknown>;
  const token = tokenOverride || generateSecureToken();
  const frontendBaseUrl = normalizeOptionalString(process.env.FRONTEND_URL) || DEFAULT_FRONTEND_URL;
  const assessmentLink = `${frontendBaseUrl}/assessment?token=${token}&participant=${participantId}&assessment=${assessmentId}`;

  const emailHtml = renderTemplateToHtml(parsedContent, {
    LINK_AVALIACAO: assessmentLink,
    participantName,
    avaliadoName: avaliadoName || '-',
    projectDeadline,
    projectName,
    clientName,
  });

  const templateReplacements = {
    LINK_AVALIACAO: assessmentLink,
    participantName,
    avaliadoName: avaliadoName || '-',
    projectDeadline,
    projectName,
    clientName,
  };

  if (persistParticipantLink) {
    const assessmentLinkObj = {
      assessmentId,
      token,
      status: 'sent',
    };

    await participantRef.update({
      assessmentLinks: admin.firestore.FieldValue.arrayUnion(assessmentLinkObj),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const subjectRaw = normalizeOptionalString(template.subject) || 'Avaliacao 360';
  const subject = applyTemplateVariables(subjectRaw, templateReplacements);
  await transporter.sendMail({
    from: `ECK Avaliacao 360 <${emailUser}>`,
    to: email,
    subject,
    html: emailHtml,
  });

  await participantRef.update({
    deliveryStatus: 'sent',
    lastEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { token, clientId };
}

function isReminderDue(
  linkData: Record<string, unknown>,
  setting: ReminderSettingsDoc,
  now: Date
): boolean {
  const maxReminders = Number(setting.maxReminders || 0);
  const reminderCount = Number(linkData.reminderCount || 0);
  if (Number.isFinite(maxReminders) && maxReminders > 0 && reminderCount >= maxReminders) {
    return false;
  }

  const startDate = asDate(setting.startDate);
  if (startDate && now < startDate) {
    return false;
  }

  const nextReminderAt = asDate(linkData.nextReminderAt);
  if (nextReminderAt && now < nextReminderAt) {
    return false;
  }

  const intervalDays = sanitizeIntervalDays(setting.intervalDays, 3);
  const baseDate = asDate(linkData.lastReminderSentAt) || asDate(linkData.sentAt) || startDate;
  if (!baseDate) return true;
  return now >= addDays(baseDate, intervalDays);
}

function resolveTemplateIdForParticipant(
  setting: ReminderSettingsDoc,
  linkData: Record<string, unknown>,
  participantType: string
): string | undefined {
  if (participantType === 'avaliador') {
    return (
      normalizeOptionalString(setting.templateIdAvaliador) ||
      normalizeOptionalString(setting.templateId) ||
      normalizeOptionalString(linkData.emailTemplate)
    );
  }

  if (participantType === 'avaliado') {
    return (
      normalizeOptionalString(setting.templateIdAvaliado) ||
      normalizeOptionalString(setting.templateId) ||
      normalizeOptionalString(linkData.emailTemplate)
    );
  }

  return (
    normalizeOptionalString(setting.templateId) ||
    normalizeOptionalString(linkData.emailTemplate)
  );
}

async function persistReminderRunStats(
  statsByDocId: Map<string, ReminderRunStats>,
  scheduleByDocId: Map<string, ScheduleState>,
  settingsByDocId: Map<string, ReminderSettingsDoc>
): Promise<void> {
  const updates: Array<Promise<admin.firestore.WriteResult>> = [];

  for (const [docId, stats] of statsByDocId.entries()) {
    const scheduleState = scheduleByDocId.get(docId);
    const setting = settingsByDocId.get(docId);
    const payload: Record<string, unknown> = {
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRunSummary: stats,
    };
    if (setting?.clientId) payload.clientId = setting.clientId;
    if (setting?.projectId) payload.projectId = setting.projectId;
    if (scheduleState?.canRun && scheduleState.windowKey) {
      payload.lastRunWindowKey = scheduleState.windowKey;
    }

    // Grava no doc correto: {clientId}_{projectId}
    updates.push(getDb().collection('reminderSettings').doc(docId).set(payload, { merge: true }));
  }

  await Promise.all(updates);
}

const REMINDER_CLAIM_TTL_MS = 10 * 60 * 1000;

async function getPendingLinksForSetting(
  setting: ReminderSettingsDoc,
  projectAssessmentCache: Map<string, string | undefined>
): Promise<admin.firestore.QueryDocumentSnapshot[]> {
  const clientId = normalizeOptionalString(setting.clientId);
  const projectId = normalizeOptionalString(setting.projectId);
  if (!clientId || !projectId) return [];

  const docsMap = new Map<string, admin.firestore.QueryDocumentSnapshot>();
  const db = getDb();

  const scopedSnap = await db
    .collection('assessmentLinks')
    .where('clientId', '==', clientId)
    .where('projectId', '==', projectId)
    .where('status', '==', 'pending')
    .get();

  scopedSnap.docs.forEach((docSnap) => docsMap.set(docSnap.id, docSnap));

  let assessmentId = projectAssessmentCache.get(projectId);
  if (!projectAssessmentCache.has(projectId)) {
    const projectDoc = await db.collection('projects').doc(projectId).get();
    assessmentId = normalizeOptionalString((projectDoc.data() || {}).assessmentId);
    projectAssessmentCache.set(projectId, assessmentId);
  }

  // Compatibilidade com links antigos criados antes de clientId/projectId no assessmentLinks.
  if (assessmentId) {
    const legacySnap = await db
      .collection('assessmentLinks')
      .where('assessmentId', '==', assessmentId)
      .where('status', '==', 'pending')
      .get();

    legacySnap.docs.forEach((docSnap) => docsMap.set(docSnap.id, docSnap));
  }

  return Array.from(docsMap.values());
}

async function claimReminderLink(
  linkRef: admin.firestore.DocumentReference,
  setting: ReminderSettingsDoc,
  now: Date,
  runId: string,
  scope: { clientId: string; projectId: string }
): Promise<{ claimed: boolean; data?: Record<string, unknown> }> {
  return getDb().runTransaction(async (transaction) => {
    const snap = await transaction.get(linkRef);
    if (!snap.exists) return { claimed: false };

    const current = (snap.data() || {}) as Record<string, unknown>;
    if (normalizeOptionalString(current.status) !== 'pending') {
      return { claimed: false };
    }

    const processingStartedAt = asDate(current.reminderProcessingStartedAt);
    const processingRunId = normalizeOptionalString(current.reminderProcessingRunId);
    const hasFreshClaim =
      !!processingRunId &&
      !!processingStartedAt &&
      now.getTime() - processingStartedAt.getTime() < REMINDER_CLAIM_TTL_MS;

    if (hasFreshClaim) {
      return { claimed: false };
    }

    if (!isReminderDue(current, setting, now)) {
      return { claimed: false };
    }

    transaction.set(
      linkRef,
      {
        clientId: scope.clientId,
        projectId: scope.projectId,
        reminderProcessingRunId: runId,
        reminderProcessingStartedAt: admin.firestore.Timestamp.fromDate(now),
        lastReminderAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { claimed: true, data: current };
  });
}

async function processPendingAssessmentReminders(
  options: ProcessRemindersOptions
): Promise<void> {
  const now = options.now || new Date();
  const runId = `${options.trigger}_${now.getTime()}_${randomBytes(6).toString('hex')}`;
  const targetClientIds = new Set(
    (options.targetClientIds || [])
      .map((id) => normalizeOptionalString(id))
      .filter((id): id is string => !!id)
  );
  const targetProjectIds = new Set(
    (options.targetProjectIds || [])
      .map((id) => normalizeOptionalString(id))
      .filter((id): id is string => !!id)
  );

  const settingsSnap = await getDb()
    .collection('reminderSettings')
    .where('enabled', '==', true)
    .get();

  if (settingsSnap.empty) {
    console.log('Nenhuma configuracao de lembrete habilitada.');
    return;
  }

  // Chave: "{clientId}_{projectId}" — um projeto por entrada
  const settingsByDocId = new Map<string, ReminderSettingsDoc>();
  const statsByDocId = new Map<string, ReminderRunStats>();
  const scheduleByDocId = new Map<string, ScheduleState>();

  settingsSnap.docs.forEach((docSnap: admin.firestore.QueryDocumentSnapshot) => {
    const raw = (docSnap.data() || {}) as ReminderSettingsDoc;
    const clientId = normalizeOptionalString(raw.clientId);
    const projectId = normalizeOptionalString(raw.projectId);

    // Ignora docs sem clientId ou sem projectId (formato legado)
    if (!clientId || !projectId) return;

    if (targetClientIds.size > 0 && !targetClientIds.has(clientId)) return;
    if (targetProjectIds.size > 0 && !targetProjectIds.has(projectId)) return;

    const docId = `${clientId}_${projectId}`;
    const normalized: ReminderSettingsDoc = {
      clientId,
      projectId,
      enabled: true,
      startDate: raw.startDate,
      intervalDays: sanitizeIntervalDays(raw.intervalDays, 3),
      maxReminders: Number(raw.maxReminders || 0),
      templateId: normalizeOptionalString(raw.templateId),
      templateIdAvaliado: normalizeOptionalString(raw.templateIdAvaliado),
      templateIdAvaliador: normalizeOptionalString(raw.templateIdAvaliador),
      sendTime: normalizeTime(raw.sendTime, '09:00'),
      timezone: normalizeOptionalString(raw.timezone) || 'America/Fortaleza',
      weekdays: normalizeWeekdays(raw.weekdays),
      lastRunWindowKey: normalizeOptionalString(raw.lastRunWindowKey),
    };

    settingsByDocId.set(docId, normalized);
    statsByDocId.set(docId, { sent: 0, skipped: 0, errors: 0 });
    scheduleByDocId.set(
      docId,
      options.trigger === 'manual_http'
        ? { canRun: true }
        : buildScheduleState(normalized, now)
    );
  });

  if (!settingsByDocId.size) {
    console.log('Nenhum projeto valido com lembrete habilitado para este gatilho.');
    return;
  }

  const hasAnyToRun = Array.from(scheduleByDocId.values()).some((state) => state.canRun);
  if (!hasAnyToRun) {
    await persistReminderRunStats(statsByDocId, scheduleByDocId, settingsByDocId);
    console.log('Fora da janela de execucao para todos os projetos.');
    return;
  }

  let emailUser = '';
  let transporter: nodemailer.Transporter | undefined;
  const getReminderTransporter = (): nodemailer.Transporter => {
    if (!transporter) {
      const credentials = getEmailCredentials();
      emailUser = credentials.emailUser;
      transporter = getTransporter(credentials.emailUser, credentials.emailPass);
    }
    return transporter;
  };

  const participantCache = new Map<string, Record<string, unknown>>();
  const projectClientCache = new Map<string, string | undefined>();
  const projectAssessmentCache = new Map<string, string | undefined>();

  const getParticipantData = async (
    participantId: string
  ): Promise<Record<string, unknown> | undefined> => {
    if (participantCache.has(participantId)) {
      return participantCache.get(participantId);
    }
    const participantDoc = await getDb().collection('participants').doc(participantId).get();
    const data = participantDoc.exists
      ? ((participantDoc.data() || {}) as Record<string, unknown>)
      : undefined;
    if (data) participantCache.set(participantId, data);
    return data;
  };

  const resolveClientId = async (
    linkData: Record<string, unknown>
  ): Promise<string | undefined> => {
    const fromLink = normalizeOptionalString(linkData.clientId);
    if (fromLink) return fromLink;

    const participantId = normalizeOptionalString(linkData.participantId);
    if (!participantId) return undefined;

    const participantData = await getParticipantData(participantId);
    const fromParticipant = normalizeOptionalString(participantData?.clientId);
    if (fromParticipant) return fromParticipant;

    const projectId = normalizeOptionalString(participantData?.projectId);
    if (!projectId) return undefined;

    if (projectClientCache.has(projectId)) return projectClientCache.get(projectId);

    const projectDoc = await getDb().collection('projects').doc(projectId).get();
    const fromProject = normalizeOptionalString((projectDoc.data() || {}).clientId);
    projectClientCache.set(projectId, fromProject);
    return fromProject;
  };

  const resolveProjectId = async (
    linkData: Record<string, unknown>
  ): Promise<string | undefined> => {
    const fromLink = normalizeOptionalString(linkData.projectId);
    if (fromLink) return fromLink;

    // Fallback: lê projectId do participante (links criados antes da correção)
    const participantId = normalizeOptionalString(linkData.participantId);
    if (!participantId) return undefined;

    const participantData = await getParticipantData(participantId);
    return normalizeOptionalString(participantData?.projectId);
  };

  let candidateCount = 0;

  for (const [docId, setting] of settingsByDocId.entries()) {
    const stats = statsByDocId.get(docId);
    const scheduleState = scheduleByDocId.get(docId);
    if (!stats || !scheduleState?.canRun) continue;

    const candidateDocs = await getPendingLinksForSetting(setting, projectAssessmentCache);
    candidateCount += candidateDocs.length;

    for (const linkDoc of candidateDocs) {
      const linkData = (linkDoc.data() || {}) as Record<string, unknown>;
      const participantId = normalizeOptionalString(linkData.participantId);
      const assessmentId = normalizeOptionalString(linkData.assessmentId);

      if (!participantId || !assessmentId) continue;

      const clientId = await resolveClientId(linkData);
      if (!clientId) continue;
      if (targetClientIds.size > 0 && !targetClientIds.has(clientId)) continue;

      const projectId = await resolveProjectId(linkData);
      if (!projectId) continue;
      if (targetProjectIds.size > 0 && !targetProjectIds.has(projectId)) continue;

      // Links legados por assessmentId ainda precisam confirmar que pertencem ao projeto atual.
      if (`${clientId}_${projectId}` !== docId) continue;

      if (!isReminderDue(linkData, setting, now)) {
        stats.skipped += 1;
        continue;
      }

      const participantData = await getParticipantData(participantId);
      const participantType = (normalizeOptionalString(participantData?.type) || '').toLowerCase();
      const templateId = resolveTemplateIdForParticipant(setting, linkData, participantType);
      if (!templateId) {
        stats.errors += 1;
        await linkDoc.ref.set(
          {
            clientId,
            projectId,
            lastReminderAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
            lastReminderError: 'Template de lembrete nao configurado.',
          },
          { merge: true }
        );
        continue;
      }

      let participantEmail = normalizeOptionalString(linkData.participantEmail);
      if (!participantEmail) {
        participantEmail = normalizeOptionalString(participantData?.email);
      }

      if (!participantEmail || !isValidEmail(participantEmail)) {
        stats.errors += 1;
        await linkDoc.ref.set(
          {
            clientId,
            projectId,
            lastReminderAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
            lastReminderError: 'Email do participante ausente ou invalido.',
          },
          { merge: true }
        );
        continue;
      }

      const claim = await claimReminderLink(linkDoc.ref, setting, now, runId, { clientId, projectId });
      if (!claim.claimed) {
        stats.skipped += 1;
        continue;
      }

      const claimedLinkData = claim.data || linkData;
      const intervalDays = sanitizeIntervalDays(setting.intervalDays, 3);
      const sendTime = normalizeTime(setting.sendTime, '09:00');
      const timezone = (setting.timezone && isValidTimeZone(setting.timezone))
        ? setting.timezone
        : 'America/Fortaleza';
      const token = normalizeOptionalString(claimedLinkData.token) || generateSecureToken();
      const avaliadoId = normalizeOptionalString(claimedLinkData.avaliadoId);

      try {
        const reminderTransporter = getReminderTransporter();
        const sendResult = await sendAssessmentEmail({
          email: participantEmail,
          templateId,
          participantId,
          assessmentId,
          evaluatedParticipantId: avaliadoId,
          tokenOverride: token,
          persistParticipantLink: false,
          transporter: reminderTransporter,
          emailUser,
        });

        const nextReminderAt = buildNextReminderAt(
          now,
          intervalDays,
          sendTime,
          timezone,
          setting.weekdays || []
        );

        await linkDoc.ref.set(
          {
            clientId: sendResult.clientId || clientId,
            projectId,
            participantEmail,
            token: sendResult.token,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            reminderTemplateId: templateId,
            reminderCount: admin.firestore.FieldValue.increment(1),
            lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastReminderAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
            nextReminderAt,
            reminderProcessingRunId: admin.firestore.FieldValue.delete(),
            reminderProcessingStartedAt: admin.firestore.FieldValue.delete(),
            lastReminderError: admin.firestore.FieldValue.delete(),
            emailHistory: admin.firestore.FieldValue.arrayUnion({
              type: 'lembrete',
              sentAt: admin.firestore.Timestamp.fromDate(now),
              status: 'enviado',
              templateId: templateId || '',
            }),
          },
          { merge: true }
        );

        stats.sent += 1;
      } catch (error) {
        const err = error as Error;
        stats.errors += 1;
        console.error('Erro ao enviar lembrete automatico:', {
          assessmentLinkId: linkDoc.id,
          participantId,
          assessmentId,
          clientId,
          projectId,
          error: err.message,
        });

        await linkDoc.ref.set(
          {
            clientId,
            projectId,
            lastReminderAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
            reminderProcessingRunId: admin.firestore.FieldValue.delete(),
            reminderProcessingStartedAt: admin.firestore.FieldValue.delete(),
            lastReminderError: err.message || 'Falha desconhecida ao enviar lembrete.',
            emailHistory: admin.firestore.FieldValue.arrayUnion({
              type: 'lembrete',
              sentAt: admin.firestore.Timestamp.fromDate(now),
              status: 'erro',
              error: err.message || 'Falha desconhecida',
            }),
          },
          { merge: true }
        );
      }
    }
  }

  if (candidateCount === 0) {
    console.log('Sem assessmentLinks pendentes para lembrete nos projetos elegiveis.');
  }

  await persistReminderRunStats(statsByDocId, scheduleByDocId, settingsByDocId);

  const summary = Array.from(statsByDocId.entries()).map(([docId, stats]) => ({
    docId,
    ...stats,
  }));
  console.log('Resumo de envio de lembretes:', {
    trigger: options.trigger,
    summary,
  });
}

function sanitizePdfFileName(value: unknown): string {
  if (typeof value !== 'string') return 'relatorio-feedback-360.pdf';
  const trimmed = value.trim();
  if (!trimmed) return 'relatorio-feedback-360.pdf';
  const sanitized = trimmed
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withExtension = sanitized.toLowerCase().endsWith('.pdf')
    ? sanitized
    : `${sanitized}.pdf`;
  return withExtension || 'relatorio-feedback-360.pdf';
}

function buildPdfFontsMap(): Record<string, unknown> {
  const baseDir = path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto');
  return {
    Roboto: {
      normal: path.join(baseDir, 'Roboto-Regular.ttf'),
      bold: path.join(baseDir, 'Roboto-Medium.ttf'),
      italics: path.join(baseDir, 'Roboto-Italic.ttf'),
      bolditalics: path.join(baseDir, 'Roboto-MediumItalic.ttf'),
    },
  };
}

function buildRuntimeHeader(meta?: PdfDocumentRuntimeMeta) {
  const cfg = meta?.documentoConfig?.cabecalho;
  if (!cfg?.ativo) return undefined;

  return (currentPage: number, pageCount: number) => {
    if (cfg.ocultarNaCapa && currentPage === 1) return {};

    const color = normalizeOptionalString(cfg.cor) || '#666666';
    const leftParts: string[] = [];
    const leftText = normalizeOptionalString(cfg.textoEsquerda);
    const projectName = normalizeOptionalString(meta?.projectName);

    if (leftText) leftParts.push(leftText);
    if (cfg.mostrarNomeProjeto && projectName) leftParts.push(projectName);

    const columns: Record<string, unknown>[] = [];

    if (normalizeOptionalString(cfg.logoUrl)) {
      columns.push({
        image: cfg.logoUrl,
        fit: [60, 20],
        alignment: 'left',
        width: 'auto',
        margin: [0, 0, 8, 0],
      });
    }

    columns.push({
      text: leftParts.join(' — '),
      alignment: 'left',
      fontSize: 8,
      color,
      width: '*',
    });

    if (cfg.mostrarNumeroPagina) {
      columns.push({
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'right',
        fontSize: 8,
        color,
        width: 'auto',
      });
    }

    const row = { columns, columnGap: 8 };

    if (cfg.linhaInferior) {
      return {
        stack: [
          { ...row, margin: [0, 0, 0, 3] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: color }] },
        ],
        margin: [40, 15, 40, 0],
      };
    }

    return { ...row, margin: [40, 20, 40, 0] };
  };
}

function buildRuntimeFooter(meta?: PdfDocumentRuntimeMeta) {
  const cfg = meta?.documentoConfig?.rodape;
  if (!cfg?.ativo) return undefined;

  return (currentPage: number, pageCount: number) => {
    if (cfg.ocultarNaCapa && currentPage === 1) return {};

    const color = normalizeOptionalString(cfg.cor) || '#999999';
    const parts: string[] = [];
    const centerText = normalizeOptionalString(cfg.texto);

    if (centerText) parts.push(centerText);
    if (cfg.mostrarAno) parts.push(`© ${new Date().getFullYear()}`);
    if (cfg.mostrarNumeroPagina) parts.push(`Página ${currentPage} de ${pageCount}`);

    const textContent = parts.join(' | ');

    if (cfg.linhaSuperior) {
      return {
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: color }], margin: [0, 0, 0, 3] },
          { text: textContent, alignment: 'center', fontSize: 8, color },
        ],
        margin: [40, 5, 40, 15],
      };
    }

    return { text: textContent, alignment: 'center', fontSize: 8, color, margin: [40, 10, 40, 20] };
  };
}

function normalizeDocDefinitionForServer(
  docDefinition: Record<string, unknown>,
  runtimeMeta?: PdfDocumentRuntimeMeta
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...docDefinition };

  const content = normalized.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('docDefinition invalido: "content" deve ser um array nao vazio.');
  }

  if (!normalized.defaultStyle || typeof normalized.defaultStyle !== 'object') {
    normalized.defaultStyle = { font: 'Roboto', fontSize: 10, lineHeight: 1.5 };
  } else {
    const currentDefault = normalized.defaultStyle as Record<string, unknown>;
    if (!currentDefault.font) {
      normalized.defaultStyle = { ...currentDefault, font: 'Roboto' };
    }
  }

  if (!normalized.pageMargins) {
    normalized.pageMargins = [40, 60, 40, 60];
  }

  const runtimeHeader = buildRuntimeHeader(runtimeMeta);
  if (runtimeHeader) {
    normalized.header = runtimeHeader;
  }

  if (!normalized.header) {
    normalized.header = {
      text: 'ECK - Avaliacao 360',
      alignment: 'left',
      fontSize: 8,
      color: '#666666',
      margin: [40, 20, 40, 0],
    };
  }

  const runtimeFooter = buildRuntimeFooter(runtimeMeta);
  if (runtimeFooter) {
    normalized.footer = runtimeFooter;
  }

  if (!normalized.footer) {
    normalized.footer = {
      text: `© ${new Date().getFullYear()} ECK Consulting - Confidencial`,
      alignment: 'center',
      fontSize: 8,
      color: '#999999',
      margin: [40, 10, 40, 20],
    };
  }

  return normalized;
}

async function createPdfBuffer(
  docDefinition: Record<string, unknown>,
  runtimeMeta?: PdfDocumentRuntimeMeta
): Promise<Buffer> {
  const printer = new PdfPrinter(buildPdfFontsMap());
  const pdfDoc = await printer.createPdfKitDocument(normalizeDocDefinitionForServer(docDefinition, runtimeMeta));
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    pdfDoc.on('data', (chunk: unknown) => {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      }
    });
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', (error: unknown) => reject(error));
    pdfDoc.end();
  });
}

type HtmlPdfRenderOptions = {
  format: 'A4' | 'Letter';
  landscape: boolean;
  scale: number;
  preferCssPageSize: boolean;
  margin: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
};

function normalizeHtmlPdfOptions(raw: unknown): HtmlPdfRenderOptions {
  const input = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const marginInput = (input.marginMm && typeof input.marginMm === 'object')
    ? (input.marginMm as Record<string, unknown>)
    : {};

  const toMm = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    const clamped = Number.isFinite(parsed) ? Math.min(25, Math.max(3, parsed)) : fallback;
    return `${clamped}mm`;
  };

  const scaleRaw = Number(input.scale);
  const scale = Number.isFinite(scaleRaw) ? Math.min(1, Math.max(0.75, scaleRaw)) : 0.96;

  const format = input.format === 'Letter' ? 'Letter' : 'A4';

  return {
    format,
    landscape: Boolean(input.landscape),
    scale,
    preferCssPageSize: input.preferCssPageSize !== false,
    margin: {
      top: toMm(marginInput.top, 8),
      right: toMm(marginInput.right, 7),
      bottom: toMm(marginInput.bottom, 8),
      left: toMm(marginInput.left, 7),
    },
    displayHeaderFooter: Boolean(input.displayHeaderFooter),
    headerTemplate: typeof input.headerTemplate === 'string' ? input.headerTemplate : '',
    footerTemplate: typeof input.footerTemplate === 'string' ? input.footerTemplate : '',
  };
}

async function createPdfBufferFromHtml(html: string, options: HtmlPdfRenderOptions): Promise<Buffer> {
  if (!html.trim()) {
    throw new Error('HTML do relatorio esta vazio.');
  }

  let browser: { close: () => Promise<void>; newPage: () => Promise<any> } | null = null;

  try {
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ]);

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: 1240,
        height: 1754,
        deviceScaleFactor: 1,
      },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(480000);

    await page.setRequestInterception(true);
    page.on('request', (request: any) => {
      const url = request.url();

      if (
        url === 'about:blank' ||
        url.startsWith('data:') ||
        url.startsWith('blob:')
      ) {
        request.continue();
        return;
      }

      request.abort();
    });

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.emulateMediaType('print');
    await Promise.race([
      page.evaluateHandle('document.fonts && document.fonts.ready'),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    await page.waitForFunction(
      () => {
        const flag = (globalThis as { __pdfLayoutReady?: boolean }).__pdfLayoutReady;
        return flag === true;
      },
      { timeout: 20000 }
    ).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 120));

    return Buffer.from(await page.pdf({
      format: options.format,
      landscape: options.landscape,
      scale: options.scale,
      printBackground: true,
      preferCSSPageSize: options.preferCssPageSize,
      margin: options.margin,
      displayHeaderFooter: options.displayHeaderFooter,
      headerTemplate: options.displayHeaderFooter ? (options.headerTemplate || '<span></span>') : '<span></span>',
      footerTemplate: options.displayHeaderFooter ? (options.footerTemplate || '<span></span>') : '<span></span>',
      timeout: 480000,
    }));
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export const generateReportPdf = onRequest(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 540,
    memory: '4GiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send({ error: 'Metodo nao permitido. Use POST.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const rawDocDefinition = body.docDefinition;
    const rawHtml = body.html;
    const runtimeMeta = (body.documentMeta || {}) as PdfDocumentRuntimeMeta;
    const htmlOptions = normalizeHtmlPdfOptions(body.options);

    const fileName = sanitizePdfFileName(body.fileName);

    try {
      let pdfBuffer: Buffer;

      if (typeof rawHtml === 'string' && rawHtml.trim()) {
        pdfBuffer = await createPdfBufferFromHtml(rawHtml, htmlOptions);
      } else if (rawDocDefinition && typeof rawDocDefinition === 'object' && !Array.isArray(rawDocDefinition)) {
        pdfBuffer = await createPdfBuffer(rawDocDefinition as Record<string, unknown>, runtimeMeta);
      } else {
        res.status(400).send({
          error: 'Campo obrigatorio ausente: html (string) ou docDefinition (objeto JSON).',
        });
        return;
      }

      if (!pdfBuffer || pdfBuffer.length === 0) {
        res.status(500).send({ error: 'Falha ao gerar PDF: buffer vazio.' });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.status(200).send(pdfBuffer);
    } catch (error) {
      const err = error as Error;
      console.error('Erro ao gerar PDF no backend:', err);
      res.status(500).send({
        error: `Erro ao gerar PDF: ${err.message || 'Erro desconhecido'}`,
      });
    }
  }
);

export const sendEmail = onRequest(
  {
    region: 'us-central1',
    cors: true,
  },
  async (req, res) => {
    const { email, templateId, participantId, assessmentId, evaluatedParticipantId } =
      req.body || {};

    if (!email || !templateId || !participantId || !assessmentId) {
      res.status(400).send({
        error: 'Campos obrigatorios faltando: email, templateId, participantId, assessmentId.',
      });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).send({ error: 'Email invalido.' });
      return;
    }

    try {
      const { emailUser, emailPass } = getEmailCredentials();
      const transporter = getTransporter(emailUser, emailPass);

      const result = await sendAssessmentEmail({
        email,
        templateId,
        participantId,
        assessmentId,
        evaluatedParticipantId,
        transporter,
        emailUser,
        persistParticipantLink: true,
      });

      res.status(200).send({ success: true, token: result.token });
    } catch (error) {
      const err = error as Error;
      console.error('Erro ao enviar e-mail:', err);

      if (participantId && typeof participantId === 'string') {
        try {
          await getDb().collection('participants').doc(participantId).update({
            deliveryStatus: 'failed',
            errorMessage: err.message || 'Erro desconhecido',
          });
        } catch (updateError) {
          console.error('Erro ao atualizar status do participante:', updateError);
        }
      }

      res.status(500).send({
        error: `Erro ao enviar e-mail: ${err.message || 'Erro desconhecido'}`,
      });
    }
  }
);

/**
 * Sincroniza credits / creditsUsed / reservedCredits de UM cliente
 * a partir das fontes de verdade (creditOrders + assessmentLinks).
 * Chamada pelo trigger onAssessmentCompleted para manter o estado
 * sempre atualizado sem depender da abertura da tela de Pedidos.
 */
async function sincronizarCreditosCliente(clientId: string): Promise<void> {
  const db = getDb();
  const now = new Date();

  // 1. Pedidos aprovados válidos deste cliente, ordenados FIFO
  const ordersSnap = await db
    .collection('creditOrders')
    .where('clientId', '==', clientId)
    .where('status', '==', 'Aprovado')
    .get();

  const orders = ordersSnap.docs
    .filter(d => {
      const v = (d.data()['validityDate'] as admin.firestore.Timestamp | undefined)?.toDate();
      return !v || v >= now;
    })
    .sort((a, b) => {
      const tA = (a.data()['createdAt'] as admin.firestore.Timestamp | undefined)?.toMillis() ?? 0;
      const tB = (b.data()['createdAt'] as admin.firestore.Timestamp | undefined)?.toMillis() ?? 0;
      return tA - tB;
    })
    .map(d => ({ id: d.id, credits: (d.data()['credits'] as number) || 0 }));

  // 2. Links concluídos deste cliente
  const completedSnap = await db
    .collection('assessmentLinks')
    .where('clientId', '==', clientId)
    .where('status', '==', 'completed')
    .get();
  const used = completedSnap.size;

  // 3. Links pendentes com crédito reservado deste cliente
  const reservedSnap = await db
    .collection('assessmentLinks')
    .where('clientId', '==', clientId)
    .where('creditReserved', '==', true)
    .where('status', '==', 'pending')
    .get();
  const reserved = reservedSnap.size;

  // 4. Calcula saldo disponível
  const purchased = orders.reduce((sum, o) => sum + o.credits, 0);
  const available = Math.max(0, purchased - used - reserved);

  // 5. FIFO: atualiza remainingCredits por pedido + cliente num único batch
  const batch = db.batch();

  let toDeduct = used;
  for (const order of orders) {
    const consumed = Math.min(toDeduct, order.credits);
    const remaining = order.credits - consumed;
    toDeduct -= consumed;
    batch.update(db.collection('creditOrders').doc(order.id), {
      remainingCredits: remaining,
    });
  }

  batch.update(db.collection('clients').doc(clientId), {
    credits:        available,
    creditsUsed:    used,
    reservedCredits: reserved,
  });

  await batch.commit();
}

export const sendPendingAssessmentReminders = onSchedule(
  {
    region: 'us-central1',
    schedule: 'every 15 minutes',
    timeZone: 'Etc/UTC',
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async () => {
    await processPendingAssessmentReminders({
      trigger: 'schedule',
    });
  }
);

export const triggerPendingAssessmentReminders = onRequest(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send({ error: 'Metodo nao permitido. Use POST.' });
      return;
    }

    const clientId = normalizeOptionalString(req.body?.clientId);
    if (!clientId) {
      res.status(400).send({ error: 'Campo obrigatorio ausente: clientId.' });
      return;
    }
    const projectId = normalizeOptionalString(req.body?.projectId);

    try {
      await processPendingAssessmentReminders({
        trigger: 'manual_http',
        targetClientIds: [clientId],
        ...(projectId ? { targetProjectIds: [projectId] } : {}),
      });
      res.status(200).send({ success: true });
    } catch (error) {
      const err = error as Error;
      console.error('Erro ao acionar processamento imediato de lembretes:', err);
      res.status(500).send({
        error: `Erro ao processar lembretes: ${err.message || 'Erro desconhecido'}`,
      });
    }
  }
);

/**
 * CORREÇÃO 7 — Trigger Firestore: sincroniza créditos do cliente imediatamente
 * ao concluir uma avaliação, sem depender da abertura da tela de Pedidos.
 *
 * Dispara quando assessmentLinks/{linkId}.status muda para 'completed'.
 * Executa sincronizarCreditosCliente() apenas para o clientId do link,
 * mantendo o recálculo focado e eficiente.
 */
export const onAssessmentCompleted = onDocumentUpdated(
  {
    document: 'assessmentLinks/{linkId}',
    region: 'us-central1',
  },
  async (event) => {
    const before = event.data?.before.data() as Record<string, unknown> | undefined;
    const after  = event.data?.after.data()  as Record<string, unknown> | undefined;

    if (!before || !after) return;
    if (before['status'] === 'completed' || after['status'] !== 'completed') return;

    const clientId = normalizeOptionalString(after['clientId']);
    if (!clientId) {
      console.warn('onAssessmentCompleted: clientId ausente no link', event.params.linkId);
      return;
    }

    try {
      await sincronizarCreditosCliente(clientId);
      console.log('onAssessmentCompleted: créditos sincronizados para cliente', clientId);
    } catch (error) {
      const err = error as Error;
      console.error('onAssessmentCompleted: erro ao sincronizar créditos:', err.message);
    }
  }
);

// ════════════════════════════════════════════════════════════════════
// INTEGRIDADE REFERENCIAL — exclusão segura com cascata/estorno atômico
// ════════════════════════════════════════════════════════════════════

const DELETE_REGION = 'us-central1';

/** Resolve o papel (role) do usuário autenticado pelo e-mail. */
async function getCallerRole(email: string | undefined): Promise<string | null> {
  if (!email) return null;
  const db = getDb();
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  return normalizeOptionalString(snap.docs[0].data()['role']) ?? null;
}

/** Apaga em lotes (máx. 450/batch) todos os docs de uma query. */
async function deleteQueryInBatches(
  query: admin.firestore.Query
): Promise<number> {
  const db = getDb();
  const snap = await query.get();
  if (snap.empty) return 0;
  let count = 0;
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    snap.docs.slice(i, i + 450).forEach(d => { batch.delete(d.ref); count++; });
    await batch.commit();
  }
  return count;
}

/** Remove um valor de um campo array em todos os docs que o contêm. */
async function pullFromArrayField(
  collectionName: string, field: string, value: string
): Promise<void> {
  const db = getDb();
  const snap = await db.collection(collectionName).where(field, 'array-contains', value).get();
  if (snap.empty) return;
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    snap.docs.slice(i, i + 450).forEach(d =>
      batch.update(d.ref, { [field]: admin.firestore.FieldValue.arrayRemove(value) })
    );
    await batch.commit();
  }
}

interface SafeDeleteRequest {
  entity: 'client' | 'project' | 'participant' | 'creditOrder' | 'assessment';
  id: string;
}

interface BlockerInfo { collection: string; label: string; count: number; }

/**
 * Exclusão autoritativa (server-side). Verifica permissão, aplica regra de
 * dependência (bloqueio OU cascata atômica) e mantém integridade dos créditos.
 *
 * Retorno: { deleted: true } ou lança HttpsError('failed-precondition') com
 * a lista de bloqueios em err.details.blockers.
 */
export const safeDelete = onCall(
  { region: DELETE_REGION },
  async (request) => {
    // 1. Autenticação + autorização
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login necessário.');
    }
    const role = await getCallerRole(request.auth.token.email as string | undefined);
    if (role !== 'admin_master') {
      throw new HttpsError('permission-denied', 'Apenas admin master pode excluir registros.');
    }

    const { entity, id } = (request.data || {}) as SafeDeleteRequest;
    if (!entity || !id) {
      throw new HttpsError('invalid-argument', 'Parâmetros "entity" e "id" são obrigatórios.');
    }

    const db = getDb();

    switch (entity) {
      case 'client':   return deleteClientSafe(db, id);
      case 'project':  return deleteProjectSafe(db, id);
      case 'participant': return deleteParticipantSafe(db, id);
      case 'creditOrder': return deleteCreditOrderSafe(db, id);
      case 'assessment': return deleteAssessmentSafe(db, id);
      default:
        throw new HttpsError('invalid-argument', `Entidade desconhecida: ${entity}`);
    }
  }
);

/** CLIENTE → BLOQUEIA se houver qualquer filho. */
async function deleteClientSafe(db: admin.firestore.Firestore, id: string) {
  const checks: Array<[string, admin.firestore.Query, string]> = [
    ['projects',        db.collection('projects').where('clientId', '==', id),        'Projetos'],
    ['assessments',     db.collection('assessments').where('clientId', '==', id),     'Formulários'],
    ['participants',    db.collection('participants').where('clientId', '==', id),     'Participantes'],
    ['userGroups',      db.collection('userGroups').where('clientId', '==', id),       'Grupos de usuários'],
    ['creditOrders',    db.collection('creditOrders').where('clientId', '==', id),     'Pedidos de crédito'],
    ['competencies',    db.collection('competencies').where('clientId', '==', id),     'Competências'],
    ['competencyGroups',db.collection('competencyGroups').where('clientId', '==', id), 'Grupos de competências'],
    ['mailTemplates',   db.collection('mailTemplates').where('clientId', '==', id),    'Modelos de e-mail'],
    ['reports',         db.collection('reports').where('clientId', '==', id),           'Relatórios salvos'],
    ['reportTemplates', db.collection('reportTemplates').where('clientId', '==', id),   'Templates de relatório'],
    ['releasedReports', db.collection('releasedReports').where('clientId', '==', id),  'Relatórios publicados'],
  ];
  const blockers: BlockerInfo[] = [];
  for (const [coll, q, label] of checks) {
    const c = (await q.count().get()).data().count;
    if (c > 0) blockers.push({ collection: coll, label, count: c });
  }
  if (blockers.length > 0) {
    throw new HttpsError('failed-precondition', 'Cliente possui vínculos ativos.', { blockers });
  }
  await db.collection('clients').doc(id).delete();
  return { deleted: true };
}

/** PROJETO → CASCATA atômica: apaga filhos exclusivos + estorna créditos. */
async function deleteProjectSafe(db: admin.firestore.Firestore, id: string) {
  const projectSnap = await db.collection('projects').doc(id).get();
  const clientId = normalizeOptionalString(projectSnap.data()?.['clientId']);

  // Apaga formulários do projeto + suas subcoleções (results)
  const assessmentsSnap = await db.collection('assessments').where('projectId', '==', id).get();
  for (const a of assessmentsSnap.docs) {
    await db.recursiveDelete(a.ref);
  }

  // Apaga participantes, links e templates de e-mail do projeto
  await deleteQueryInBatches(db.collection('participants').where('projectId', '==', id));
  await deleteQueryInBatches(db.collection('assessmentLinks').where('projectId', '==', id));
  await deleteQueryInBatches(db.collection('mailTemplates').where('projectId', '==', id));

  // Desvincula o projeto dos grupos
  await pullFromArrayField('userGroups', 'projectIds', id);

  // Apaga o projeto
  await db.collection('projects').doc(id).delete();

  // Estorna/recalcula créditos do cliente
  if (clientId) {
    try { await sincronizarCreditosCliente(clientId); } catch { /* log abaixo */ }
  }
  return { deleted: true };
}

/** PARTICIPANTE → CASCATA: avaliadores vinculados + links + resync de crédito. */
async function deleteParticipantSafe(db: admin.firestore.Firestore, id: string) {
  const pSnap = await db.collection('participants').doc(id).get();
  const data = pSnap.data() || {};
  const clientId = normalizeOptionalString(data['clientId']);
  const projectId = normalizeOptionalString(data['projectId']);

  // Avaliadores vinculados a este avaliado
  const avaliadoresSnap = await db.collection('participants').where('avaliadoId', '==', id).get();
  const idsToDelete = [id, ...avaliadoresSnap.docs.map(d => d.id)];

  // Links de todos os participantes envolvidos
  for (const pid of idsToDelete) {
    await deleteQueryInBatches(db.collection('assessmentLinks').where('participantId', '==', pid));
    // Respostas na subcoleção do assessment do projeto
    if (projectId) {
      const aSnap = await db.collection('assessments').where('projectId', '==', projectId).get();
      for (const a of aSnap.docs) {
        await deleteQueryInBatches(a.ref.collection('results').where('participantId', '==', pid));
      }
    }
  }

  // Apaga os participantes
  const batch = db.batch();
  idsToDelete.forEach(pid => batch.delete(db.collection('participants').doc(pid)));
  await batch.commit();

  // Recalcula créditos (estorno de reservas liberadas)
  if (clientId) {
    try { await sincronizarCreditosCliente(clientId); } catch { /* ignora */ }
  }
  return { deleted: true, removed: idsToDelete.length };
}

/** PEDIDO DE CRÉDITO → BLOQUEIA se houver participante usando o crédito. */
async function deleteCreditOrderSafe(db: admin.firestore.Firestore, id: string) {
  const used = (await db.collection('participants').where('orderId', '==', id).count().get()).data().count;
  if (used > 0) {
    throw new HttpsError('failed-precondition', 'Pedido possui créditos reservados/consumidos.', {
      blockers: [{ collection: 'participants', label: 'Participantes usando este crédito', count: used }],
    });
  }
  await db.collection('creditOrders').doc(id).delete();
  return { deleted: true };
}

/** FORMULÁRIO → BLOQUEIA se houver respostas/links/snapshots. */
async function deleteAssessmentSafe(db: admin.firestore.Firestore, id: string) {
  const links = (await db.collection('assessmentLinks').where('assessmentId', '==', id).count().get()).data().count;
  const snaps = (await db.collection('releasedReports').where('assessmentId', '==', id).count().get()).data().count;
  const results = (await db.collection('assessments').doc(id).collection('results').count().get()).data().count;
  const blockers: BlockerInfo[] = [];
  if (results > 0) blockers.push({ collection: 'results', label: 'Respostas registradas', count: results });
  if (links > 0)   blockers.push({ collection: 'assessmentLinks', label: 'Convites enviados', count: links });
  if (snaps > 0)   blockers.push({ collection: 'releasedReports', label: 'Relatórios publicados', count: snaps });
  if (blockers.length > 0) {
    throw new HttpsError('failed-precondition', 'Formulário possui vínculos ativos.', { blockers });
  }
  await db.recursiveDelete(db.collection('assessments').doc(id));
  return { deleted: true };
}

// ──────────────────────────────────────────────────────────────────
// TRIGGERS de limpeza de órfãos (defesa em profundidade)
// Executam mesmo se o registro for apagado fora do safeDelete.
// ──────────────────────────────────────────────────────────────────

/** Ao apagar um PROJETO, limpa filhos órfãos e ressincroniza créditos. */
export const onProjectDeleted = onDocumentDeleted(
  { document: 'projects/{projectId}', region: DELETE_REGION },
  async (event) => {
    const db = getDb();
    const projectId = event.params.projectId;
    const clientId = normalizeOptionalString(event.data?.data()?.['clientId']);
    try {
      const assessmentsSnap = await db.collection('assessments').where('projectId', '==', projectId).get();
      for (const a of assessmentsSnap.docs) await db.recursiveDelete(a.ref);
      await deleteQueryInBatches(db.collection('participants').where('projectId', '==', projectId));
      await deleteQueryInBatches(db.collection('assessmentLinks').where('projectId', '==', projectId));
      await deleteQueryInBatches(db.collection('mailTemplates').where('projectId', '==', projectId));
      await pullFromArrayField('userGroups', 'projectIds', projectId);
      if (clientId) await sincronizarCreditosCliente(clientId);
    } catch (e) {
      console.error('onProjectDeleted: erro na limpeza de órfãos:', (e as Error).message);
    }
  }
);

/** Ao apagar um CLIENTE, remove em cascata todas as entidades vinculadas. */
export const onClientDeleted = onDocumentDeleted(
  { document: 'clients/{clientId}', region: DELETE_REGION },
  async (event) => {
    const db = getDb();
    const clientId = event.params.clientId;
    try {
      // Apaga projetos (que por sua vez disparam onProjectDeleted)
      await deleteQueryInBatches(db.collection('projects').where('clientId', '==', clientId));
      await deleteQueryInBatches(db.collection('participants').where('clientId', '==', clientId));
      const assessmentsSnap = await db.collection('assessments').where('clientId', '==', clientId).get();
      for (const a of assessmentsSnap.docs) await db.recursiveDelete(a.ref);
      await deleteQueryInBatches(db.collection('userGroups').where('clientId', '==', clientId));
      await deleteQueryInBatches(db.collection('creditOrders').where('clientId', '==', clientId));
      await deleteQueryInBatches(db.collection('competencies').where('clientId', '==', clientId));
      await deleteQueryInBatches(db.collection('competencyGroups').where('clientId', '==', clientId));
      await deleteQueryInBatches(db.collection('mailTemplates').where('clientId', '==', clientId));
    } catch (e) {
      console.error('onClientDeleted: erro na limpeza de órfãos:', (e as Error).message);
    }
  }
);

/** Ao apagar um PARTICIPANTE, limpa seus links e respostas órfãos. */
export const onParticipantDeleted = onDocumentDeleted(
  { document: 'participants/{participantId}', region: DELETE_REGION },
  async (event) => {
    const db = getDb();
    const participantId = event.params.participantId;
    const clientId = normalizeOptionalString(event.data?.data()?.['clientId']);
    try {
      await deleteQueryInBatches(db.collection('assessmentLinks').where('participantId', '==', participantId));
      if (clientId) await sincronizarCreditosCliente(clientId);
    } catch (e) {
      console.error('onParticipantDeleted: erro na limpeza de órfãos:', (e as Error).message);
    }
  }
);
