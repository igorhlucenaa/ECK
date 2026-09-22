import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as nodemailer from 'nodemailer';
import { defineString } from 'firebase-functions/params';
import { getFirebaseAdmin } from './shared/firebase-admin.js';

const DEFAULT_FRONTEND_URL = 'https://eck360.web.app';
const EMAIL_USER_PARAM = defineString('EMAIL_USER', { default: '' });
const EMAIL_PASS_PARAM = defineString('EMAIL_PASS', { default: '' });

function normalizeOptionalString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Firebase Auth exige domínio autorizado — localhost/127.0.0.1 falham em dev. */
function resolveLoginContinueUrl(requested: string): string {
  const raw =
    normalizeOptionalString(requested) ||
    normalizeOptionalString(process.env.FRONTEND_URL) ||
    DEFAULT_FRONTEND_URL;
  let loginContinue = raw.includes('/authentication/login')
    ? raw
    : `${raw.replace(/\/$/, '')}/authentication/login`;

  try {
    const { hostname } = new URL(loginContinue);
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal) {
      const fallback =
        normalizeOptionalString(process.env.FRONTEND_URL) || DEFAULT_FRONTEND_URL;
      loginContinue = `${fallback.replace(/\/$/, '')}/authentication/login`;
    }
  } catch {
    loginContinue = `${DEFAULT_FRONTEND_URL.replace(/\/$/, '')}/authentication/login`;
  }
  return loginContinue;
}

function authErrorMessage(err: unknown): string | null {
  const code =
    (err as { code?: string })?.code ||
    (err as { errorInfo?: { code?: string } })?.errorInfo?.code;
  if (code === 'auth/unauthorized-continue-uri') {
    return 'URL de retorno não autorizada no Firebase Auth. Defina FRONTEND_URL ou authorized domains.';
  }
  return null;
}

function getEmailCredentials(): { emailUser: string; emailPass: string } {
  const emailUser = EMAIL_USER_PARAM.value() || process.env.EMAIL_USER || '';
  const emailPass = EMAIL_PASS_PARAM.value() || process.env.EMAIL_PASS || '';
  if (!emailUser || !emailPass) {
    throw new HttpsError(
      'failed-precondition',
      'Configuração de e-mail (SMTP) não encontrada no servidor.'
    );
  }
  return { emailUser, emailPass };
}

function getTransporter(emailUser: string, emailPass: string): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: emailUser, pass: emailPass },
  });
}

export function buildPasswordResetEmailHtml(resetLink: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(27,45,86,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1B2D56 0%,#1B84FF 100%);padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">ECK Avaliação 360</p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Redefinição de senha de acesso</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;color:#1B2D56;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px;">Olá,</p>
            <p style="margin:0 0 20px;">Recebemos uma solicitação para redefinir a senha da sua conta na plataforma <strong>ECK Avaliação 360</strong>. Clique no botão abaixo para criar uma nova senha.</p>
            <p style="margin:0 0 28px;text-align:center;">
              <a href="${resetLink}" style="display:inline-block;background:#1B84FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:8px;">Definir nova senha</a>
            </p>
            <p style="margin:0 0 12px;font-size:13px;color:#5c6b80;">Se o botão não funcionar, copie e cole este link no navegador:</p>
            <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#1B84FF;">${resetLink}</p>
            <p style="margin:0;font-size:13px;color:#5c6b80;">Se você não solicitou esta alteração, ignore este e-mail. Sua senha atual permanece válida.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #e8ecf2;text-align:center;font-size:11px;color:#8a94a6;">
            © ${year} ECK Consulting — Confidencial
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendBrandedPasswordResetToEmail(
  email: string,
  continueUrl: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const auth = getFirebaseAdmin().auth();
  try {
    await auth.getUserByEmail(normalizedEmail);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/user-not-found') {
      return;
    }
    throw err;
  }

  const resetLink = await auth.generatePasswordResetLink(normalizedEmail, {
    url: continueUrl,
    handleCodeInApp: false,
  });

  const { emailUser, emailPass } = getEmailCredentials();
  const transporter = getTransporter(emailUser, emailPass);

  await transporter.sendMail({
    from: `ECK Avaliacao 360 <${emailUser}>`,
    to: normalizedEmail,
    subject: 'ECK Avaliação 360 — Redefinir sua senha',
    html: buildPasswordResetEmailHtml(resetLink),
  });
}

/** E-mail de reset com layout ECK (substitui template genérico do Firebase). */
export const sendBrandedPasswordResetEmail = onCall(
  { region: 'us-central1', invoker: 'public', cors: true },
  async (request) => {
    const emailRaw = normalizeOptionalString(
      (request.data as { email?: string })?.email
    );
    const continueUrlRaw = normalizeOptionalString(
      (request.data as { continueUrl?: string })?.continueUrl
    );

    if (!emailRaw || !isValidEmail(emailRaw)) {
      throw new HttpsError('invalid-argument', 'E-mail inválido.');
    }

    const loginContinue = resolveLoginContinueUrl(continueUrlRaw);

    try {
      await sendBrandedPasswordResetToEmail(emailRaw, loginContinue);
      return { ok: true };
    } catch (err: unknown) {
      console.error('sendBrandedPasswordResetEmail:', err);
      if (err instanceof HttpsError) {
        throw err;
      }
      const authMsg = authErrorMessage(err);
      const message =
        authMsg ||
        (err instanceof Error && err.message
          ? err.message
          : 'Não foi possível enviar o e-mail de redefinição de senha.');
      throw new HttpsError('internal', message);
    }
  }
);
