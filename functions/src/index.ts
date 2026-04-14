import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';
import { defineString } from 'firebase-functions/params';

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
  enabled?: boolean;
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
  text = text.replace(/\{\{\s*nome_cliente\s*\}\}/gi, clientName);

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

  const subject = normalizeOptionalString(template.subject) || 'Avaliacao 360';
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

  const nextReminderAt = asDate(linkData.nextReminderAt);
  if (nextReminderAt && now < nextReminderAt) {
    return false;
  }

  const intervalDays = sanitizeIntervalDays(setting.intervalDays, 3);
  const baseDate = asDate(linkData.lastReminderSentAt) || asDate(linkData.sentAt);
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
  statsByClient: Map<string, ReminderRunStats>,
  scheduleByClient: Map<string, ScheduleState>
): Promise<void> {
  const updates: Array<Promise<admin.firestore.WriteResult>> = [];

  for (const [clientId, stats] of statsByClient.entries()) {
    const scheduleState = scheduleByClient.get(clientId);
    const payload: Record<string, unknown> = {
      clientId,
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRunSummary: stats,
    };
    if (scheduleState?.canRun && scheduleState.windowKey) {
      payload.lastRunWindowKey = scheduleState.windowKey;
    }

    updates.push(getDb().collection('reminderSettings').doc(clientId).set(payload, { merge: true }));
  }

  await Promise.all(updates);
}

async function processPendingAssessmentReminders(
  options: ProcessRemindersOptions
): Promise<void> {
  const now = options.now || new Date();
  const targetClientIds = new Set(
    (options.targetClientIds || [])
      .map((clientId) => normalizeOptionalString(clientId))
      .filter((clientId): clientId is string => !!clientId)
  );

  const settingsSnap = await getDb()
    .collection('reminderSettings')
    .where('enabled', '==', true)
    .get();

  if (settingsSnap.empty) {
    console.log('Nenhuma configuracao de lembrete habilitada.');
    return;
  }

  const settingsByClient = new Map<string, ReminderSettingsDoc>();
  const statsByClient = new Map<string, ReminderRunStats>();
  const scheduleByClient = new Map<string, ScheduleState>();

  settingsSnap.docs.forEach((docSnap: admin.firestore.QueryDocumentSnapshot) => {
    const raw = (docSnap.data() || {}) as ReminderSettingsDoc;
    const clientId = normalizeOptionalString(raw.clientId) || docSnap.id;
    if (!clientId) return;
    if (targetClientIds.size > 0 && !targetClientIds.has(clientId)) return;

    const normalized: ReminderSettingsDoc = {
      clientId,
      enabled: true,
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

    settingsByClient.set(clientId, normalized);
    statsByClient.set(clientId, { sent: 0, skipped: 0, errors: 0 });
    scheduleByClient.set(clientId, buildScheduleState(normalized, now));
  });

  if (!settingsByClient.size) {
    console.log('Nenhum cliente valido com lembrete habilitado para este gatilho.');
    return;
  }

  const hasClientToRun = Array.from(scheduleByClient.values()).some((state) => state.canRun);
  if (!hasClientToRun) {
    await persistReminderRunStats(statsByClient, scheduleByClient);
    console.log('Fora da janela de execucao para todos os clientes.');
    return;
  }

  const pendingLinksSnap = await getDb()
    .collection('assessmentLinks')
    .where('status', '==', 'pending')
    .get();

  if (pendingLinksSnap.empty) {
    await persistReminderRunStats(statsByClient, scheduleByClient);
    console.log('Sem assessmentLinks pendentes para lembrete.');
    return;
  }

  const { emailUser, emailPass } = getEmailCredentials();
  const transporter = getTransporter(emailUser, emailPass);

  const participantCache = new Map<string, Record<string, unknown>>();
  const projectClientCache = new Map<string, string | undefined>();

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

    if (projectClientCache.has(projectId)) {
      return projectClientCache.get(projectId);
    }

    const projectDoc = await getDb().collection('projects').doc(projectId).get();
    const projectData = (projectDoc.data() || {}) as Record<string, unknown>;
    const fromProject = normalizeOptionalString(projectData.clientId);
    projectClientCache.set(projectId, fromProject);
    return fromProject;
  };

  for (const linkDoc of pendingLinksSnap.docs) {
    const linkData = (linkDoc.data() || {}) as Record<string, unknown>;
    const participantId = normalizeOptionalString(linkData.participantId);
    const assessmentId = normalizeOptionalString(linkData.assessmentId);

    if (!participantId || !assessmentId) {
      continue;
    }

    const clientId = await resolveClientId(linkData);
    if (!clientId) {
      continue;
    }
    if (targetClientIds.size > 0 && !targetClientIds.has(clientId)) {
      continue;
    }

    const setting = settingsByClient.get(clientId);
    const stats = statsByClient.get(clientId);
    const scheduleState = scheduleByClient.get(clientId);
    if (!setting || !stats || !scheduleState) {
      continue;
    }

    if (!scheduleState.canRun) {
      stats.skipped += 1;
      continue;
    }

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
          lastReminderAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
          lastReminderError: 'Email do participante ausente ou invalido.',
        },
        { merge: true }
      );
      continue;
    }

    const intervalDays = sanitizeIntervalDays(setting.intervalDays, 3);
    const token = normalizeOptionalString(linkData.token) || generateSecureToken();
    const avaliadoId = normalizeOptionalString(linkData.avaliadoId);

    try {
      const sendResult = await sendAssessmentEmail({
        email: participantEmail,
        templateId,
        participantId,
        assessmentId,
        evaluatedParticipantId: avaliadoId,
        tokenOverride: token,
        persistParticipantLink: false,
        transporter,
        emailUser,
      });

      await linkDoc.ref.set(
        {
          clientId: sendResult.clientId || clientId,
          participantEmail,
          token: sendResult.token,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          reminderTemplateId: templateId,
          reminderCount: admin.firestore.FieldValue.increment(1),
          lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
          lastReminderAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
          nextReminderAt: admin.firestore.Timestamp.fromDate(addDays(now, intervalDays)),
          lastReminderError: admin.firestore.FieldValue.delete(),
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
        error: err.message,
      });

      await linkDoc.ref.set(
        {
          clientId,
          lastReminderAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
          lastReminderError: err.message || 'Falha desconhecida ao enviar lembrete.',
        },
        { merge: true }
      );
    }
  }

  await persistReminderRunStats(statsByClient, scheduleByClient);

  const summary = Array.from(statsByClient.entries()).map(([clientId, stats]) => ({
    clientId,
    ...stats,
  }));
  console.log('Resumo de envio de lembretes:', {
    trigger: options.trigger,
    summary,
  });
}

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

    try {
      await processPendingAssessmentReminders({
        trigger: 'manual_http',
        targetClientIds: [clientId],
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
