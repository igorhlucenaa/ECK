import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  increment,
  Timestamp,
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private firestore: Firestore) {}

  /**
   * Conclui um projeto movendo créditos reservados → consumidos.
   * Não toca client.credits (já debitado no cadastro do avaliado).
   * Idempotente: chamada dupla no mesmo projeto não duplica consumo.
   */
  async concludeProject(projectId: string, concludedBy: string): Promise<void> {
    const projectRef = doc(this.firestore, `projects/${projectId}`);

    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) throw new Error('Projeto não encontrado.');

    const projectData = projectSnap.data();
    // Idempotência: retorna só se status é 'concluido' (lowercase, já processado por este serviço)
    // Projetos com 'Concluído' (title case, auto-concluídos sem crédito) ainda precisam do processamento
    if (projectData['status'] === 'concluido') return;

    const clientId: string = projectData['clientId'];
    if (!clientId) throw new Error('Projeto sem clientId.');

    const clientRef = doc(this.firestore, `clients/${clientId}`);

    // Links pendentes a expirar
    const pendingLinksSnap = await getDocs(
      query(
        collection(this.firestore, 'assessmentLinks'),
        where('projectId', '==', projectId),
        where('status', '==', 'pending')
      )
    );

    // Avaliados com crédito reservado mas ainda não consumido
    const reservedEvaluateesSnap = await getDocs(
      query(
        collection(this.firestore, 'participants'),
        where('projectId', '==', projectId),
        where('creditReserved', '==', true),
        where('creditConsumed', '==', false)
      )
    );

    const numToConsume = reservedEvaluateesSnap.docs.length;

    // Pré-gera refs de auditoria fora da transação
    const txRefs = reservedEvaluateesSnap.docs.map(() =>
      doc(collection(this.firestore, 'creditTransactions'))
    );

    await runTransaction(this.firestore, async (t) => {
      const freshProject = await t.get(projectRef);
      if (freshProject.data()?.['status'] === 'concluido') return;

      t.update(projectRef, {
        status: 'Concluído',
        concludedAt: Timestamp.now(),
        concludedBy,
      });

      for (const linkDoc of pendingLinksSnap.docs) {
        t.update(linkDoc.ref, {
          status: 'expired',
          expiredAt: Timestamp.now(),
          expiredReason: 'project_concluded',
        });
      }

      reservedEvaluateesSnap.docs.forEach((evalDoc, i) => {
        t.update(evalDoc.ref, { creditConsumed: true });
        t.set(txRefs[i], {
          type: 'consume',
          clientId,
          projectId,
          participantId: evalDoc.id,
          orderId: evalDoc.data()['orderId'] ?? null,
          createdAt: Timestamp.now(),
        });
      });

      if (numToConsume > 0) {
        t.update(clientRef, {
          reservedCredits: increment(-numToConsume),
          consumedCredits: increment(numToConsume),
        });
      }
    });
  }

  /**
   * Cancela um projeto e estorna créditos reservados de avaliados que ainda
   * não tiveram seus links disparados (creditConsumed = false).
   * Bloqueado se o projeto já tiver um disparo final (firstFinalDispatchAt).
   */
  async cancelProject(projectId: string, cancelledBy: string): Promise<void> {
    const projectRef = doc(this.firestore, `projects/${projectId}`);

    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) throw new Error('Projeto não encontrado.');

    const projectData = projectSnap.data();
    if (['concluido', 'Concluído'].includes(projectData['status'])) throw new Error('Projeto já concluído.');
    if (['cancelado', 'Cancelado'].includes(projectData['status'])) return;

    if (projectData['firstFinalDispatchAt']) {
      throw new Error('Cancelamento sem estorno: disparo final já realizado.');
    }

    const clientId: string = projectData['clientId'];
    if (!clientId) throw new Error('Projeto sem clientId.');

    const clientRef = doc(this.firestore, `clients/${clientId}`);

    const pendingLinksSnap = await getDocs(
      query(
        collection(this.firestore, 'assessmentLinks'),
        where('projectId', '==', projectId),
        where('status', '==', 'pending')
      )
    );

    // Avaliados elegíveis para estorno (reservados mas não consumidos)
    const reservedEvaluateesSnap = await getDocs(
      query(
        collection(this.firestore, 'participants'),
        where('projectId', '==', projectId),
        where('creditReserved', '==', true),
        where('creditConsumed', '==', false)
      )
    );

    const numToRefund = reservedEvaluateesSnap.docs.length;

    // Agrupa estornos por pedido (orderId)
    const orderRefundMap = new Map<string, number>();
    for (const evalDoc of reservedEvaluateesSnap.docs) {
      const orderId: string = evalDoc.data()['orderId'];
      if (orderId) {
        orderRefundMap.set(orderId, (orderRefundMap.get(orderId) ?? 0) + 1);
      }
    }

    const orderRefs = [...orderRefundMap.keys()].map((orderId) =>
      doc(this.firestore, `creditOrders/${orderId}`)
    );

    const txRefs = reservedEvaluateesSnap.docs.map(() =>
      doc(collection(this.firestore, 'creditTransactions'))
    );

    await runTransaction(this.firestore, async (t) => {
      const freshProject = await t.get(projectRef);
      if (['cancelado', 'Cancelado'].includes(freshProject.data()?.['status'])) return;

      t.update(projectRef, {
        status: 'Cancelado',
        cancelledAt: Timestamp.now(),
        cancelledBy,
      });

      for (const linkDoc of pendingLinksSnap.docs) {
        t.update(linkDoc.ref, {
          status: 'cancelled',
          cancelledAt: Timestamp.now(),
        });
      }

      reservedEvaluateesSnap.docs.forEach((evalDoc, i) => {
        t.update(evalDoc.ref, { creditReserved: false });
        t.set(txRefs[i], {
          type: 'refund',
          clientId,
          projectId,
          participantId: evalDoc.id,
          orderId: evalDoc.data()['orderId'] ?? null,
          createdAt: Timestamp.now(),
        });
      });

      // Estorna créditos para os pedidos de origem (FIFO reverso)
      for (const orderRef of orderRefs) {
        const refundCount = orderRefundMap.get(orderRef.id) ?? 0;
        t.update(orderRef, { remainingCredits: increment(refundCount) });
      }

      if (numToRefund > 0) {
        t.update(clientRef, {
          credits: increment(numToRefund),
          reservedCredits: increment(-numToRefund),
        });
      }
    });
  }
}
