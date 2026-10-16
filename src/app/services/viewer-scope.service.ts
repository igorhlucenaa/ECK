import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { AuthService } from './apps/authentication/auth.service';

const FIRESTORE_IN_LIMIT = 10;
const CLIENT_ID_IN_LIMIT = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    parts.push(items.slice(i, i + size));
  }
  return parts;
}

interface ViewerScope {
  projectIds: Set<string>;
  clientIds: Set<string>;
}

@Injectable({
  providedIn: 'root',
})
export class ViewerScopeService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  /** Projetos acessíveis ao viewer (userGroups + fallback legado em users). */
  async getViewerProjectIds(email?: string): Promise<string[]> {
    const scope = await this.resolveViewerScope(email);
    return [...scope.projectIds];
  }

  /** Clientes derivados do doc do usuário + grupos + projetos do escopo. */
  async getViewerClientIds(): Promise<string[]> {
    const fromUser = await this.authService.getCurrentUserClientIds();
    const scope = await this.resolveViewerScope();
    const ids = new Set<string>(fromUser);
    scope.clientIds.forEach((id) => ids.add(id));
    await this.addClientIdsFromProjects(ids, scope.projectIds);
    return [...ids];
  }

  /** admin_client: só clients do usuário; viewer: inclui escopo por grupos/projetos. */
  async getScopedClientIdsForRole(role: string): Promise<string[]> {
    const fromUser = await this.authService.getCurrentUserClientIds();
    if (role !== 'viewer') {
      return fromUser;
    }
    return this.getViewerClientIds();
  }

  private async resolveViewerScope(emailOverride?: string): Promise<ViewerScope> {
    const projectIds = new Set<string>();
    const clientIds = new Set<string>();

    const email =
      emailOverride ?? (await this.authService.getCurrentUserEmail());
    if (!email) {
      return { projectIds, clientIds };
    }

    const usersSnap = await getDocs(
      query(collection(this.firestore, 'users'), where('email', '==', email))
    );
    if (usersSnap.empty) {
      return { projectIds, clientIds };
    }

    const userDocId = usersSnap.docs[0].id;
    const userData = usersSnap.docs[0].data() || {};
    const isOnNewStructure = 'groups' in userData;

    const groupsSnap = await getDocs(
      query(
        collection(this.firestore, 'userGroups'),
        where('userIds', 'array-contains', userDocId)
      )
    );

    const allProjectsClientIds = new Set<string>();
    groupsSnap.forEach((snap) => {
      const data = snap.data();
      if (data['allProjects'] === true && data['clientId']) {
        allProjectsClientIds.add(data['clientId']);
        clientIds.add(data['clientId']);
      } else {
        const ids: string[] = data['projectIds'] || [];
        ids.forEach((id) => projectIds.add(id));
      }
    });

    if (allProjectsClientIds.size > 0) {
      for (const clientChunk of chunk(
        [...allProjectsClientIds],
        CLIENT_ID_IN_LIMIT
      )) {
        const projSnap = await getDocs(
          query(
            collection(this.firestore, 'projects'),
            where('clientId', 'in', clientChunk)
          )
        );
        projSnap.forEach((d) => projectIds.add(d.id));
      }
    }

    if (!isOnNewStructure && projectIds.size === 0) {
      const fromArray = Array.isArray(userData['projects'])
        ? userData['projects']
        : [];
      const fromSingle =
        typeof userData['project'] === 'string' && userData['project'].trim()
          ? [userData['project']]
          : [];
      [...fromArray, ...fromSingle].forEach((id: string) =>
        projectIds.add(id)
      );
    }

    return { projectIds, clientIds };
  }

  private async addClientIdsFromProjects(
    target: Set<string>,
    projectIds: Set<string>
  ): Promise<void> {
    const ids = [...projectIds];
    if (ids.length === 0) {
      return;
    }
    for (const part of chunk(ids, FIRESTORE_IN_LIMIT)) {
      const snap = await getDocs(
        query(
          collection(this.firestore, 'projects'),
          where('__name__', 'in', part)
        )
      );
      snap.forEach((d) => {
        const cid = d.data()['clientId'];
        if (typeof cid === 'string' && cid) {
          target.add(cid);
        }
      });
    }
  }
}
