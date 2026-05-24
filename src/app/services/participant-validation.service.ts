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
   * Valida se um array de participantes do Excel contém apenas um avaliado por projeto.
   * Retorna erro se houver mais de um avaliado para o mesmo projeto.
   * 
   * @param participants - Array de participantes do Excel
   */
  validateExcelParticipants(participants: Array<{ projectId: string; category: string; name: string }>): {
    valid: boolean;
    errors: Array<{ projectId: string; projectName?: string; evaluateesCount: number }>;
  } {
    const projectEvaluateesMap = new Map<string, { count: number; names: string[] }>();
    const errors: Array<{ projectId: string; projectName?: string; evaluateesCount: number }> = [];

    for (const participant of participants) {
      if (participant.category === 'Avaliado') {
        const existing = projectEvaluateesMap.get(participant.projectId);
        if (existing) {
          existing.count++;
          existing.names.push(participant.name);
        } else {
          projectEvaluateesMap.set(participant.projectId, { count: 1, names: [participant.name] });
        }
      }
    }

    for (const [projectId, data] of projectEvaluateesMap.entries()) {
      if (data.count > 1) {
        errors.push({
          projectId,
          evaluateesCount: data.count
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
