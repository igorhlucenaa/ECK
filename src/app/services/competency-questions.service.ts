import { Injectable } from '@angular/core';

export interface CompetencyQuestionSource {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface CustomQuestion {
  id: string;
  title: string;
  type: string;
}

export interface CompetencyGroupCompetencia {
  id: string;
  nome?: string;
  name?: string;
  descricao?: string;
  perguntasIds?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class CompetencyQuestionsService {
  parseGroupCompetencyId(id: string): { groupId: string; groupIndex: number } | null {
    const marker = '_comp_';
    const markerIndex = id.lastIndexOf(marker);
    if (markerIndex === -1) return null;

    return {
      groupId: id.substring(0, markerIndex),
      groupIndex: parseInt(id.substring(markerIndex + marker.length), 10) || 0,
    };
  }

  resolveLocalizedText(value: unknown, fallback = ''): string {
    if (!value) return fallback;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') {
      const localized = value as Record<string, unknown>;
      const candidate = localized['pt'] ?? localized['default'] ?? localized['en'] ?? Object.values(localized)[0];
      return candidate != null ? String(candidate).trim() : fallback;
    }
    return fallback;
  }

  mapSurveyTypeToCompetencyType(surveyType: string): string {
    const typeMap: Record<string, string> = {
      rating: 'rating',
      radiogroup: 'radiogroup',
      text: 'text',
      comment: 'comment',
      checkbox: 'checkbox',
      dropdown: 'dropdown',
      boolean: 'boolean',
    };
    return typeMap[surveyType] || 'text';
  }

  /**
   * Normaliza estruturas legadas do Firestore.
   * - `customQuestions` como array (formato antigo)
   * - `customQuestions` como mapa por competência (bug do competency-dialog)
   */
  normalizeCustomQuestionsByCompetency(groupData: Record<string, unknown>): Record<string, CustomQuestion[]> {
    const normalized: Record<string, CustomQuestion[]> = {};

    const byComp = groupData['customQuestionsByCompetency'];
    if (byComp && typeof byComp === 'object' && !Array.isArray(byComp)) {
      Object.entries(byComp as Record<string, CustomQuestion[]>).forEach(([compId, questions]) => {
        if (Array.isArray(questions) && questions.length > 0) {
          normalized[compId] = questions.map((q) => ({
            id: q.id,
            title: q.title || '',
            type: q.type || 'rating',
          }));
        }
      });
    }

    const legacy = groupData['customQuestions'];
    if (!legacy) return normalized;

    if (Array.isArray(legacy)) {
      const flatQuestions = legacy as CustomQuestion[];
      const competencias = (groupData['competencias'] as CompetencyGroupCompetencia[]) || [];

      competencias.forEach((comp) => {
        const ids = comp.perguntasIds || [];
        const matched = flatQuestions.filter((q) => ids.includes(q.id));
        if (matched.length > 0) {
          normalized[comp.id] = matched;
        }
      });

      if (Object.keys(normalized).length === 0 && flatQuestions.length > 0) {
        competencias.forEach((comp, index) => {
          if (index === 0) {
            normalized[comp.id] = flatQuestions;
          }
        });
      }
      return normalized;
    }

    if (typeof legacy === 'object') {
      Object.entries(legacy as Record<string, CustomQuestion[]>).forEach(([compId, questions]) => {
        if (!Array.isArray(questions) || questions.length === 0) return;
        normalized[compId] = [
          ...(normalized[compId] || []),
          ...questions.map((q) => ({
            id: q.id,
            title: q.title || '',
            type: q.type || 'rating',
          })),
        ];
      });
    }

    return normalized;
  }

  extractQuestionsFromAssessment(
    surveyJSON: Record<string, unknown> | null | undefined,
    perguntasIds: string[]
  ): CompetencyQuestionSource[] {
    const idsSet = new Set(perguntasIds);
    const found = new Map<string, CompetencyQuestionSource>();
    const pages = (surveyJSON?.['pages'] as unknown[]) || [];

    for (const page of pages) {
      const elements = ((page as Record<string, unknown>)?.['elements'] as unknown[]) || [];
      for (const element of elements) {
        const el = element as Record<string, unknown>;
        const elType = String(el['type'] || '');

        if ((elType === 'matrix' || elType === 'matrixdropdown') && Array.isArray(el['rows'])) {
          for (const row of el['rows'] as Record<string, unknown>[]) {
            if (!row) continue;
            const questionId = `${el['name']}_${row['value']}`;
            if (idsSet.has(questionId)) {
              found.set(questionId, {
                id: questionId,
                text: this.resolveLocalizedText(row['text'], 'Questão'),
                type: 'rating',
                required: el['isRequired'] !== false,
              });
            }
          }
        }

        if (el['name'] && idsSet.has(String(el['name']))) {
          found.set(String(el['name']), {
            id: String(el['name']),
            text: this.resolveLocalizedText(el['title'], String(el['name'])),
            type: this.mapSurveyTypeToCompetencyType(elType),
            required: el['isRequired'] !== false,
            options: el['choices'] as string[] | undefined,
          });
        }
      }
    }

    return perguntasIds.filter((id) => found.has(id)).map((id) => found.get(id)!);
  }

  extractQuestionsFromCustomList(
    customQuestions: CustomQuestion[],
    perguntasIds: string[]
  ): CompetencyQuestionSource[] {
    if (!customQuestions?.length || !perguntasIds?.length) return [];

    const idsSet = new Set(perguntasIds);
    return customQuestions
      .filter((q) => idsSet.has(q.id))
      .map((q) => ({
        id: q.id,
        text: q.title || '',
        type: this.mapSurveyTypeToCompetencyType(q.type || 'rating'),
        required: true,
      }));
  }

  resolveCompetencyQuestions(
    comp: CompetencyGroupCompetencia,
    groupData: Record<string, unknown>,
    assessmentSurveyJSON?: Record<string, unknown> | null
  ): CompetencyQuestionSource[] {
    const perguntasIds = Array.isArray(comp.perguntasIds) ? comp.perguntasIds : [];
    const customByCompetency = this.normalizeCustomQuestionsByCompetency(groupData);
    const customForComp = customByCompetency[comp.id] || [];
    const legacyFlat = Array.isArray(groupData['customQuestions'])
      ? (groupData['customQuestions'] as CustomQuestion[])
      : [];

    const collected = new Map<string, CompetencyQuestionSource>();

    const addQuestions = (items: CompetencyQuestionSource[]) => {
      for (const item of items) {
        if (item?.id && !collected.has(item.id)) {
          collected.set(item.id, item);
        }
      }
    };

    if (assessmentSurveyJSON && perguntasIds.length > 0) {
      addQuestions(this.extractQuestionsFromAssessment(assessmentSurveyJSON, perguntasIds));
    }

    const customIds = perguntasIds.length > 0 ? perguntasIds : customForComp.map((q) => q.id);

    addQuestions(this.extractQuestionsFromCustomList(customForComp, customIds));
    addQuestions(this.extractQuestionsFromCustomList(legacyFlat, customIds));

    if (collected.size === 0 && perguntasIds.length > 0) {
      const allCustom = [
        ...customForComp,
        ...legacyFlat,
        ...Object.values(customByCompetency).flat(),
      ];
      addQuestions(this.extractQuestionsFromCustomList(allCustom, perguntasIds));
    }

    const order = perguntasIds.length > 0 ? perguntasIds : customForComp.map((q) => q.id);
    return order.filter((id) => collected.has(id)).map((id) => collected.get(id)!);
  }

  resolveQuestionTitle(
    perguntaId: string,
    competenciaId: string,
    questionMap: Record<string, string>,
    customQuestionsByCompetency: Record<string, CustomQuestion[]>
  ): string {
    if (questionMap[perguntaId]) {
      return questionMap[perguntaId];
    }

    const perguntasComp = customQuestionsByCompetency[competenciaId] || [];
    const perguntaComp = perguntasComp.find((q) => q.id === perguntaId);
    if (perguntaComp?.title) {
      return perguntaComp.title;
    }

    const todasPerguntas = Object.values(customQuestionsByCompetency).flat();
    const perguntaGlobal = todasPerguntas.find((q) => q.id === perguntaId);
    if (perguntaGlobal?.title) {
      return perguntaGlobal.title;
    }

    return perguntaId;
  }

  populateQuestionMapFromCustom(
    customQuestionsByCompetency: Record<string, CustomQuestion[]>,
    questionMap: Record<string, string>
  ): void {
    Object.values(customQuestionsByCompetency).flat().forEach((q) => {
      if (q.id && q.title && !questionMap[q.id]) {
        questionMap[q.id] = q.title;
      }
    });
  }

  mergeCustomQuestionsFromGroup(
    groupData: Record<string, unknown>,
    target: Record<string, CustomQuestion[]>
  ): void {
    const normalized = this.normalizeCustomQuestionsByCompetency(groupData);
    Object.entries(normalized).forEach(([compId, questions]) => {
      if (!target[compId]) {
        target[compId] = questions;
        return;
      }

      const existingIds = new Set(target[compId].map((q) => q.id));
      questions.forEach((q) => {
        if (!existingIds.has(q.id)) {
          target[compId].push(q);
        }
      });
    });
  }

  toSurveyQuestion(q: CompetencyQuestionSource, fallbackIndex: number): Record<string, unknown> {
    const questionName = q.id || `q_${fallbackIndex}`;
    const surveyQuestion: Record<string, unknown> = {
      name: questionName,
      title: q.text,
      isRequired: true,
    };

    switch (q.type) {
      case 'likert':
      case 'rating':
        surveyQuestion['type'] = 'rating';
        surveyQuestion['rateValues'] = [
          { value: 1, text: '1' },
          { value: 2, text: '2' },
          { value: 3, text: '3' },
          { value: 4, text: '4' },
          { value: 5, text: '5' },
          { value: '?', text: '?' },
        ];
        surveyQuestion['minRateDescription'] = 'Discordo Totalmente';
        surveyQuestion['maxRateDescription'] = 'Concordo Totalmente';
        break;
      case 'multiple_choice':
      case 'radiogroup':
        surveyQuestion['type'] = 'radiogroup';
        surveyQuestion['choices'] = q.options || [];
        break;
      case 'text':
      case 'comment':
        surveyQuestion['type'] = 'comment';
        break;
      case 'number':
        surveyQuestion['type'] = 'text';
        surveyQuestion['inputType'] = 'number';
        break;
      default:
        surveyQuestion['type'] = 'text';
    }

    return surveyQuestion;
  }
}
