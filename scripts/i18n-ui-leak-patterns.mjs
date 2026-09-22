/** Padrões compartilhados: QA UI i18n (leaks PT em EN/ES). */
export const PT_LEAKS_EN = [
  /\bGerencie os\b/i,
  /\bBusque por nome\b/i,
  /\bLimpar\b/,
  /\bASSUNTO\b/,
  /Tipo de Notificação/i,
  /formulários encontrados/i,
  /Configure as Competências/i,
  /Selecione o cliente\b/i,
  /\bVencimento\b/,
  /\bPrioridade\b/,
  /\bCrítica\b/,
  /\bMédia\b/,
  /Nenhum modelo/i,
  /\d+\s+modelos\b/i,
  /\d+\s+resultados\b/i,
];

export const PT_LEAKS_ES = [
  ...PT_LEAKS_EN,
  /\bCredit Orders\b/,
  /\bOperational Alerts\b/,
];

/** Menu lateral: EN/ES não devem mostrar "Participants" quando ES espera Participantes */
export const ES_SIDEBAR_EN = [
  { re: /^Participants$/m, note: 'menu EN em modo ES' },
  { re: /\bCredit Orders\b/, note: 'Pedidos EN em ES' },
];

export const EN_MUST_HAVE = {
  '/dashboard': [/Real-time indicators/i, /Overview/i],
  '/orders': [/Credit Orders|Orders/i],
  '/mail-templates': [/email template/i],
  '/competencies': [/Competenc/i],
  '/assessments/participants': [/Search by name|Participants/i],
};

export const ES_MUST_HAVE = {
  '/dashboard': [/Indicadores|Resumen|tiempo real/i],
  '/orders': [/Pedidos|Crédito/i],
};

export function findLeaks(text, lang) {
  const patterns = lang === 'es' ? PT_LEAKS_ES : PT_LEAKS_EN;
  const hits = [];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  if (lang === 'es') {
    for (const { re, note } of ES_SIDEBAR_EN) {
      if (re.test(text)) hits.push(note);
    }
  }
  return [...new Set(hits)];
}
