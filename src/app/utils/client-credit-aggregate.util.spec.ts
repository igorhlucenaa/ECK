import { aggregateClientCreditsFromOrders } from './client-credit-aggregate.util';

function doc(data: Record<string, unknown>) {
  return { data: () => data };
}

describe('aggregateClientCreditsFromOrders', () => {
  const now = new Date('2026-10-19T12:00:00');

  it('soma adquiridos, disponíveis e usados em pedidos aprovados válidos', () => {
    const totals = aggregateClientCreditsFromOrders(
      [
        doc({
          status: 'Aprovado',
          credits: 10,
          remainingCredits: 7,
          validityDate: { toDate: () => new Date('2027-01-01') },
        }),
      ],
      now
    );
    expect(totals.creditsPurchased).toBe(10);
    expect(totals.creditsAvailable).toBe(7);
    expect(totals.creditsUsed).toBe(3);
    expect(totals.creditsExpired).toBe(0);
  });

  it('contabiliza créditos vencidos em pedidos Expirado', () => {
    const totals = aggregateClientCreditsFromOrders(
      [
        doc({
          status: 'Expirado',
          credits: 2,
          remainingCredits: 0,
          expiredUnusedCredits: 2,
        }),
      ],
      now
    );
    expect(totals.creditsPurchased).toBe(2);
    expect(totals.creditsAvailable).toBe(0);
    expect(totals.creditsUsed).toBe(0);
    expect(totals.creditsExpired).toBe(2);
  });

  it('contabiliza pedidos aprovados vencidos pelo saldo não usado', () => {
    const totals = aggregateClientCreditsFromOrders(
      [
        doc({
          status: 'Aprovado',
          credits: 2,
          remainingCredits: 2,
          validityDate: { toDate: () => new Date('2026-10-18T00:00:00') },
        }),
      ],
      now
    );
    expect(totals.creditsPurchased).toBe(2);
    expect(totals.creditsAvailable).toBe(0);
    expect(totals.creditsUsed).toBe(0);
    expect(totals.creditsExpired).toBe(2);
  });

  it('mantém o pedido válido durante todo o dia da validade', () => {
    const totals = aggregateClientCreditsFromOrders(
      [
        doc({
          status: 'Aprovado',
          credits: 2,
          remainingCredits: 2,
          validityDate: { toDate: () => new Date('2026-10-19T00:00:00') },
        }),
      ],
      new Date('2026-10-19T12:00:00')
    );
    expect(totals.creditsAvailable).toBe(2);
    expect(totals.creditsExpired).toBe(0);
  });

  it('expira o pedido somente após o fim do dia da validade', () => {
    const totals = aggregateClientCreditsFromOrders(
      [
        doc({
          status: 'Aprovado',
          credits: 2,
          remainingCredits: 2,
          validityDate: { toDate: () => new Date('2026-10-19T00:00:00') },
        }),
      ],
      new Date('2026-10-20T00:00:00')
    );
    expect(totals.creditsAvailable).toBe(0);
    expect(totals.creditsExpired).toBe(2);
  });

  it('usa o total como saldo restante de pedidos aprovados legados sem remainingCredits', () => {
    const totals = aggregateClientCreditsFromOrders(
      [doc({ status: 'Aprovado', credits: 2 })],
      now
    );
    expect(totals.creditsPurchased).toBe(2);
    expect(totals.creditsAvailable).toBe(2);
    expect(totals.creditsUsed).toBe(0);
  });

  it('ignora pedidos pendentes ou rejeitados', () => {
    const totals = aggregateClientCreditsFromOrders(
      [
        doc({ status: 'Pendente', credits: 5 }),
        doc({ status: 'Rejeitado', credits: 3 }),
      ],
      now
    );
    expect(totals.creditsPurchased).toBe(0);
  });
});
