/** Margem única entre parágrafos (evita “duplo espaço” de margin-top + margin-bottom do <p>). */
export const EMAIL_BLOCK_MARGIN = 'margin:0 0 10px 0;padding:0;';

function mergeInlineStyle(existing: string, extra: string): string {
  const trimmed = existing.trim();
  if (!trimmed) return extra;
  return trimmed.endsWith(';') ? `${trimmed}${extra}` : `${trimmed};${extra}`;
}

function injectBlockMarginOnTag(html: string, tagName: string, marginStyle: string): string {
  const openTag = new RegExp(`<${tagName}(\\s[^>]*)?>`, 'gi');
  return html.replace(openTag, (match, attrs?: string) => {
    if (!attrs) {
      return `<${tagName} style="${marginStyle}">`;
    }

    if (/style\s*=/i.test(attrs)) {
      return match.replace(
        /style\s*=\s*("([^"]*)"|'([^']*)')/i,
        (_styleMatch, _quote, doubleQuoted, singleQuoted) => {
          const existing = doubleQuoted ?? singleQuoted ?? '';
          const quote = doubleQuoted !== undefined ? '"' : "'";
          const merged = mergeInlineStyle(existing, marginStyle);
          return `style=${quote}${merged}${quote}`;
        }
      );
    }

    return `<${tagName}${attrs} style="${marginStyle}">`;
  });
}

/**
 * Unlayer grava parágrafos como <p> com margens padrão do navegador/cliente de e-mail.
 * Dois <p> adjacentes somam margin-bottom + margin-top (~“duplo espaço”).
 */
export function normalizeUnlayerHtmlForEmail(html: string): string {
  if (!html) return html;

  let out = html.replace(/\r\n/g, '\n');

  out = injectBlockMarginOnTag(out, 'p', EMAIL_BLOCK_MARGIN);
  out = injectBlockMarginOnTag(out, 'h1', 'margin:0 0 12px 0;padding:0;');
  out = injectBlockMarginOnTag(out, 'h2', 'margin:0 0 12px 0;padding:0;');
  out = injectBlockMarginOnTag(out, 'h3', 'margin:0 0 12px 0;padding:0;');
  out = injectBlockMarginOnTag(out, 'h4', 'margin:0 0 12px 0;padding:0;');

  // Parágrafos vazios que o editor insere entre blocos viram apenas uma quebra.
  out = out.replace(/<p[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\u00a0)?\s*<\/p>/gi, '<br />');

  return out;
}
