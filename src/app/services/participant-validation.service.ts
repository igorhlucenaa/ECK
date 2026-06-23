import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

export interface EvaluateeConflict {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class ParticipantValidationService {
  constructor(private firestore: Firestore) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  isValidEmailFormat(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /**
   * Busca avaliados do projeto por category OU type (cobre registros legados dessincronizados).
   */
  async findProjectEvaluatees(
    projectId: string,
    excludeParticipantId?: string
  ): Promise<EvaluateeConflict[]> {
    const participantsRef = collection(this.firestore, 'participants');
    const [byCategorySnap, byTypeSnap] = await Promise.all([
      getDocs(
        query(
          participantsRef,
          where('projectId', '==', projectId),
          where('category', '==', 'Avaliado')
        )
      ),
      getDocs(
        query(
          participantsRef,
          where('projectId', '==', projectId),
          where('type', '==', 'avaliado')
        )
      ),
    ]);

    const merged = new Map<string, EvaluateeConflict>();
    for (const docSnap of [...byCategorySnap.docs, ...byTypeSnap.docs]) {
      if (excludeParticipantId && docSnap.id === excludeParticipantId) continue;
      if (!merged.has(docSnap.id)) {
        merged.set(docSnap.id, {
          id: docSnap.id,
          name: (docSnap.data()['name'] as string) || 'Avaliado existente',
        });
      }
    }
    return [...merged.values()];
  }

  /**
   * Valida se já existe um avaliado cadastrado no projeto.
   */
  async validateSingleEvaluateePerProject(
    projectId: string,
    category: string,
    excludeParticipantId?: string
  ): Promise<{ valid: boolean; existingEvaluateeName?: string }> {
    if (category !== 'Avaliado') {
      return { valid: true };
    }

    try {
      const conflicts = await this.findProjectEvaluatees(projectId, excludeParticipantId);
      if (conflicts.length > 0) {
        return { valid: false, existingEvaluateeName: conflicts[0].name };
      }
      return { valid: true };
    } catch (error) {
      console.error('Erro ao validar avaliado único por projeto:', error);
      return {
        valid: false,
        existingEvaluateeName: undefined,
      };
    }
  }

  /**
   * Verifica se existe avaliado no projeto (category ou type).
   */
  async validateAvaliadoExistsForProject(
    projectId: string,
    projectName: string
  ): Promise<{ valid: boolean; error?: string; avaliadoId?: string; avaliadoName?: string }> {
    try {
      const evaluatees = await this.findProjectEvaluatees(projectId);
      if (evaluatees.length === 0) {
        return {
          valid: false,
          error: `Não é possível cadastrar avaliadores antes de definir o avaliado do projeto. Cadastre primeiro o avaliado em '${projectName}'.`,
        };
      }

      const first = evaluatees[0];
      return {
        valid: true,
        avaliadoId: first.id,
        avaliadoName: first.name,
      };
    } catch (error) {
      console.error('Erro ao validar existência de avaliado no projeto:', error);
      return {
        valid: false,
        error: 'Não foi possível validar o avaliado do projeto. Tente novamente.',
      };
    }
  }

  /**
   * Valida e-mail único no projeto (case-insensitive via emailLower).
   */
  async validateEmailUniqueInProject(
    projectId: string,
    email: string,
    excludeParticipantId?: string
  ): Promise<{ valid: boolean; error?: string }> {
    if (!this.isValidEmailFormat(email)) {
      return { valid: false, error: 'E-mail inválido.' };
    }

    try {
      const emailLower = this.normalizeEmail(email);
      const snap = await getDocs(
        query(
          collection(this.firestore, 'participants'),
          where('projectId', '==', projectId),
          where('emailLower', '==', emailLower)
        )
      );

      const duplicate = snap.docs.find((d) => d.id !== excludeParticipantId);
      if (duplicate) {
        return { valid: false, error: 'Este e-mail já está cadastrado neste projeto.' };
      }

      // Fallback legado: participantes sem emailLower
      if (snap.empty) {
        const allSnap = await getDocs(
          query(collection(this.firestore, 'participants'), where('projectId', '==', projectId))
        );
        const legacyDup = allSnap.docs.find((d) => {
          if (d.id === excludeParticipantId) return false;
          const stored = ((d.data()['email'] as string) || '').trim().toLowerCase();
          return stored === emailLower;
        });
        if (legacyDup) {
          return { valid: false, error: 'Este e-mail já está cadastrado neste projeto.' };
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('Erro ao validar e-mail único no projeto:', error);
      return { valid: false, error: 'Não foi possível validar o e-mail. Tente novamente.' };
    }
  }

  /**
   * Retorna o ID do avaliado do projeto (prioriza category, fallback type).
   */
  async getProjectEvaluateeId(projectId: string): Promise<string | null> {
    try {
      const evaluatees = await this.findProjectEvaluatees(projectId);
      return evaluatees.length > 0 ? evaluatees[0].id : null;
    } catch {
      return null;
    }
  }

  /**
   * Valida lote Excel + avaliado existente no Firestore quando necessário.
   */
  async validateExcelParticipants(
    participants: Array<{ projectId?: string; category: string; name: string }>,
    projectId?: string,
    projectName?: string
  ): Promise<{
    valid: boolean;
    errors: Array<{ projectId: string; projectName?: string; evaluateesCount: number }>;
    error?: string;
  }> {
    const projectEvaluateesMap = new Map<string, { count: number; names: string[] }>();
    const errors: Array<{ projectId: string; projectName?: string; evaluateesCount: number }> = [];

    for (const participant of participants) {
      if (participant.category === 'Avaliado') {
        const pid = participant.projectId || projectId || '';
        const existing = projectEvaluateesMap.get(pid);
        if (existing) {
          existing.count++;
          existing.names.push(participant.name);
        } else {
          projectEvaluateesMap.set(pid, { count: 1, names: [participant.name] });
        }
      }
    }

    for (const [pid, data] of projectEvaluateesMap.entries()) {
      if (data.count > 1) {
        errors.push({ projectId: pid, evaluateesCount: data.count });
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const targetProjectId = projectId || [...projectEvaluateesMap.keys()][0];
    if (!targetProjectId) {
      return { valid: true, errors: [] };
    }

    const fileEvaluateeCount = projectEvaluateesMap.get(targetProjectId)?.count ?? 0;
    if (fileEvaluateeCount > 0) {
      const existing = await this.findProjectEvaluatees(targetProjectId);
      if (existing.length > 0) {
        return {
          valid: false,
          errors: [],
          error: `O projeto "${projectName || 'projeto'}" já possui um avaliado cadastrado (${existing[0].name}). É permitido apenas um avaliado por projeto.`,
        };
      }
    }

    if (fileEvaluateeCount === 0) {
      const existsCheck = await this.validateAvaliadoExistsForProject(
        targetProjectId,
        projectName || 'projeto'
      );
      if (!existsCheck.valid) {
        return { valid: false, errors: [], error: existsCheck.error };
      }
    }

    return { valid: true, errors: [] };
  }

  buildParticipantWriteFields(
    name: string,
    email: string,
    extra: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const emailLower = this.normalizeEmail(email);
    return {
      ...extra,
      name: name.trim(),
      email: email.trim(),
      emailLower,
    };
  }

  syncTypeWithCategory(category: string): 'avaliado' | 'avaliador' {
    return category === 'Avaliado' ? 'avaliado' : 'avaliador';
  }
}
