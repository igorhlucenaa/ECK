export const REMINDER_MAIL_EMAIL_TYPES = new Set([
  'lembreteAvaliador',
  'lembreteRespondente',
  'lembrete',
]);

export const INVITE_MAIL_EMAIL_TYPES = new Set([
  'conviteAvaliador',
  'conviteRespondente',
  'convite',
]);

export function isGlobalMailTemplate(data: Record<string, unknown>): boolean {
  const cid = data['clientId'];
  return cid === undefined || cid === null || cid === '';
}

export function isReminderMailType(emailType: string | undefined | null): boolean {
  return !!emailType && REMINDER_MAIL_EMAIL_TYPES.has(emailType);
}

export function isInviteMailType(emailType: string | undefined | null): boolean {
  return !!emailType && INVITE_MAIL_EMAIL_TYPES.has(emailType);
}

export function friendlyMailTypeKey(emailType: string): string {
  switch (emailType) {
    case 'cadastro':
      return 'Cadastro do Usuário';
    case 'conviteAvaliador':
      return 'Convite - Avaliador';
    case 'conviteRespondente':
      return 'Convite - Avaliado';
    case 'convite':
      return 'Convite';
    case 'lembreteAvaliador':
      return 'Lembrete - Avaliador';
    case 'lembreteRespondente':
      return 'Lembrete - Avaliado';
    case 'lembrete':
      return 'Lembrete';
    default:
      return emailType || 'Tipo Desconhecido';
  }
}

export function mailTemplateVisibleForClient(
  data: Record<string, unknown>,
  clientId: string
): boolean {
  return isGlobalMailTemplate(data) || data['clientId'] === clientId;
}
