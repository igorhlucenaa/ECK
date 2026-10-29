import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';

/** Normaliza nome para comparação (trim, espaços, case-insensitive pt-BR). */
export function normalizeUserGroupNameForComparison(name: string): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

/**
 * Retorna um grupo existente no mesmo cliente com o mesmo nome (ignorando excludeGroupId na edição).
 */
export async function findUserGroupWithSameNameForClient(
  firestore: Firestore,
  clientId: string,
  name: string,
  excludeGroupId?: string
): Promise<{ id: string } | null> {
  const trimmedClientId = (clientId ?? '').trim();
  const normalized = normalizeUserGroupNameForComparison(name);
  if (!trimmedClientId || !normalized) {
    return null;
  }

  const snap = await getDocs(
    query(
      collection(firestore, 'userGroups'),
      where('clientId', '==', trimmedClientId)
    )
  );

  for (const docSnap of snap.docs) {
    if (excludeGroupId && docSnap.id === excludeGroupId) {
      continue;
    }
    const existingName = docSnap.data()['name'] as string | undefined;
    if (normalizeUserGroupNameForComparison(existingName ?? '') === normalized) {
      return { id: docSnap.id };
    }
  }

  return null;
}
