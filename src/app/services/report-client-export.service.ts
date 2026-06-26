import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import {
  isParticipantIncludedInReports,
  extractSurveyQuestions,
  resolveExportAnswer,
  getExportAnswerTipoResposta,
  normalizeQuestionType,
  parseLikertAnswerForExport,
  resolveSurveyAnswer,
} from '../pages/reports/reports-utils';

export interface ClientExportProjectOption {
  id: string;
  name: string;
  assessmentId: string;
  assessmentName: string;
  status: string;
}

export interface ClientExportRequest {
  clientId: string;
  clientName: string;
  projectIds: string[];
  /** Se informado, exporta apenas estes avaliados (nome exibido). */
  avaliadoNames?: string[];
  /** Restringe a participantes com reportStatus === 'released'. */
  releasedOnly?: boolean;
}

export interface ResumoExportRow {
  Cliente: string;
  Projeto: string;
  Avaliação: string;
  Avaliado: string;
  Competência: string;
  'Média geral': number | string;
  'Média s/ auto': number | string;
  'Média Avaliado(a)': number | string;
  'Média Gestor(es)': number | string;
  'Média Pares': number | string;
  'Média Subordinados': number | string;
  'Média Outros': number | string;
  'Qtd. respondentes': number;
}

export interface RespostaExportRow {
  Cliente: string;
  Projeto: string;
  Avaliação: string;
  AssessmentId: string;
  Data: string;
  Horário: string;
  Categoria: string;
  Avaliado: string;
  Cargo: string;
  'Área/Setor': string;
  Competência: string;
  PerguntaId: string;
  Pergunta: string;
  TipoResposta: 'Aberta' | 'Escala' | 'Sem resposta numérica';
  Resposta: number | string;
}

interface CompetenciaExport {
  id: string;
  nome: string;
  perguntasIds: string[];
}

interface QuestionExport {
  id: string;
  type: string;
  title: string;
}

interface DataRow {
  categoria: string;
  avaliado: string;
  avaliadoId: string;
  tipo: string;
  dataAvaliacao: string;
  horarioAvaliacao: string;
  cargo: string;
  setor: string;
  participanteId: string;
  reportStatus: string;
  [questionId: string]: unknown;
}

const GRUPOS_PADRAO = ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'];

@Injectable({ providedIn: 'root' })
export class ReportClientExportService {
  constructor(private firestore: Firestore) {}

  async loadProjectsForClient(
    clientId: string,
    includeInactive = false
  ): Promise<ClientExportProjectOption[]> {
    const projectsSnap = await getDocs(
      query(collection(this.firestore, 'projects'), where('clientId', '==', clientId))
    );

    const inactive = new Set(['Cancelado', 'Inativo']);
    const projects: ClientExportProjectOption[] = [];

    for (const projectDoc of projectsSnap.docs) {
      const data = projectDoc.data();
      const status = data['status'] || '';
      if (!includeInactive && inactive.has(status)) continue;

      const assessmentId = data['assessmentId'] as string | undefined;
      if (!assessmentId) continue;

      let assessmentName = assessmentId;
      try {
        const assessmentSnap = await getDoc(doc(this.firestore, 'assessments', assessmentId));
        if (assessmentSnap.exists()) {
          const ad = assessmentSnap.data();
          assessmentName = ad['name'] || ad['surveyJSON']?.['title'] || assessmentId;
        }
      } catch {
        /* mantém fallback */
      }

      projects.push({
        id: projectDoc.id,
        name: data['name'] || '—',
        assessmentId,
        assessmentName,
        status,
      });
    }

    return projects.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async exportClientExtract(
    request: ClientExportRequest,
    onProgress?: (message: string) => void
  ): Promise<{ resumoCount: number; respostasCount: number; fileName: string }> {
    const resumoRows: ResumoExportRow[] = [];
    const respostaRows: RespostaExportRow[] = [];
    const avaliadoFilter = request.avaliadoNames?.length
      ? new Set(request.avaliadoNames.map(n => n.trim()))
      : null;

    const projectsSnap = await getDocs(
      query(collection(this.firestore, 'projects'), where('clientId', '==', request.clientId))
    );
    const projectMap = new Map<string, { name: string; assessmentId: string }>();
    projectsSnap.docs.forEach(d => {
      projectMap.set(d.id, {
        name: d.data()['name'] || '—',
        assessmentId: d.data()['assessmentId'] || '',
      });
    });

    for (let i = 0; i < request.projectIds.length; i++) {
      const projectId = request.projectIds[i];
      const projectInfo = projectMap.get(projectId);
      if (!projectInfo?.assessmentId) continue;

      onProgress?.(
        `Processando projeto ${i + 1}/${request.projectIds.length}: ${projectInfo.name}...`
      );

      const bundle = await this.loadProjectDataBundle(
        projectId,
        projectInfo.name,
        projectInfo.assessmentId,
        request.clientName,
        request.releasedOnly === true
      );

      if (!bundle.dataSource.length || !bundle.competencias.length) continue;

      const avaliados = this.listAvaliados(bundle.dataSource);
      for (const avaliado of avaliados) {
        if (avaliadoFilter && !avaliadoFilter.has(avaliado.nome)) continue;

        for (const comp of bundle.competencias) {
          const medias = this.calcularMediasCompetencia(
            bundle.dataSource,
            comp,
            avaliado.nome,
            avaliado.id
          );

          resumoRows.push({
            Cliente: request.clientName,
            Projeto: projectInfo.name,
            Avaliação: bundle.assessmentName,
            Avaliado: avaliado.nome,
            Competência: comp.nome,
            'Média geral': this.formatMedia(medias.geral),
            'Média s/ auto': this.formatMedia(medias.semAuto),
            'Média Avaliado(a)': this.formatMedia(medias.porGrupo['Avaliado(a)']),
            'Média Gestor(es)': this.formatMedia(medias.porGrupo['Gestor(es)']),
            'Média Pares': this.formatMedia(medias.porGrupo['Pares']),
            'Média Subordinados': this.formatMedia(medias.porGrupo['Subordinados']),
            'Média Outros': this.formatMedia(medias.porGrupo['Outros']),
            'Qtd. respondentes': this.countRespondentes(bundle.dataSource, avaliado.nome, avaliado.id),
          });
        }

        respostaRows.push(
          ...this.buildRespostaRows(
            bundle,
            request.clientName,
            projectInfo.name,
            avaliado.nome,
            avaliado.id
          )
        );
      }
    }

    if (resumoRows.length === 0) {
      throw new Error('Nenhum dado encontrado para os projetos selecionados.');
    }

    const fileName = this.buildFileName(request.clientName);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resumoRows), 'Resumo');
    if (respostaRows.length > 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(respostaRows), 'Respostas');
      const respostasAbertas = respostaRows.filter(r => r.TipoResposta === 'Aberta');
      if (respostasAbertas.length > 0) {
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(respostasAbertas),
          'Perguntas Abertas'
        );
      }
    }
    XLSX.writeFile(workbook, fileName);

    return { resumoCount: resumoRows.length, respostasCount: respostaRows.length, fileName };
  }

  private buildFileName(clientName: string): string {
    const safe = clientName
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Cliente';
    const date = new Date().toISOString().slice(0, 10);
    return `${safe}_Extrato_360_${date}.xlsx`;
  }

  private formatMedia(value: number | null): number | string {
    if (value === null || Number.isNaN(value)) return '';
    return Math.round(value * 100) / 100;
  }

  private mapCategoriaToGrupo(categoria: string): string {
    const map: Record<string, string> = {
      Avaliado: 'Avaliado(a)',
      'Avaliado(a)': 'Avaliado(a)',
      Gestor: 'Gestor(es)',
      'Gestor(es)': 'Gestor(es)',
      Par: 'Pares',
      Pares: 'Pares',
      Subordinado: 'Subordinados',
      Subordinados: 'Subordinados',
      Outro: 'Outros',
      Outros: 'Outros',
    };
    return map[categoria] || categoria || 'Outros';
  }

  private parseLikertAnswer(answer: unknown): number | null {
    return parseLikertAnswerForExport(answer);
  }

  private matchesAvaliado(row: DataRow, avaliadoNome: string, avaliadoId: string): boolean {
    return row.avaliado === avaliadoNome || row.avaliadoId === avaliadoId;
  }

  private listAvaliados(dataSource: DataRow[]): { nome: string; id: string }[] {
    const map = new Map<string, string>();
    for (const row of dataSource) {
      if ((row.tipo || '').toLowerCase() !== 'avaliado') continue;
      if (!row.avaliado?.trim()) continue;
      if (!map.has(row.avaliado)) {
        map.set(row.avaliado, row.avaliadoId || row.participanteId);
      }
    }
    return Array.from(map.entries())
      .map(([nome, id]) => ({ nome, id }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  private countRespondentes(dataSource: DataRow[], avaliadoNome: string, avaliadoId: string): number {
    const ids = new Set<string>();
    for (const row of dataSource) {
      if (!this.matchesAvaliado(row, avaliadoNome, avaliadoId)) continue;
      if ((row.tipo || '').toLowerCase() === 'avaliador' && row.participanteId) {
        ids.add(row.participanteId);
      }
    }
    return ids.size;
  }

  private getMediaPorPerguntaEGrupo(
    dataSource: DataRow[],
    competencia: CompetenciaExport,
    grupo: string,
    avaliadoNome: string,
    avaliadoId: string
  ): number | null {
    let soma = 0;
    let count = 0;
    for (const pid of competencia.perguntasIds || []) {
      for (const row of dataSource) {
        if (!this.matchesAvaliado(row, avaliadoNome, avaliadoId)) continue;
        if (this.mapCategoriaToGrupo(row.categoria) !== grupo) continue;
        const valor = this.parseLikertAnswer(row[pid]);
        if (valor !== null) {
          soma += valor;
          count++;
        }
      }
    }
    return count ? soma / count : null;
  }

  private calcularMediasCompetencia(
    dataSource: DataRow[],
    competencia: CompetenciaExport,
    avaliadoNome: string,
    avaliadoId: string
  ): {
    geral: number | null;
    semAuto: number | null;
    porGrupo: Record<string, number | null>;
  } {
    const porGrupo: Record<string, number | null> = {};
    for (const grupo of GRUPOS_PADRAO) {
      porGrupo[grupo] = this.getMediaPorPerguntaEGrupo(
        dataSource,
        competencia,
        grupo,
        avaliadoNome,
        avaliadoId
      );
    }

    const mediasComValor = GRUPOS_PADRAO.map(g => porGrupo[g]).filter(
      (v): v is number => v !== null && !Number.isNaN(v)
    );
    const geral =
      mediasComValor.length > 0
        ? mediasComValor.reduce((a, b) => a + b, 0) / mediasComValor.length
        : null;

    const gruposSemAuto = GRUPOS_PADRAO.filter(g => g !== 'Avaliado(a)');
    const mediasSemAuto = gruposSemAuto
      .map(g => porGrupo[g])
      .filter((v): v is number => v !== null && !Number.isNaN(v));
    const semAuto =
      mediasSemAuto.length > 0
        ? mediasSemAuto.reduce((a, b) => a + b, 0) / mediasSemAuto.length
        : null;

    return { geral, semAuto, porGrupo };
  }

  private buildRespostaRows(
    bundle: ProjectDataBundle,
    clientName: string,
    projectName: string,
    avaliadoNome: string,
    avaliadoId: string
  ): RespostaExportRow[] {
    const tipoPorId = new Map(bundle.questions.map(q => [q.id, normalizeQuestionType(q.type)]));
    const compPorPergunta = new Map<string, string>();
    for (const comp of bundle.competencias) {
      for (const pid of comp.perguntasIds || []) {
        if (!compPorPergunta.has(pid)) compPorPergunta.set(pid, comp.nome);
      }
    }

    const linhas: RespostaExportRow[] = [];
    for (const row of bundle.dataSource) {
      if (!this.matchesAvaliado(row, avaliadoNome, avaliadoId)) continue;

      for (const q of bundle.questions) {
        if (!(q.id in row)) continue;

        const exportAnswer = resolveExportAnswer(row[q.id], tipoPorId.get(q.id));
        if (exportAnswer.kind === 'skip') continue;

        linhas.push({
          Cliente: clientName,
          Projeto: projectName,
          Avaliação: bundle.assessmentName,
          AssessmentId: bundle.assessmentId,
          Data: row.dataAvaliacao || '',
          Horário: row.horarioAvaliacao || '',
          Categoria: row.categoria || '',
          Avaliado: row.avaliado || '',
          Cargo: row.cargo || '',
          'Área/Setor': row.setor || '',
          Competência: compPorPergunta.get(q.id) || '',
          PerguntaId: q.id,
          Pergunta: bundle.questionMap[q.id] || q.title || q.id,
          TipoResposta: getExportAnswerTipoResposta(exportAnswer.kind),
          Resposta: exportAnswer.value,
        });
      }
    }
    return linhas;
  }

  private async loadProjectDataBundle(
    projectId: string,
    projectName: string,
    assessmentId: string,
    clientName: string,
    releasedOnly: boolean
  ): Promise<ProjectDataBundle> {
    void projectName;
    void clientName;

    const assessmentSnap = await getDoc(doc(this.firestore, 'assessments', assessmentId));
    if (!assessmentSnap.exists()) {
      return emptyBundle(assessmentId);
    }

    const assessmentData = assessmentSnap.data();
    const assessmentName =
      assessmentData['name'] || assessmentData['surveyJSON']?.['title'] || assessmentId;
    const { questions, questionMap } = extractSurveyQuestions(assessmentData['surveyJSON']);
    const competencias = await this.loadCompetencias(assessmentId);

    const evaluatorToAvaliadoId = new Map<string, string>();
    try {
      const linksSnap = await getDocs(
        query(
          collection(this.firestore, 'assessmentLinks'),
          where('assessmentId', '==', assessmentId)
        )
      );
      linksSnap.docs.forEach(d => {
        const pid = d.data()['participantId'] as string | undefined;
        const aid = d.data()['avaliadoId'] as string | undefined;
        if (pid && aid) evaluatorToAvaliadoId.set(pid, aid);
      });
    } catch {
      /* continua sem links */
    }

    let soleAvaliadoId: string | undefined;
    try {
      const avaliadosSnap = await getDocs(
        query(
          collection(this.firestore, 'participants'),
          where('projectId', '==', projectId),
          where('type', '==', 'avaliado')
        )
      );
      if (avaliadosSnap.docs.length === 1) {
        soleAvaliadoId = avaliadosSnap.docs[0].id;
      }
    } catch {
      /* ignore */
    }

    const participantsCache = new Map<string, Record<string, unknown>>();
    const resolveName = async (participantId: string): Promise<string> => {
      if (!participantsCache.has(participantId)) {
        const snap = await getDoc(doc(this.firestore, 'participants', participantId));
        participantsCache.set(
          participantId,
          snap.exists() ? (snap.data() as Record<string, unknown>) : {}
        );
      }
      return String(participantsCache.get(participantId)?.['name'] || 'N/A');
    };

    const resultsSnap = await getDocs(
      collection(this.firestore, `assessments/${assessmentId}/results`)
    );

    const dataSource: DataRow[] = [];
    for (const resultDoc of resultsSnap.docs) {
      const resultData = resultDoc.data();
      const participantId = resultData['participantId'] as string | undefined;
      if (!participantId) continue;

      if (!participantsCache.has(participantId)) {
        const snap = await getDoc(doc(this.firestore, 'participants', participantId));
        participantsCache.set(
          participantId,
          snap.exists() ? (snap.data() as Record<string, unknown>) : {}
        );
      }
      const participantData = participantsCache.get(participantId)!;
      if (participantData['projectId'] !== projectId) continue;
      if (!isParticipantIncludedInReports(participantData)) continue;

      if (participantData['type'] === 'avaliador' && participantData['avaliadoId']) {
        evaluatorToAvaliadoId.set(participantId, String(participantData['avaliadoId']));
      }

      const completedAtDate: Date | null = resultData['completedAt']?.toDate
        ? resultData['completedAt'].toDate()
        : null;

      const tipoParticipante = String(participantData['type'] || 'avaliado');
      let avaliadoNome: string;
      let avaliadoIdResolved: string;

      if (tipoParticipante === 'avaliador') {
        let avaliadoId =
          evaluatorToAvaliadoId.get(participantId) ||
          (participantData['avaliadoId'] as string | undefined);
        if (!avaliadoId && soleAvaliadoId) {
          avaliadoId = soleAvaliadoId;
        }
        if (avaliadoId) {
          avaliadoIdResolved = avaliadoId;
          avaliadoNome = await resolveName(avaliadoId);
        } else {
          avaliadoIdResolved = participantId;
          avaliadoNome = String(participantData['name'] || 'N/A');
        }
      } else {
        avaliadoIdResolved = participantId;
        avaliadoNome = String(participantData['name'] || 'N/A');
      }

      const row: DataRow = {
        categoria: String(participantData['category'] || 'N/A'),
        avaliado: avaliadoNome,
        avaliadoId: avaliadoIdResolved,
        tipo: tipoParticipante,
        dataAvaliacao: completedAtDate
          ? completedAtDate.toLocaleDateString('pt-BR')
          : 'N/A',
        horarioAvaliacao: completedAtDate
          ? completedAtDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : 'N/A',
        cargo: String(participantData['cargo'] || ''),
        setor: String(participantData['setor'] || ''),
        participanteId: participantId,
        reportStatus: String(participantData['reportStatus'] || 'pending'),
      };

      const surveyData = resultData['surveyData'] as Record<string, unknown> | undefined;
      if (surveyData) {
        for (const question of questions) {
          row[question.id] = resolveSurveyAnswer(surveyData, question);
        }
      }

      dataSource.push(row);
    }

    if (releasedOnly) {
      const releasedAvaliadoIds = new Set<string>();
      for (const row of dataSource) {
        if ((row.tipo || '').toLowerCase() === 'avaliado' && row.reportStatus === 'released') {
          releasedAvaliadoIds.add(row.avaliadoId);
        }
      }
      const filtered = dataSource.filter(row => releasedAvaliadoIds.has(row.avaliadoId));
      return {
        assessmentId,
        assessmentName,
        questions,
        questionMap,
        competencias,
        dataSource: filtered,
      };
    }

    return {
      assessmentId,
      assessmentName,
      questions,
      questionMap,
      competencias,
      dataSource,
    };
  }

  private async loadCompetencias(assessmentId: string): Promise<CompetenciaExport[]> {
    const result: CompetenciaExport[] = [];
    const seen = new Set<string>();

    const groupsSnap = await getDocs(
      query(
        collection(this.firestore, 'competencyGroups'),
        where('assessmentId', '==', assessmentId)
      )
    );

    groupsSnap.docs.forEach(groupDoc => {
      const competencias: unknown[] = Array.isArray(groupDoc.data()['competencias'])
        ? groupDoc.data()['competencias']
        : [];
      competencias.forEach((c: unknown) => {
        const comp = c as {
          id?: string;
          nome?: string;
          name?: string;
          perguntasIds?: string[];
          questionIds?: string[];
        };
        const compId = comp.id || `${groupDoc.id}_${comp.nome || comp.name}`;
        if (seen.has(compId)) return;
        seen.add(compId);
        result.push({
          id: compId,
          nome: comp.nome || comp.name || 'Competência sem nome',
          perguntasIds: comp.perguntasIds || comp.questionIds || [],
        });
      });
    });

    if (result.length === 0) {
      const competenciesSnap = await getDocs(collection(this.firestore, 'competencies'));
      competenciesSnap.docs.forEach(docSnap => {
        if (seen.has(docSnap.id)) return;
        seen.add(docSnap.id);
        const data = docSnap.data();
        const questions: unknown[] = Array.isArray(data['questions']) ? data['questions'] : [];
        result.push({
          id: docSnap.id,
          nome: data['name'] || data['nome'] || 'Competência sem nome',
          perguntasIds:
            data['perguntasIds'] ||
            data['questionIds'] ||
            questions.map((q: unknown) => (q as { id?: string }).id || '').filter(Boolean),
        });
      });
    }

    return result;
  }
}

interface ProjectDataBundle {
  assessmentId: string;
  assessmentName: string;
  questions: QuestionExport[];
  questionMap: Record<string, string>;
  competencias: CompetenciaExport[];
  dataSource: DataRow[];
}

function emptyBundle(assessmentId: string): ProjectDataBundle {
  return {
    assessmentId,
    assessmentName: assessmentId,
    questions: [],
    questionMap: {},
    competencias: [],
    dataSource: [],
  };
}
