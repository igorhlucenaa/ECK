/** Dias até o fim do dia da validade (mesma regra em /orders e ficha do cliente). */
export function computeDaysRemaining(
  validityDate: Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (!validityDate || Number.isNaN(validityDate.getTime())) {
    return null;
  }
  const end = new Date(validityDate);
  end.setHours(23, 59, 59, 999);
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export interface ClientCreditValiditySummary {
  creditsAvailable: number;
  nearestValidity: Date | null;
  nearestOrderStatus: string | null;
  daysRemaining: number | null;
}
