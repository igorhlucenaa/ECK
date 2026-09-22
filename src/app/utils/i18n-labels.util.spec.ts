import { TranslateService } from '@ngx-translate/core';
import {
  formatCountLabel,
  translateParticipantCategory,
  translateParticipantType,
} from './i18n-labels.util';

describe('i18n-labels.util', () => {
  let translate: jasmine.SpyObj<TranslateService>;

  beforeEach(() => {
    translate = jasmine.createSpyObj('TranslateService', ['instant']);
    translate.instant.and.callFake((key: string) => {
      const map: Record<string, string> = {
        cliente: 'client',
        clientes: 'clients',
        projeto: 'project',
        projetos: 'projects',
        Avaliado: 'Evaluatee',
        Avaliador: 'Evaluator',
        Pares: 'Peer',
        'Gestor(es)': 'Manager',
        Outros: 'Other',
      };
      return map[key] ?? key;
    });
  });

  it('formatCountLabel pluraliza em EN', () => {
    expect(formatCountLabel(translate, 1, 'cliente', 'clientes')).toBe('1 client');
    expect(formatCountLabel(translate, 3, 'cliente', 'clientes')).toBe('3 clients');
  });

  it('translateParticipantCategory mapeia Par → Pares → Peer', () => {
    expect(translateParticipantCategory(translate, 'Par')).toBe('Peer');
  });

  it('translateParticipantType mapeia avaliador', () => {
    expect(translateParticipantType(translate, 'avaliador')).toBe('Evaluator');
  });
});
