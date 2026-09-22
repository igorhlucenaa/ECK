import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import {
  ClientCreditValiditySummary,
  computeDaysRemaining,
} from './credit-validity.util';

/** Resumo de créditos/validade alinhado à listagem em /orders. */
export async function loadClientCreditValiditySummary(
  firestore: Firestore,
  clientId: string,
  clientData: Record<string, unknown>
): Promise<ClientCreditValiditySummary> {
  const creditsAvailable =
    typeof clientData['credits'] === 'number' ? clientData['credits'] : 0;

  let nearestValidity: Date | null = null;
  let nearestOrderStatus: string | null = null;
  const now = new Date();

  try {
    const snap = await getDocs(
      query(
        collection(firestore, 'creditOrders'),
        where('clientId', '==', clientId)
      )
    );

    for (const orderDoc of snap.docs) {
      const order = orderDoc.data();
      const status = order['status'] as string;
      if (!['Aprovado', 'Pendente'].includes(status)) {
        continue;
      }
      const validity = order['validityDate']?.toDate?.() as Date | undefined;
      if (!validity || validity < now) {
        continue;
      }
      if (!nearestValidity || validity < nearestValidity) {
        nearestValidity = validity;
        nearestOrderStatus = status;
      }
    }
  } catch (error) {
    console.error('Erro ao carregar validade de créditos:', error);
  }

  return {
    creditsAvailable,
    nearestValidity,
    nearestOrderStatus,
    daysRemaining: computeDaysRemaining(nearestValidity),
  };
}

export function formatDatePtBr(date: Date | null): string {
  if (!date) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
