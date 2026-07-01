/** Limiar de classificação conforme especificação do relatório (PPT Claro/ECK). */
export const JOHARI_THRESHOLD = 3.75;

/** Proporção altura/largura do plot (eixos 1–5 com células visivelmente confortáveis). */
export const JOHARI_PLOT_HEIGHT_RATIO = 1.25;

export interface JohariPointLike {
  self: number | null;
  others: number | null;
}

/** Classifica competência nos quatro quadrantes da Janela de Johari. */
export function classifyJohariPoint(
  self: number | null,
  others: number | null,
  threshold: number = JOHARI_THRESHOLD
): string {
  if (self === null || others === null) {
    return '—';
  }

  const highSelf = self >= threshold;
  const highOthers = others >= threshold;

  if (highSelf && highOthers) return 'Ponto forte conhecido';
  if (!highSelf && !highOthers) return 'Área de desenvolvimento conhecida';
  if (!highSelf && highOthers) return 'Ponto forte oculto';
  return 'Ponto cego';
}

export function formatJohariScore(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(2);
}

export function hasJohariPlotCoordinates(
  point: JohariPointLike
): point is JohariPointLike & { self: number; others: number } {
  return point.self !== null && point.others !== null;
}

/** Textos explicativos exibidos abaixo do gráfico no relatório. */
export const JOHARI_EXPLANATION_PARAGRAPHS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Ponto forte conhecido',
    text:
      'Os comportamentos fortes conhecidos são os que a pessoa e todos os outros classificaram com uma média acima de 3,75 para as afirmações relacionadas ao comportamento. Isso significa que a autoavaliação e as outras pessoas que respondem concordam que os comportamentos são usados em um nível excepcional.',
  },
  {
    title: 'Área de desenvolvimento conhecida',
    text:
      'Os comportamentos conhecidos das áreas de desenvolvimento são aqueles que a autoavaliação e todas as outras pessoas classificaram com uma média abaixo de 3,75 para as afirmações relacionadas ao comportamento. Isso significa que a autoavaliação e as outras pessoas que respondem concordam que a pessoa pode precisar de algum desenvolvimento nessa área.',
  },
  {
    title: 'Ponto forte oculto',
    text:
      'Comportamentos fortes ocultos são aqueles que outras pessoas classificaram com uma média acima de 3,75, mas que a autoavaliação ficou classificada abaixo de 3,75. Esses comportamentos são, portanto, pontos fortes ocultos, aqueles que a pessoa não sabia que demonstrava em nível de excelência.',
  },
  {
    title: 'Ponto cego',
    text:
      'Comportamentos de ponto cego são os que a autoavaliação classificou com uma média acima de 3,75, mas que as outras pessoas classificaram como abaixo de 3,75. Isso significa que a pessoa acredita utilizar esses comportamentos em um nível superior do que realmente o faz.',
  },
];
