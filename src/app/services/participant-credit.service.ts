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
  deleteField,
} from '@angular/fire/firestore';

export interface ParticipantCreditSnapshot {
  clientId: string;
  projectId: string;
  creditReserved: boolean;
  creditConsumed: boolean;
  orderId?: string;
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class ParticipantCreditService {
  constructor(private firestore: Firestore) {}

  async getParticipantCreditSnapshot(participantId: string): Promise<ParticipantCreditSnapshot | null> {
    const snap = await getDoc(doc(this.firestore, `participants/${participantId}`));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      clientId: data['clientId'] as string,
      projectId: data['projectId'] as string,
      creditReserved: data['creditReserved'] === true,
      creditConsumed: data['creditConsumed'] === true,
      orderId: data['orderId'] as string | undefined,
      type: data['type'] as string | undefined,
    };
  }

  /**
   * Estorna crédito reservado no documento do participante (avaliado).
   * Retorna true se houve estorno.
   */
  async refundParticipantReservedCredit(participantId: string): Promise<boolean> {
    const participantRef = doc(this.firestore, `participants/${participantId}`);

    return runTransaction(this.firestore, async (t) => {
      const snap = await t.get(participantRef);
      if (!snap.exists()) return false;

      const data = snap.data();
      if (data['creditReserved'] !== true || data['creditConsumed'] === true) {
        return false;
      }

      const clientId = data['clientId'] as string;
      const projectId = data['projectId'] as string;
      const orderId = data['orderId'] as string | undefined;
      if (!clientId) return false;

      const clientRef = doc(this.firestore, `clients/${clientId}`);
      t.update(clientRef, {
        credits: increment(1),
        reservedCredits: increment(-1),
      });

      if (orderId) {
        t.update(doc(this.firestore, `creditOrders/${orderId}`), {
          remainingCredits: increment(1),
        });
      }

      t.update(participantRef, { creditReserved: false });
      t.set(doc(collection(this.firestore, 'creditTransactions')), {
        type: 'refund',
        clientId,
        projectId,
        participantId,
        orderId: orderId ?? null,
        createdAt: Timestamp.now(),
      });

      return true;
    });
  }

  /**
   * Reserva crédito para participante existente que passa a ser avaliado.
   */
  async reserveCreditForExistingParticipant(
    participantId: string,
    clientId: string,
    projectId: string,
    patch: Record<string, unknown> = {}
  ): Promise<void> {
    const orderRef = await this.pickValidCreditOrder(clientId);
    const participantRef = doc(this.firestore, `participants/${participantId}`);
    const clientRef = doc(this.firestore, `clients/${clientId}`);
    const txRef = doc(collection(this.firestore, 'creditTransactions'));

    await runTransaction(this.firestore, async (t) => {
      const freshClient = await t.get(clientRef);
      const freshOrder = await t.get(orderRef);
      const freshParticipant = await t.get(participantRef);

      if (!freshParticipant.exists()) {
        throw new Error('Participante não encontrado.');
      }

      const clientCredits = freshClient.data()?.['credits'] ?? 0;
      const orderRemaining = freshOrder.data()?.['remainingCredits'] ?? 0;
      const orderValidity = freshOrder.data()?.['validityDate'] as Timestamp | undefined;

      if (clientCredits < 1 || orderRemaining < 1) {
        throw new Error('Créditos insuficientes para definir este participante como avaliado.');
      }
      if (orderValidity && orderValidity.toMillis() < Date.now()) {
        throw new Error('Créditos insuficientes para definir este participante como avaliado.');
      }

      t.update(participantRef, {
        ...patch,
        creditReserved: true,
        creditConsumed: false,
        orderId: orderRef.id,
        avaliadoId: deleteField(),
      });
      t.update(clientRef, {
        credits: increment(-1),
        reservedCredits: increment(1),
      });
      t.update(orderRef, { remainingCredits: increment(-1) });
      t.set(txRef, {
        type: 'reserve',
        clientId,
        projectId,
        participantId,
        orderId: orderRef.id,
        createdAt: Timestamp.now(),
      });
    });
  }

  /**
   * Cria participante avaliado já com reserva de crédito (import/cadastro).
   */
  async createEvaluateeWithCredit(
    participantData: Record<string, unknown>,
    clientId: string,
    projectId: string
  ): Promise<string> {
    const orderRef = await this.pickValidCreditOrder(clientId);
    const participantRef = doc(collection(this.firestore, 'participants'));
    const clientRef = doc(this.firestore, `clients/${clientId}`);
    const txRef = doc(collection(this.firestore, 'creditTransactions'));

    await runTransaction(this.firestore, async (t) => {
      const freshClient = await t.get(clientRef);
      const freshOrder = await t.get(orderRef);

      const clientCredits = freshClient.data()?.['credits'] ?? 0;
      const orderRemaining = freshOrder.data()?.['remainingCredits'] ?? 0;
      const orderValidity = freshOrder.data()?.['validityDate'] as Timestamp | undefined;

      if (clientCredits < 1 || orderRemaining < 1) {
        const err: Error & { code?: string } = new Error('Créditos insuficientes.');
        err.code = 'insufficient-credits';
        throw err;
      }
      if (orderValidity && orderValidity.toMillis() < Date.now()) {
        const err: Error & { code?: string } = new Error('Créditos insuficientes.');
        err.code = 'insufficient-credits';
        throw err;
      }

      t.set(participantRef, {
        ...participantData,
        creditReserved: true,
        creditConsumed: false,
        orderId: orderRef.id,
        createdAt: Timestamp.now(),
      });
      t.update(clientRef, {
        credits: increment(-1),
        reservedCredits: increment(1),
      });
      t.update(orderRef, { remainingCredits: increment(-1) });
      t.set(txRef, {
        type: 'reserve',
        clientId,
        projectId,
        participantId: participantRef.id,
        orderId: orderRef.id,
        createdAt: Timestamp.now(),
      });
    });

    return participantRef.id;
  }

  /**
   * Move crédito reservado → consumido no cliente ao marcar disparo do avaliado.
   */
  async consumeParticipantCreditOnDispatch(participantId: string): Promise<void> {
    const participantRef = doc(this.firestore, `participants/${participantId}`);

    await runTransaction(this.firestore, async (t) => {
      const snap = await t.get(participantRef);
      if (!snap.exists()) return;

      const data = snap.data();
      if (data['creditReserved'] !== true || data['creditConsumed'] === true) return;

      const clientId = data['clientId'] as string;
      if (!clientId) return;

      t.update(participantRef, { creditConsumed: true });
      t.update(doc(this.firestore, `clients/${clientId}`), {
        reservedCredits: increment(-1),
        consumedCredits: increment(1),
      });
      t.set(doc(collection(this.firestore, 'creditTransactions')), {
        type: 'consume',
        clientId,
        projectId: data['projectId'] ?? null,
        participantId,
        orderId: data['orderId'] ?? null,
        createdAt: Timestamp.now(),
      });
    });
  }

  /**
   * Estorna créditos de links legados (assessmentLinks.creditReserved).
   */
  async refundLegacyLinkCredits(
    linkDocs: Array<{ ref: unknown; data: () => Record<string, unknown> }>,
    clientId: string
  ): Promise<number> {
    let count = 0;
    for (const linkDoc of linkDocs) {
      const d = linkDoc.data();
      if (d['creditReserved'] !== true || d['status'] === 'completed' || d['status'] === 'cancelled') {
        continue;
      }
      count++;
    }
    if (count === 0 || !clientId) return 0;

    await runTransaction(this.firestore, async (t) => {
      const clientRef = doc(this.firestore, `clients/${clientId}`);
      const snap = await t.get(clientRef);
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, number>;
      t.update(clientRef, {
        credits: (data['credits'] || 0) + count,
        reservedCredits: Math.max(0, (data['reservedCredits'] || 0) - count),
      });
    });

    return count;
  }

  private async pickValidCreditOrder(clientId: string) {
    const orderSnap = await getDocs(
      query(
        collection(this.firestore, 'creditOrders'),
        where('clientId', '==', clientId),
        where('status', '==', 'Aprovado')
      )
    );

    const nowMs = Date.now();
    const validOrders = orderSnap.docs
      .filter((d) => {
        const data = d.data();
        const validity = data['validityDate'] as Timestamp | undefined;
        const remaining = (data['remainingCredits'] as number) ?? 0;
        return remaining > 0 && (!validity || validity.toMillis() >= nowMs);
      })
      .sort((a, b) => {
        const aMs = (a.data()['createdAt'] as Timestamp)?.toMillis() ?? 0;
        const bMs = (b.data()['createdAt'] as Timestamp)?.toMillis() ?? 0;
        return aMs - bMs;
      });

    if (validOrders.length === 0) {
      const err: Error & { code?: string } = new Error('Créditos insuficientes.');
      err.code = 'insufficient-credits';
      throw err;
    }

    return validOrders[0].ref;
  }
}
