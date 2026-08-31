import { calcularMediaPorGrupos, roundReportValue } from './reports-utils';

describe('calcularMediaPorGrupos', () => {
  it('calcula média das médias por grupo (cada grupo pesa igual)', () => {
    const respostasPorGrupo: Record<string, number[]> = {
      'Gestor(es)': [4],
      Pares: [4, 5],
      Subordinados: [3],
      Outros: [4],
    };

    const media = calcularMediaPorGrupos(
      ['Gestor(es)', 'Pares', 'Subordinados', 'Outros'],
      (grupo) => respostasPorGrupo[grupo] ?? []
    );

    // (4 + 4.5 + 3 + 4) / 4 = 3.875 → 3.88
    expect(media).toBe(3.88);
  });

  it('diverge da média pooled quando um grupo tem mais respondentes', () => {
    const respostasPorGrupo: Record<string, number[]> = {
      'Gestor(es)': [4],
      Pares: [3, 3],
      Subordinados: [4],
      Outros: [4],
    };

    const mediaPorGrupo = calcularMediaPorGrupos(
      ['Gestor(es)', 'Pares', 'Subordinados', 'Outros'],
      (grupo) => respostasPorGrupo[grupo] ?? []
    );

    const pooled = roundReportValue(
      Object.values(respostasPorGrupo).flat().reduce((a, b) => a + b, 0) /
        Object.values(respostasPorGrupo).flat().length
    );

    // Por grupo: (4 + 3 + 4 + 4) / 4 = 3.75
    expect(mediaPorGrupo).toBe(3.75);
    // Pooled: (4+3+3+4+4)/5 = 3.60
    expect(pooled).toBe(3.6);
    expect(mediaPorGrupo).not.toBe(pooled);
  });

  it('retorna null quando nenhum grupo tem respostas', () => {
    expect(calcularMediaPorGrupos(['Gestor(es)'], () => [])).toBeNull();
  });
});
