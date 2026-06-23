import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';

/** Um vínculo (filho) que impede a exclusão de um registro pai. */
export interface DependencyLink {
  /** Coleção Firestore do filho. */
  collection: string;
  /** Rótulo amigável exibido ao usuário (ex.: "Projetos"). */
  label: string;
  /** Quantidade de filhos encontrados. */
  count: number;
  /** Rota Angular para gerenciar/apagar os filhos (opcional). */
  route?: string;
  /** Query params para a rota (opcional). */
  queryParams?: Record<string, string>;
  /** Instrução de navegação (ex.: "Projetos > selecione o projeto > apague"). */
  hint?: string;
}

/** Resultado da verificação de dependências. */
export interface DependencyResult {
  /** True quando não há vínculos e a exclusão pode prosseguir. */
  canDelete: boolean;
  /** Rótulo do registro pai (ex.: cliente "Lojas NC"). */
  entityLabel: string;
  /** Lista de vínculos encontrados (vazia quando canDelete = true). */
  blockers: DependencyLink[];
  /** Avisos não-bloqueantes (ex.: estorno de crédito ao excluir). */
  warnings?: string[];
}

@Injectable({ providedIn: 'root' })
export class DependencyCheckService {
  constructor(private firestore: Firestore) {}

  /** Conta documentos de uma coleção onde campo == valor. */
  private async countWhere(
    collectionName: string,
    field: string,
    value: string
  ): Promise<number> {
    try {
      const snap = await getDocs(
        query(collection(this.firestore, collectionName), where(field, '==', value))
      );
      return snap.size;
    } catch {
      return 0;
    }
  }

  /** Conta documentos onde campo (array) contém valor. */
  private async countArrayContains(
    collectionName: string,
    field: string,
    value: string
  ): Promise<number> {
    try {
      const snap = await getDocs(
        query(collection(this.firestore, collectionName), where(field, 'array-contains', value))
      );
      return snap.size;
    } catch {
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CLIENTE — bloqueia se houver qualquer entidade vinculada
  // ─────────────────────────────────────────────────────────────
  async checkClient(clientId: string, clientName: string): Promise<DependencyResult> {
    const [
      projects, userGroups, participants, assessments,
      creditOrders, competencies, competencyGroups, mailTemplates,
      savedReports, reportTemplates, releasedReports,
      usersLegacy, usersArray,
    ] = await Promise.all([
      this.countWhere('projects', 'clientId', clientId),
      this.countWhere('userGroups', 'clientId', clientId),
      this.countWhere('participants', 'clientId', clientId),
      this.countWhere('assessments', 'clientId', clientId),
      this.countWhere('creditOrders', 'clientId', clientId),
      this.countWhere('competencies', 'clientId', clientId),
      this.countWhere('competencyGroups', 'clientId', clientId),
      this.countWhere('mailTemplates', 'clientId', clientId),
      this.countWhere('reports', 'clientId', clientId),
      this.countWhere('reportTemplates', 'clientId', clientId),
      this.countWhere('releasedReports', 'clientId', clientId),
      this.countWhere('users', 'client', clientId),
      this.countArrayContains('users', 'clients', clientId),
    ]);

    const usersTotal = usersLegacy + usersArray;
    const blockers: DependencyLink[] = [];
    const add = (count: number, collectionName: string, label: string, route?: string, hint?: string) => {
      if (count > 0) blockers.push({ collection: collectionName, label, count, route, hint });
    };

    add(projects, 'projects', 'Projetos', '/projects', 'Projetos > selecione e apague cada projeto');
    add(assessments, 'assessments', 'Formulários', '/assessments', 'Formulários > apague os formulários do cliente');
    add(participants, 'participants', 'Participantes', '/assessments/participants', 'Participantes > selecione e apague');
    add(userGroups, 'userGroups', 'Grupos de usuários', '/users', 'Usuários e Grupos > aba Grupos > apague');
    add(usersTotal, 'users', 'Usuários', '/users', 'Usuários e Grupos > apague ou desvincule os usuários');
    add(competencies, 'competencies', 'Competências', '/competencies', 'Gerenciar Competências > apague');
    add(competencyGroups, 'competencyGroups', 'Grupos de competências', '/competencies', 'Gerenciar Competências > apague os grupos');
    add(mailTemplates, 'mailTemplates', 'Modelos de e-mail', '/mail-templates', 'Modelos de E-mail > apague');
    add(savedReports, 'reports', 'Relatórios salvos', '/reports', 'Relatórios > apague os relatórios do cliente');
    add(reportTemplates, 'reportTemplates', 'Templates de relatório', '/reports', 'Relatórios > apague os templates do cliente');
    add(releasedReports, 'releasedReports', 'Relatórios publicados', '/reports', 'Relatórios > despublique os relatórios');
    add(creditOrders, 'creditOrders', 'Pedidos de crédito', '/orders', 'Pedidos de Crédito > apague os pedidos');

    return { canDelete: blockers.length === 0, entityLabel: `o cliente "${clientName}"`, blockers };
  }

  // ─────────────────────────────────────────────────────────────
  // PROJETO — bloqueia se houver participantes/formulários/links/snapshots
  // ─────────────────────────────────────────────────────────────
  async checkProject(projectId: string, projectName: string): Promise<DependencyResult> {
    const [participants, assessments, links, mailTemplates, groups] = await Promise.all([
      this.countWhere('participants', 'projectId', projectId),
      this.countWhere('assessments', 'projectId', projectId),
      this.countWhere('assessmentLinks', 'projectId', projectId),
      this.countWhere('mailTemplates', 'projectId', projectId),
      this.countArrayContains('userGroups', 'projectIds', projectId),
    ]);

    const blockers: DependencyLink[] = [];
    const add = (count: number, collectionName: string, label: string, route?: string, queryParams?: Record<string, string>, hint?: string) => {
      if (count > 0) blockers.push({ collection: collectionName, label, count, route, queryParams, hint });
    };

    add(participants, 'participants', 'Participantes', '/assessments/participants', undefined, 'Participantes > selecione o projeto > apague os participantes');
    add(assessments, 'assessments', 'Formulários', '/assessments', undefined, 'Formulários > apague o formulário deste projeto');
    add(links, 'assessmentLinks', 'Convites de avaliação enviados', undefined, undefined, 'Cancele/expire os envios pendentes nos Participantes');
    add(mailTemplates, 'mailTemplates', 'Modelos de e-mail', '/mail-templates', undefined, 'Modelos de E-mail > apague');
    add(groups, 'userGroups', 'Grupos vinculados', '/users', undefined, 'Usuários e Grupos > remova o projeto do grupo');

    return { canDelete: blockers.length === 0, entityLabel: `o projeto "${projectName}"`, blockers };
  }

  // ─────────────────────────────────────────────────────────────
  // FORMULÁRIO (assessment) — bloqueia se houver respostas/links/snapshots
  // ─────────────────────────────────────────────────────────────
  async checkAssessment(assessmentId: string, assessmentName: string): Promise<DependencyResult> {
    const [links, snapshots, results] = await Promise.all([
      this.countWhere('assessmentLinks', 'assessmentId', assessmentId),
      this.countWhere('releasedReports', 'assessmentId', assessmentId),
      this.countResultsSubcollection(assessmentId),
    ]);

    const blockers: DependencyLink[] = [];
    const add = (count: number, collectionName: string, label: string, route?: string, hint?: string) => {
      if (count > 0) blockers.push({ collection: collectionName, label, count, route, hint });
    };

    add(results, 'results', 'Respostas registradas', '/assessments/participants', 'As respostas serão perdidas — remova os participantes antes');
    add(links, 'assessmentLinks', 'Convites enviados', undefined, 'Cancele os envios pendentes');
    add(snapshots, 'releasedReports', 'Relatórios publicados', '/reports', 'Relatórios > despublique antes');

    return { canDelete: blockers.length === 0, entityLabel: `o formulário "${assessmentName}"`, blockers };
  }

  private async countResultsSubcollection(assessmentId: string): Promise<number> {
    try {
      const snap = await getDocs(collection(this.firestore, `assessments/${assessmentId}/results`));
      return snap.size;
    } catch {
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PARTICIPANTE — bloqueia avaliado com avaliadores; avisa estorno de crédito
  // ─────────────────────────────────────────────────────────────
  async checkParticipant(
    participantId: string,
    participantName: string,
    creditReserved: boolean,
    creditConsumed: boolean
  ): Promise<DependencyResult> {
    const [avaliadores, links] = await Promise.all([
      this.countWhere('participants', 'avaliadoId', participantId),
      this.countWhere('assessmentLinks', 'participantId', participantId),
    ]);

    const blockers: DependencyLink[] = [];
    if (avaliadores > 0) {
      blockers.push({
        collection: 'participants', label: 'Avaliadores vinculados', count: avaliadores,
        route: '/assessments/participants', hint: 'Remova os avaliadores vinculados a este avaliado primeiro',
      });
    }

    const warnings: string[] = [];
    if (creditReserved && !creditConsumed) {
      warnings.push('Este avaliado possui 1 crédito reservado que será estornado ao cliente.');
    }
    if (links > 0) {
      warnings.push(`${links} convite(s) de avaliação serão removidos junto.`);
    }

    return {
      canDelete: blockers.length === 0,
      entityLabel: `o participante "${participantName}"`,
      blockers,
      warnings,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PEDIDO DE CRÉDITO — bloqueia se houver participantes usando o crédito
  // ─────────────────────────────────────────────────────────────
  async checkCreditOrder(orderId: string): Promise<DependencyResult> {
    const used = await this.countWhere('participants', 'orderId', orderId);
    const blockers: DependencyLink[] = [];
    if (used > 0) {
      blockers.push({
        collection: 'participants', label: 'Participantes que consumiram este crédito', count: used,
        route: '/assessments/participants', hint: 'Não é possível excluir um pedido com créditos já reservados/consumidos',
      });
    }
    return { canDelete: blockers.length === 0, entityLabel: 'este pedido de crédito', blockers };
  }
}
