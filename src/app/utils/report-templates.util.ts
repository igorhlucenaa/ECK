import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';

export type ReportTemplateScope = 'client' | 'global' | 'other';

export interface ReportTemplateListItem {
  id: string;
  name: string;
  clientId?: string | null;
  scope: ReportTemplateScope;
  /** Nome do cliente quando scope !== 'client' (ex.: biblioteca admin). */
  clientLabel?: string;
}

export function isGlobalReportTemplate(data: Record<string, unknown>): boolean {
  const cid = data['clientId'];
  return cid === undefined || cid === null || cid === '';
}

export function reportTemplateDisplayName(data: Record<string, unknown>): string {
  return String(data['nome'] || data['name'] || 'Sem nome');
}

function mapDoc(
  id: string,
  data: Record<string, unknown>,
  clientId: string,
  clientNames?: Map<string, string>
): ReportTemplateListItem {
  const name = reportTemplateDisplayName(data);
  if (isGlobalReportTemplate(data)) {
    return { id, name, clientId: null, scope: 'global' };
  }
  const docClientId = String(data['clientId'] || '');
  if (docClientId === clientId) {
    return { id, name, clientId: docClientId, scope: 'client' };
  }
  const clientLabel = clientNames?.get(docClientId) || docClientId;
  return { id, name, clientId: docClientId, scope: 'other', clientLabel };
}

/** Templates do cliente + globais (sem clientId). Opcional: todos os clientes (admin). */
export async function fetchReportTemplatesForClientScope(
  firestore: Firestore,
  clientId: string,
  options?: { includeAllClients?: boolean; clientNames?: Map<string, string> }
): Promise<ReportTemplateListItem[]> {
  if (!clientId && !options?.includeAllClients) {
    return [];
  }

  const coll = collection(firestore, 'reportTemplates');
  const byId = new Map<string, ReportTemplateListItem>();

  if (options?.includeAllClients) {
    const snap = await getDocs(coll);
    snap.docs.forEach((d) => {
      const item = mapDoc(d.id, d.data() as Record<string, unknown>, clientId, options.clientNames);
      byId.set(d.id, item);
    });
  } else {
    const [byClientSnap, allSnap] = await Promise.all([
      getDocs(query(coll, where('clientId', '==', clientId))),
      getDocs(coll),
    ]);
    byClientSnap.docs.forEach((d) => {
      byId.set(d.id, mapDoc(d.id, d.data() as Record<string, unknown>, clientId));
    });
    allSnap.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      if (!isGlobalReportTemplate(data)) {
        return;
      }
      if (!byId.has(d.id)) {
        byId.set(d.id, mapDoc(d.id, data, clientId));
      }
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Garante que um template vinculado (outro cliente/global) apareça na lista. */
export async function ensureReportTemplateInList(
  firestore: Firestore,
  list: ReportTemplateListItem[],
  templateId: string | undefined,
  clientId: string
): Promise<ReportTemplateListItem[]> {
  if (!templateId || list.some((t) => t.id === templateId)) {
    return list;
  }
  try {
    const templateDoc = await getDoc(doc(firestore, 'reportTemplates', templateId));
    if (!templateDoc.exists()) {
      return list;
    }
    const item = mapDoc(templateDoc.id, templateDoc.data() as Record<string, unknown>, clientId);
    return [...list, item].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } catch {
    return list;
  }
}

export function formatReportTemplateOptionLabel(
  item: ReportTemplateListItem,
  labels: { global: string; otherClientPrefix: string }
): string {
  if (item.scope === 'global') {
    return `${item.name} (${labels.global})`;
  }
  if (item.scope === 'other' && item.clientLabel) {
    return `${item.name} (${labels.otherClientPrefix}: ${item.clientLabel})`;
  }
  return item.name;
}
