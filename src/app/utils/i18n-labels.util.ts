import { TranslateService } from '@ngx-translate/core';

/** Mapeia valores de categoria do Firestore para chaves de tradução (PT como chave). */
const PARTICIPANT_CATEGORY_I18N_KEYS: Record<string, string> = {
  Avaliado: 'Avaliado',
  'Avaliado(a)': 'Avaliado(a)',
  Gestor: 'Gestor(es)',
  'Gestor(es)': 'Gestor(es)',
  Par: 'Pares',
  Pares: 'Pares',
  Subordinado: 'Subordinados',
  Subordinados: 'Subordinados',
  Outro: 'Outros',
  Outros: 'Outros',
  Líder: 'Gestor(es)',
  Liderado: 'Subordinados',
};

const PROJECT_STATUS_I18N_KEYS: Record<string, string> = {
  'Em andamento': 'Em andamento',
  Ativo: 'Em andamento',
  Concluído: 'Concluído',
  concluido: 'Concluído',
  Cancelado: 'Cancelado',
  cancelado: 'Cancelado',
  Inativo: 'Cancelado',
};

export function translateParticipantCategory(
  translate: TranslateService,
  category: string | null | undefined
): string {
  if (!category) {
    return translate.instant('Outros');
  }
  const key = PARTICIPANT_CATEGORY_I18N_KEYS[category] ?? category;
  const translated = translate.instant(key);
  return translated === key && key !== category ? translate.instant(category) : translated;
}

export function translateProjectStatus(
  translate: TranslateService,
  status: string | null | undefined
): string {
  if (!status) {
    return translate.instant('Em andamento');
  }
  const key = PROJECT_STATUS_I18N_KEYS[status] ?? status;
  return translate.instant(key);
}

export function translateProjectStatusFilterLabel(
  translate: TranslateService,
  filterValue: string
): string {
  if (filterValue === 'all') {
    return translate.instant('Todos');
  }
  return translateProjectStatus(translate, filterValue);
}
