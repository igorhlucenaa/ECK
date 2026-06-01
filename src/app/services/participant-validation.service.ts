import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ParticipantValidationService {
  constructor(private firestore: Firestore) {}

  /**
   * Valida se já existe um avaliado cadastrado no projeto.
   * Retorna true se for válido (pode adicionar), false se já existir avaliado.
   * 
   * @param projectId - ID do projeto
   * @param category - Categoria do participante sendo adicionado
   * @param excludeParticipantId - ID do participante a excluir da verificação (útil para edição)
   */
  async validateSingleEvaluateePerProject(
    projectId: string,
    category: string,
    excludeParticipantId?: string
  ): Promise<{ valid: boolean; existingEvaluateeName?: string }> {
    // Se não for avaliado, não precisa validar
    if (category !== 'Avaliado') {
      return { valid: true };
    }

    try {
      const participantsRef = collection(this.firestore, 'participants');
      const q = query(
        participantsRef,
        where('projectId', '==', projectId),
        where('category', '==', 'Avaliado')
      );

      const querySnapshot = await getDocs(q);

      // Se houver participantes com categoria 'Avaliado'
      if (!querySnapshot.empty) {
        // Se estamos editando um participante, verificar se é o mesmo
        if (excludeParticipantId) {
          const existingDocs = querySnapshot.docs.filter(doc => doc.id !== excludeParticipantId);
          if (existingDocs.length > 0) {
            const existingDoc = existingDocs[0];
            return {
              valid: false,
              existingEvaluateeName: existingDoc.data()['name'] || 'Avaliado existente'
            };
          }
        } else {
          // Cadastro novo - se já existe algum avaliado, bloquear
          const existingDoc = querySnapshot.docs[0];
          return {
            valid: false,
            existingEvaluateeName: existingDoc.data()['name'] || 'Avaliado existente'
          };
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('Erro ao validar avaliado único por projeto:', error);
      // Em caso de erro, permite a operação para não bloquear por falha técnica
      return { valid: true };
    }
  }

  /**
   * Verifica se existe pelo menos um participante com type='avaliado' no projeto.
   * Usado para bloquear cadastro de avaliadores em projetos sem avaliado definido.
   */
  async validateAvaliadoExistsForProject(
    projectId: string,
    projectName: string
  ): Promise<{ valid: boolean; error?: string; avaliadoId?: string; avaliadoName?: string }> {
    try {
      const participantsRef = collection(this.firestore, 'participants');
      const q = query(
        participantsRef,
        where('projectId', '==', projectId),
        where('type', '==', 'avaliado')
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        return {
          valid: false,
          error: `Não é possível cadastrar avaliadores antes de definir o avaliado do projeto. Cadastre primeiro o avaliado em '${projectName}'.`
        };
      }

      const first = snap.docs[0];
      return {
        valid: true,
        avaliadoId: first.id,
        avaliadoName: (first.data()['name'] as string) || ''
      };
    } catch (error) {
      console.error('Erro ao validar existência de avaliado no projeto:', error);
      // Em caso de erro técnico, não bloqueia (defesa server-side cobre).
      return { valid: true };
    }
  }

  /**
   * Valida um lote do Excel para um projeto específico.
   * - Garante no máximo 1 avaliado por projeto no arquivo.
   * - Se o arquivo NÃO contém avaliado, verifica no Firestore se já existe um
   *   avaliado cadastrado no projeto; se não houver, bloqueia o import.
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

    // Se o arquivo não contém avaliado e o projeto foi informado,
    // exigir que já exista um avaliado cadastrado no Firestore.
    const fileHasAvaliado = projectEvaluateesMap.size > 0;
    if (!fileHasAvaliado && projectId) {
      const existsCheck = await this.validateAvaliadoExistsForProject(
        projectId,
        projectName || 'projeto'
      );
      if (!existsCheck.valid) {
        return { valid: false, errors: [], error: existsCheck.error };
      }
    }

    return { valid: true, errors: [] };
  }
}
