import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { defineString } from 'firebase-functions/params';

const DEFAULT_FRONTEND_URL = 'https://eck360.web.app';
const EMAIL_USER_PARAM = defineString('EMAIL_USER', { default: '' });
const EMAIL_PASS_PARAM = defineString('EMAIL_PASS', { default: '' });

let firestoreDb: admin.firestore.Firestore | null = null;

function getDb(): admin.firestore.Firestore {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  if (!firestoreDb) {
    firestoreDb = admin.firestore();
  }
  return firestoreDb;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDatePtBr(date: Date | undefined): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function asDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date };
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
    }
  }
  return undefined;
}

function linkifyPlainUrls(html: string): string {
  const urlRegex = /(^|[\s>])(https?:\/\/[^\s<>"']+)/g;
  return html.replace(urlRegex, (_, before: string, url: string) => {
    return `${before}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function applyTemplateVariables(source: string, replacements: Record<string, string>): string {
  let text = source;
  const participantName = replacements.participantName || 'Participante';
  const avaliadoName = replacements.avaliadoName || '-';
  const projectDeadline = replacements.projectDeadline || '';
  const projectName = replacements.projectName || '';
  const clientName = replacements.clientName || '';
  const participantCategory = replacements.participantCategory || '-';
  const linkRelatorio = replacements.LINK_RELATORIO || '';

  text = text.replace(/\{\{\s*nome_participante\s*\}\}/gi, participantName);
  text = text.replace(/\{\{\s*nome_avaliado\s*\}\}/gi, avaliadoName);
  text = text.replace(/\{\{\s*categoria\s*\}\}/gi, participantCategory);
  text = text.replace(/\{\{\s*data_expiracao\s*\}\}/gi, projectDeadline);
  text = text.replace(/\{\{\s*nome_projeto\s*\}\}/gi, projectName);
  text = text.replace(/\{\{\s*nome_cliente\s*\}\}/gi, clientName);
  text = text.replace(/\$%NOME DO PROJETO\$%/gi, projectName);
  text = text.replace(/\$%NOME_DO_PROJETO\$%/gi, projectName);
  text = text.replace(/\$%NOME DO CLIENTE\$%/gi, clientName);
  text = text.replace(/\$%NOME_DO_AVALIADO\$%/gi, avaliadoName);
  text = text.replace(/\$%Nome do usuario preenchido dinamicamente\$%/gi, participantName);
  text = text.replace(/\$%Nome do usuário preenchido dinâmicamente\$%/g, participantName);

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
    throw new Error('Template sem conteudo valido.');
  }

  const bodyValues = (body.values || {}) as Record<string, unknown>;
  const fontFamily =
    normalizeOptionalString((bodyValues.fontFamily as Record<string, unknown> | undefined)?.value) ||
    'Arial, sans-serif';
  const textColor = normalizeOptionalString(bodyValues.textColor) || '#111827';
  const backgroundColor = normalizeOptionalString(bodyValues.backgroundColor) || '#ffffff';

  let html = `<div style="font-family:${fontFamily};color:${textColor};background-color:${backgroundColor};max-width:600px;margin:0 auto;">`;

  for (const row of rows) {
    const columns = Array.isArray((row as Record<string, unknown>).columns)
      ? ((row as Record<string, unknown>).columns as unknown[])
      : [];

    for (const column of columns) {
      const contents = Array.isArray((column as Record<string, unknown>).contents)
        ? ((column as Record<string, unknown>).contents as unknown[])
        : [];

      for (const content of contents) {
        const values = ((content as Record<string, unknown>).values || {}) as Record<string, unknown>;
        const rawText = normalizeOptionalString(values.text) || '';
        html += applyTemplateVariables(rawText, replacements);
      }
    }
  }

  html += '</div>';
  return html;
}

function getEmailCredentials(): { emailUser: string; emailPass: string } {
  const emailUser = EMAIL_USER_PARAM.value();
  const emailPass = EMAIL_PASS_PARAM.value();
  if (!emailUser || !emailPass) {
    throw new Error('Credenciais de e-mail nao configuradas.');
  }
  return { emailUser, emailPass };
}

function getTransporter(emailUser: string, emailPass: string): nodemailer.Transporter {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  });
}

function buildReportLinkUrl(params: {
  clientId: string;
  assessmentId: string;
  projectId?: string;
  avaliadoName: string;
}): string {
  const frontendBaseUrl = normalizeOptionalString(process.env.FRONTEND_URL) || DEFAULT_FRONTEND_URL;
  const qs = new URLSearchParams();
  qs.set('clientId', params.clientId);
  qs.set('assessmentId', params.assessmentId);
  if (params.projectId) qs.set('projectId', params.projectId);
  qs.set('avaliado', params.avaliadoName);
  qs.set('exportAction', 'openReports');
  return `${frontendBaseUrl}/reports?${qs.toString()}`;
}

async function findMailTemplateByType(
  clientId: string,
  emailType: string
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const db = getDb();

  if (clientId) {
    const clientSnap = await db
      .collection('mailTemplates')
      .where('clientId', '==', clientId)
      .where('emailType', '==', emailType)
      .limit(1)
      .get();
    if (!clientSnap.empty) {
      return { id: clientSnap.docs[0].id, data: clientSnap.docs[0].data() as Record<string, unknown> };
    }
  }

  const allSnap = await db.collection('mailTemplates').where('emailType', '==', emailType).get();
  const defaultDoc = allSnap.docs.find((d) => !normalizeOptionalString(d.data()['clientId']));
  if (defaultDoc) {
    return { id: defaultDoc.id, data: defaultDoc.data() as Record<string, unknown> };
  }
  if (allSnap.docs.length === 1) {
    return { id: allSnap.docs[0].id, data: allSnap.docs[0].data() as Record<string, unknown> };
  }
  return null;
}

async function loadProjectUsers(
  projectId: string
): Promise<Array<{ id: string; name: string; email: string }>> {
  const db = getDb();
  const projectDoc = await db.collection('projects').doc(projectId).get();
  if (!projectDoc.exists) return [];

  const projectData = projectDoc.data() || {};
  const clientId = normalizeOptionalString(projectData.clientId);
  const groupIds: string[] = Array.isArray(projectData.groupIds) ? projectData.groupIds : [];
  if (!groupIds.length) return [];

  const userIds = new Set<string>();
  for (let i = 0; i < groupIds.length; i += 10) {
    const chunk = groupIds.slice(i, i + 10);
    const groupsSnap = await db
      .collection('userGroups')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    groupsSnap.docs.forEach((groupDoc) => {
      const ids = groupDoc.data()['userIds'];
      if (Array.isArray(ids)) {
        ids.forEach((id: unknown) => {
          if (typeof id === 'string' && id.trim()) userIds.add(id);
        });
      }
    });
  }

  const results: Array<{ id: string; name: string; email: string }> = [];
  const userIdArr = Array.from(userIds);
  for (let i = 0; i < userIdArr.length; i += 10) {
    const chunk = userIdArr.slice(i, i + 10);
    const usersSnap = await db
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    usersSnap.docs.forEach((userDoc) => {
      const data = userDoc.data();
      if (data.blocked === true) return;
      const email = normalizeOptionalString(data.email);
      if (!email || !isValidEmail(email)) return;
      if (clientId && normalizeOptionalString(data.client) !== clientId) return;
      const name = [normalizeOptionalString(data.name), normalizeOptionalString(data.surname)]
        .filter(Boolean)
        .join(' ');
      results.push({
        id: userDoc.id,
        name: name || 'Usuario',
        email,
      });
    });
  }

  return results;
}

async function sendReportNotificationEmail(input: {
  toEmail: string;
  recipientName: string;
  template: Record<string, unknown>;
  replacements: Record<string, string>;
  transporter: nodemailer.Transporter;
  emailUser: string;
}): Promise<void> {
  const templateContentRaw = normalizeOptionalString(input.template.content);
  if (!templateContentRaw) {
    throw new Error('Template sem conteudo valido.');
  }

  const parsedContent = JSON.parse(templateContentRaw) as Record<string, unknown>;
  const templateReplacements = {
    LINK_RELATORIO: input.replacements.LINK_RELATORIO || '',
    participantName: input.recipientName,
    participantCategory: input.replacements.participantCategory || '-',
    avaliadoName: input.replacements.avaliadoName || '-',
    projectDeadline: input.replacements.projectDeadline || '',
    projectName: input.replacements.projectName || '',
    clientName: input.replacements.clientName || '',
  };

  const emailHtml = renderTemplateToHtml(parsedContent, templateReplacements);
  const subjectRaw = normalizeOptionalString(input.template.subject) || 'Relatorio ECK 360';
  const subject = applyTemplateVariables(subjectRaw, templateReplacements);

  await input.transporter.sendMail({
    from: `ECK Avaliacao 360 <${input.emailUser}>`,
    to: input.toEmail,
    subject,
    html: emailHtml,
  });
}

export interface NotifyReportReleasedResult {
  success: boolean;
  skipped?: boolean;
  participantSent: boolean;
  teamSent: number;
  errors: string[];
  missingTemplates: string[];
}

export async function processReportReleasedNotifications(input: {
  clientId: string;
  assessmentId: string;
  avaliadoName: string;
  projectId?: string;
  participantId?: string;
  snapshotId: string;
}): Promise<NotifyReportReleasedResult> {
  const db = getDb();
  const logRef = db.collection('reportReleaseNotifications').doc(input.snapshotId);
  const existingLog = await logRef.get();
  if (existingLog.exists) {
    return {
      success: true,
      skipped: true,
      participantSent: false,
      teamSent: 0,
      errors: [],
      missingTemplates: [],
    };
  }

  const errors: string[] = [];
  const missingTemplates: string[] = [];
  let participantSent = false;
  let teamSent = 0;

  let projectName = '';
  let projectDeadline = '';
  let resolvedProjectId = normalizeOptionalString(input.projectId);

  if (resolvedProjectId) {
    const projectDoc = await db.collection('projects').doc(resolvedProjectId).get();
    if (projectDoc.exists) {
      const projectData = projectDoc.data() || {};
      projectName = normalizeOptionalString(projectData.name) || '';
      projectDeadline = formatDatePtBr(asDate(projectData.deadline));
    }
  }

  let clientName = '';
  if (input.clientId) {
    const clientDoc = await db.collection('clients').doc(input.clientId).get();
    if (clientDoc.exists) {
      clientName = normalizeOptionalString(clientDoc.data()?.companyName) || '';
    }
  }

  const reportLink = buildReportLinkUrl({
    clientId: input.clientId,
    assessmentId: input.assessmentId,
    projectId: resolvedProjectId,
    avaliadoName: input.avaliadoName,
  });

  const baseReplacements = {
    LINK_RELATORIO: reportLink,
    avaliadoName: input.avaliadoName,
    projectName,
    projectDeadline,
    clientName,
    participantCategory: 'Avaliado',
  };

  const { emailUser, emailPass } = getEmailCredentials();
  const transporter = getTransporter(emailUser, emailPass);

  const participantTemplate = await findMailTemplateByType(input.clientId, 'relatorioFinalizado');
  const teamTemplate = await findMailTemplateByType(input.clientId, 'relatorioFinalizadoEquipe');

  if (!participantTemplate) missingTemplates.push('relatorioFinalizado');
  if (!teamTemplate) missingTemplates.push('relatorioFinalizadoEquipe');

  if (participantTemplate && input.participantId) {
    try {
      const participantDoc = await db.collection('participants').doc(input.participantId).get();
      if (participantDoc.exists) {
        const participantData = participantDoc.data() || {};
        if (participantData.blocked !== true) {
          const email = normalizeOptionalString(participantData.email);
          const name = normalizeOptionalString(participantData.name) || input.avaliadoName;
          if (!resolvedProjectId) {
            resolvedProjectId = normalizeOptionalString(participantData.projectId);
          }
          if (email && isValidEmail(email)) {
            await sendReportNotificationEmail({
              toEmail: email,
              recipientName: name,
              template: participantTemplate.data,
              replacements: baseReplacements,
              transporter,
              emailUser,
            });
            participantSent = true;
          } else {
            errors.push('E-mail do avaliado invalido ou ausente.');
          }
        }
      }
    } catch (error) {
      const err = error as Error;
      errors.push(`Erro ao notificar avaliado: ${err.message || 'Erro desconhecido'}`);
    }
  }

  if (teamTemplate && resolvedProjectId) {
    try {
      const projectUsers = await loadProjectUsers(resolvedProjectId);
      for (const user of projectUsers) {
        try {
          await sendReportNotificationEmail({
            toEmail: user.email,
            recipientName: user.name,
            template: teamTemplate.data,
            replacements: baseReplacements,
            transporter,
            emailUser,
          });
          teamSent += 1;
        } catch (error) {
          const err = error as Error;
          errors.push(`Erro ao notificar ${user.email}: ${err.message || 'Erro desconhecido'}`);
        }
      }
    } catch (error) {
      const err = error as Error;
      errors.push(`Erro ao carregar usuarios do projeto: ${err.message || 'Erro desconhecido'}`);
    }
  } else if (teamTemplate && !resolvedProjectId) {
    errors.push('Projeto nao informado para notificar a equipe.');
  }

  await logRef.set({
    clientId: input.clientId,
    assessmentId: input.assessmentId,
    avaliadoName: input.avaliadoName,
    projectId: resolvedProjectId || null,
    participantId: input.participantId || null,
    participantSent,
    teamSent,
    missingTemplates,
    errors,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: errors.length === 0 || participantSent || teamSent > 0,
    participantSent,
    teamSent,
    errors,
    missingTemplates,
  };
}

export const notifyReportReleased = onRequest(
  {
    region: 'us-central1',
    cors: true,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send({ error: 'Metodo nao permitido.' });
      return;
    }

    const {
      clientId,
      assessmentId,
      avaliadoName,
      projectId,
      participantId,
      snapshotId,
    } = req.body || {};

    if (!clientId || !assessmentId || !avaliadoName || !snapshotId) {
      res.status(400).send({
        error: 'Campos obrigatorios: clientId, assessmentId, avaliadoName, snapshotId.',
      });
      return;
    }

    try {
      const result = await processReportReleasedNotifications({
        clientId,
        assessmentId,
        avaliadoName,
        projectId,
        participantId,
        snapshotId,
      });
      res.status(200).send(result);
    } catch (error) {
      const err = error as Error;
      console.error('Erro ao notificar relatorio publicado:', err);
      res.status(500).send({
        error: `Erro ao notificar relatorio publicado: ${err.message || 'Erro desconhecido'}`,
      });
    }
  }
);
