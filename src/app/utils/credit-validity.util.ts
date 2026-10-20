/** Dias até o fim do dia da validade (mesma regra em /orders e ficha do cliente). */
export function computeDaysRemaining(
  validityDate: Date | null | undefined,
  now: Date = new Date()
): number | null {
  const end = getCreditOrderExpiryDate(validityDate);
  if (!end) return null;
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/** A validade permanece ativa até o fim do dia indicado no pedido. */
export function getCreditOrderExpiryDate(
  validityDate: Date | null | undefined
): Date | null {
  if (!validityDate || Number.isNaN(validityDate.getTime())) {
    return null;
  }
  const end = new Date(validityDate);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function isCreditOrderExpired(
  validityDate: Date | null | undefined,
  now: Date = new Date()
): boolean {
  const expiryDate = getCreditOrderExpiryDate(validityDate);
  return expiryDate !== null && expiryDate < now;
}

export interface ClientCreditValiditySummary {
  creditsAvailable: number;
  nearestValidity: Date | null;
  nearestOrderStatus: string | null;
  daysRemaining: number | null;
}
