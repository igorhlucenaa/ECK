export type RelatorioSecaoTipo =
  | 'capa'
  | 'introducao'
  | 'resumo'
  | 'graficos'
  | 'tabela'
  | 'tabela_detalhada'
  | 'destaques'
  | 'custom'
  | 'texto'
  | 'competencia_detalhada'
  | 'grafico_defasagem'
  | 'janela_johari'
  | 'perguntas_abertas';

export interface RelatorioSecaoLike {
  tipo: RelatorioSecaoTipo | string;
  titulo?: string;
  texto?: string;
  [key: string]: unknown;
}

const TITULO_PADRAO_POR_TIPO: Record<RelatorioSecaoTipo, string> = {
  capa: 'Relatório Feedback 360°',
  introducao: 'Introdução',
  resumo: 'Resumo dos Resultados nas Competências',
  graficos: 'Gráficos',
  tabela: 'Avaliações de Frequência por Característica',
  tabela_detalhada: 'Tabela de Distribuição de Notas',
  destaques: 'Avaliações mais altas',
  custom: 'Nova Seção',
  texto: 'Nova Seção de Texto',
  competencia_detalhada: 'Análise Detalhada por Competência',
  grafico_defasagem: 'Gráfico de Defasagem (Gap Analysis)',
  janela_johari: 'Janela de Johari',
  perguntas_abertas: 'Perguntas Abertas',
};

export const DEFAULT_TABELA_FREQUENCIA_TEXTO = [
  '<p>Esta seção descreve como cada categoria de avaliadores classificou cada item.',
  'As tabelas a seguir resumem as avaliações para cada característica específica.',
  'A última linha de cada tabela mostra a média das avaliações por categoria.',
  'A opção "Sem dados" não é exibida no resumo.</p>',
  '<p><strong>Categorias da tabela:</strong> ',
  'A — Avaliado(a), G — Gestor(es), P — Pares, S — Subordinados, O — Outros.</p>',
].join(' ');

const COPIA_RESIDUO_PATTERN = /\(\s*c[oó]pia\s*\)/gi;
const RESUMO_BASE_PATTERN = /^resumo\b/i;

const TIPOS_QUE_NAO_SAO_RESUMO: RelatorioSecaoTipo[] = [
  'tabela',
  'tabela_detalhada',
  'destaques',
  'graficos',
  'grafico_defasagem',
  'competencia_detalhada',
  'janela_johari',
  'perguntas_abertas',
  'introducao',
  'capa',
  'texto',
  'custom',
];

export function getTituloPadraoSecao(tipo: RelatorioSecaoTipo | string): string {
  return TITULO_PADRAO_POR_TIPO[tipo as RelatorioSecaoTipo] || 'Seção';
}

export function stripResiduosCopia(titulo: string): string {
  return titulo
    .replace(COPIA_RESIDUO_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tituloTemResiduoCopia(titulo: string | undefined): boolean {
  return COPIA_RESIDUO_PATTERN.test((titulo || '').trim());
}

export function tituloIncompativelComTipo(tipo: string, titulo: string | undefined): boolean {
  const normalizado = (titulo || '').trim();
  if (!normalizado) {
    return false;
  }

  if (tituloTemResiduoCopia(normalizado)) {
    return true;
  }

  const tituloSemCopia = stripResiduosCopia(normalizado);
  if (
    TIPOS_QUE_NAO_SAO_RESUMO.includes(tipo as RelatorioSecaoTipo) &&
    RESUMO_BASE_PATTERN.test(tituloSemCopia)
  ) {
    return true;
  }

  return false;
}

export function normalizeSecaoTitulo<T extends RelatorioSecaoLike>(secao: T): T {
  const tituloAtual = (secao.titulo || '').trim();
  const tituloPadrao = getTituloPadraoSecao(secao.tipo);

  if (tituloIncompativelComTipo(secao.tipo, tituloAtual)) {
    return { ...secao, titulo: tituloPadrao };
  }

  if (!tituloAtual) {
    return { ...secao, titulo: tituloPadrao };
  }

  return secao;
}

export function normalizeRelatorioConfiguracao<T extends RelatorioSecaoLike>(secoes: T[]): T[] {
  return secoes.map((secao) => normalizeSecaoTitulo(secao));
}

export function buildTituloSecaoDuplicada(
  secao: RelatorioSecaoLike,
  titulosExistentes: Array<string | undefined>
): string {
  const tituloBase = stripResiduosCopia(secao.titulo || getTituloPadraoSecao(secao.tipo));
  const existentes = new Set(
    titulosExistentes
      .map((titulo) => stripResiduosCopia(titulo || '').toLowerCase())
      .filter(Boolean)
  );

  if (!existentes.has(tituloBase.toLowerCase())) {
    return tituloBase;
  }

  let counter = 2;
  let candidato = `${tituloBase} ${counter}`;
  while (existentes.has(candidato.toLowerCase())) {
    counter += 1;
    candidato = `${tituloBase} ${counter}`;
  }

  return candidato;
}

export function aplicarDefaultsSecaoNova<T extends RelatorioSecaoLike>(secao: T): T {
  const normalizada = normalizeSecaoTitulo(secao);

  if (normalizada.tipo === 'tabela' && !(normalizada.texto || '').trim()) {
    return { ...normalizada, texto: DEFAULT_TABELA_FREQUENCIA_TEXTO };
  }

  return normalizada;
}
