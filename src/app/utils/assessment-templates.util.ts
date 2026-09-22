import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';

export interface AssessmentOptionScope {
  id: string;
  name: string;
  isGlobalTemplate?: boolean;
  clientId?: string | null;
}

export function isGlobalAssessmentTemplate(data: Record<string, unknown>): boolean {
  return data['isGlobalTemplate'] === true;
}

/** Formulários do cliente + templates globais (reutilizáveis entre clientes). */
export async function fetchAssessmentsForClientScope(
  firestore: Firestore,
  clientId: string
): Promise<AssessmentOptionScope[]> {
  if (!clientId) {
    return [];
  }
  const coll = collection(firestore, 'assessments');
  const [clientSnap, globalSnap] = await Promise.all([
    getDocs(query(coll, where('clientId', '==', clientId))),
    getDocs(query(coll, where('isGlobalTemplate', '==', true))),
  ]);

  const byId = new Map<string, AssessmentOptionScope>();
  for (const d of clientSnap.docs) {
    const data = d.data();
    byId.set(d.id, {
      id: d.id,
      name: data['name'] || d.id,
      isGlobalTemplate: false,
      clientId: data['clientId'] ?? clientId,
    });
  }
  for (const d of globalSnap.docs) {
    if (byId.has(d.id)) {
      continue;
    }
    const data = d.data();
    byId.set(d.id, {
      id: d.id,
      name: data['name'] || d.id,
      isGlobalTemplate: true,
      clientId: null,
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
