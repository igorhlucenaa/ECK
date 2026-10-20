import { isCreditOrderExpired } from './credit-validity.util';

/** Totais por cliente, alinhados à listagem de pedidos em /orders. */
export interface ClientCreditTotals {
  creditsPurchased: number;
  creditsUsed: number;
  creditsAvailable: number;
  creditsExpired: number;
}

type OrderRow = Record<string, unknown>;

function orderTotal(order: OrderRow): number {
  const credits = order['credits'];
  return typeof credits === 'number' && Number.isFinite(credits)
    ? Math.max(0, credits)
    : 0;
}

function orderRemaining(order: OrderRow, status: string, total: number): number {
  const raw = order['remainingCredits'];
  if (typeof raw === 'number') {
    return Math.min(total, Math.max(0, raw));
  }
  return status === 'Aprovado' ? total : 0;
}

function expiredUnusedCredits(order: OrderRow, total: number, remaining: number): number {
  const stored = order['expiredUnusedCredits'];
  if (typeof stored === 'number') {
    return Math.min(total, Math.max(0, stored));
  }
  /** Pedidos expirados antes do campo existir: saldo zerado na expiração → todo o não-usado venceu. */
  if (order['status'] === 'Expirado') {
    return Math.min(total, Math.max(0, remaining || total));
  }
  return Math.min(total, Math.max(0, remaining));
}

export interface CreditOrderBalance {
  creditsPurchased: number;
  creditsUsed: number;
  creditsAvailable: number;
  creditsExpired: number;
  isExpired: boolean;
}

/** Calcula o saldo de um pedido usando a mesma regra nas listas de pedidos e clientes. */
export function calculateCreditOrderBalance(
  order: OrderRow,
  now: Date = new Date()
): CreditOrderBalance {
  const status = order['status'] as string;
  const total = orderTotal(order);
  const remaining = orderRemaining(order, status, total);
  const rawValidityDate = order['validityDate'];
  const validityDate =
    rawValidityDate &&
    typeof rawValidityDate === 'object' &&
    'toDate' in rawValidityDate &&
    typeof rawValidityDate.toDate === 'function'
      ? rawValidityDate.toDate()
      : undefined;
  const isExpired =
    status === 'Expirado' || isCreditOrderExpired(validityDate, now);

  if (!['Aprovado', 'Expirado'].includes(status)) {
    return {
      creditsPurchased: 0,
      creditsUsed: 0,
      creditsAvailable: 0,
      creditsExpired: 0,
      isExpired: false,
    };
  }

  if (isExpired) {
    const unused = expiredUnusedCredits(order, total, remaining);
    return {
      creditsPurchased: total,
      creditsUsed: Math.max(0, total - unused),
      creditsAvailable: 0,
      creditsExpired: unused,
      isExpired: true,
    };
  }

  return {
    creditsPurchased: total,
    creditsUsed: Math.min(total, Math.max(0, total - remaining)),
    creditsAvailable: Math.min(total, Math.max(0, remaining)),
    creditsExpired: 0,
    isExpired: false,
  };
}

/** Agrega pedidos Aprovado/Expirado do cliente (mesma regra em Gestão Clientes e resumos). */
export function aggregateClientCreditsFromOrders(
  orderDocs: { data: () => OrderRow }[],
  now: Date = new Date()
): ClientCreditTotals {
  let creditsPurchased = 0;
  let creditsAvailable = 0;
  let creditsUsed = 0;
  let creditsExpired = 0;

  for (const orderDoc of orderDocs) {
    const balance = calculateCreditOrderBalance(orderDoc.data(), now);
    creditsPurchased += balance.creditsPurchased;
    creditsAvailable += balance.creditsAvailable;
    creditsUsed += balance.creditsUsed;
    creditsExpired += balance.creditsExpired;
  }

  return {
    creditsPurchased,
    creditsUsed,
    creditsAvailable,
    creditsExpired,
  };
}
