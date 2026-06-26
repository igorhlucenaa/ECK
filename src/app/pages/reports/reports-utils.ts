/** Participantes bloqueados ficam fora de médias, tabelas e exportações de relatório. */
export function isParticipantIncludedInReports(
  participantData: Record<string, unknown> | null | undefined
): boolean {
  if (!participantData) return false;
  return participantData['blocked'] !== true;
}

export function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

export function exportToCSV(fileName: string, headers: string[], rows: any[], mapColumn: (row: any, col: string) => any) {
  if (!rows || rows.length === 0) return;
  const csvRows: string[] = [];
  csvRows.push(headers.join(','));
  for (const row of rows) {
    const values = headers.map(col => '"' + (mapColumn(row, col) ?? '').toString().replace(/"/g, '""') + '"');
    csvRows.push(values.join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export type Question = { id: string; type: string };

/** Tipos SurveyJS considerados pergunta aberta (texto livre / comentário). */
export const OPEN_QUESTION_TYPES = [
  'text',
  'comment',
  'multipletext',
  'file',
  'fileupload',
  'signaturepad',
] as const;

const CLOSED_QUESTION_TYPES = [
  'rating',
  'dropdown',
  'radiogroup',
  'matrix',
  'matrixdropdown',
  'checkbox',
  'boolean',
  'ranking',
  'question',
] as const;

const NESTED_ELEMENT_TYPES = new Set(['panel', 'paneldynamic', 'flowpanel']);

export function normalizeQuestionType(type: unknown): string {
  return String(type || '').trim().toLowerCase();
}

export function isOpenQuestionType(type: unknown): boolean {
  return OPEN_QUESTION_TYPES.includes(normalizeQuestionType(type) as (typeof OPEN_QUESTION_TYPES)[number]);
}

export function resolveLocalizedSurveyText(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, string>;
    const text =
      obj['pt'] ||
      obj['pt-BR'] ||
      obj['default'] ||
      Object.values(obj).find(v => typeof v === 'string' && v.trim()) ||
      fallback;
    return String(text).trim();
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return fallback;
}

export type ExtractedQuestion = {
  id: string;
  title: string;
  type: string;
  parentQuestion?: string;
  rowValue?: string;
};

export function extractSurveyQuestions(surveyJSON: unknown): {
  questions: ExtractedQuestion[];
  questionMap: Record<string, string>;
} {
  const questions: ExtractedQuestion[] = [];
  const questionMap: Record<string, string> = {};

  if (!surveyJSON || typeof surveyJSON !== 'object') {
    return { questions, questionMap };
  }

  const pages = (surveyJSON as { pages?: unknown[] }).pages || [];

  const registerQuestion = (question: ExtractedQuestion): void => {
    questions.push(question);
    questionMap[question.id] = question.title;
  };

  const walkElements = (elements: unknown[] | undefined): void => {
    if (!Array.isArray(elements)) return;

    for (const raw of elements) {
      if (!raw || typeof raw !== 'object') continue;
      const element = raw as {
        type?: string;
        name?: string;
        title?: unknown;
        elements?: unknown[];
        rows?: { value?: string; text?: unknown }[];
      };

      const elementType = normalizeQuestionType(element.type);

      if (NESTED_ELEMENT_TYPES.has(elementType) && Array.isArray(element.elements)) {
        walkElements(element.elements);
        continue;
      }

      if (
        (elementType === 'matrix' || elementType === 'matrixdropdown') &&
        Array.isArray(element.rows) &&
        element.name
      ) {
        element.rows.forEach((row, rowIndex) => {
          if (!row?.value) return;
          const questionText = resolveLocalizedSurveyText(row.text, `Questão ${rowIndex + 1}`);
          const questionId = `${element.name}_${row.value}`;
          registerQuestion({
            id: questionId,
            title: questionText,
            type: 'question',
            parentQuestion: element.name,
            rowValue: row.value,
          });
        });
        continue;
      }

      if (!element.name) continue;

      const questionTitle = resolveLocalizedSurveyText(
        element.title,
        String(element.name).trim() || 'Pergunta sem título'
      );

      registerQuestion({
        id: element.name,
        title: questionTitle,
        type: elementType || 'text',
      });
    }
  };

  for (const page of pages) {
    walkElements((page as { elements?: unknown[] }).elements);
  }

  return { questions, questionMap };
}

/** Lê resposta do surveyData considerando matriz aninhada e acesso direto. */
export function resolveSurveyAnswer(
  surveyData: Record<string, unknown> | undefined | null,
  question: Pick<ExtractedQuestion, 'id' | 'parentQuestion' | 'rowValue'>
): unknown {
  if (!surveyData) return null;

  if (question.parentQuestion && question.rowValue) {
    const grupo = surveyData[question.parentQuestion];
    if (grupo && typeof grupo === 'object' && !Array.isArray(grupo)) {
      const nested = (grupo as Record<string, unknown>)[question.rowValue];
      if (nested !== undefined && nested !== null) {
        return nested;
      }
    }
  }

  const matrixMatch = question.id.match(/^(pergunta\d+)_Row\s*(\d+)$/i);
  if (matrixMatch) {
    const baseId = matrixMatch[1];
    const rowKey = `Row ${matrixMatch[2]}`;
    const grupo = surveyData[baseId];
    if (grupo && typeof grupo === 'object' && !Array.isArray(grupo)) {
      const nested = (grupo as Record<string, unknown>)[rowKey];
      if (nested !== undefined && nested !== null) {
        return nested;
      }
    }
  }

  return surveyData[question.id] ?? null;
}

export function formatOpenAnswerForExport(answer: unknown): string {
  if (answer === null || answer === undefined) return '';

  if (typeof answer === 'string') {
    return answer.trim();
  }

  if (Array.isArray(answer)) {
    return answer.map(item => String(item ?? '').trim()).filter(Boolean).join(' | ');
  }

  if (typeof answer === 'object') {
    const entries = Object.entries(answer as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value ?? '').trim()}`)
      .filter(item => !item.endsWith(':'));
    return entries.join(' | ');
  }

  return String(answer).trim();
}

export function parseLikertAnswerForExport(answer: unknown): number | null {
  if (typeof answer === 'number') {
    return answer >= 1 && answer <= 5 ? answer : null;
  }
  if (typeof answer === 'string') {
    const match = answer.match(/Column\s*(\d+)/i);
    if (match) {
      const n = parseInt(match[1], 10);
      return n >= 1 && n <= 5 ? n : null;
    }
    const parsed = parseFloat(answer);
    return parsed >= 1 && parsed <= 5 ? parsed : null;
  }
  return null;
}

export type ExportAnswerResult =
  | { kind: 'open'; value: string }
  | { kind: 'likert'; value: number }
  | { kind: 'skip' };

/** Decide se a resposta é escala Likert ou texto aberto para exportação Excel. */
export function resolveExportAnswer(
  answer: unknown,
  questionType: unknown
): ExportAnswerResult {
  const tipo = normalizeQuestionType(questionType);

  if (isOpenQuestionType(tipo)) {
    const texto = formatOpenAnswerForExport(answer);
    return texto ? { kind: 'open', value: texto } : { kind: 'skip' };
  }

  if (tipo === 'question' || CLOSED_QUESTION_TYPES.includes(tipo as (typeof CLOSED_QUESTION_TYPES)[number])) {
    const likert = parseLikertAnswerForExport(answer);
    return likert !== null ? { kind: 'likert', value: likert } : { kind: 'skip' };
  }

  const likert = parseLikertAnswerForExport(answer);
  if (likert !== null) {
    return { kind: 'likert', value: likert };
  }

  if (typeof answer === 'string' && /Column\s*\d+/i.test(answer)) {
    return { kind: 'skip' };
  }

  const texto = formatOpenAnswerForExport(answer);
  if (!texto) {
    return { kind: 'skip' };
  }

  if (typeof answer === 'object' && answer !== null) {
    return { kind: 'open', value: texto };
  }

  if (typeof answer === 'string') {
    return { kind: 'open', value: texto };
  }

  return { kind: 'skip' };
}

export function filterQuestionsByType(
  allQuestions: Question[],
  includeOpen: boolean
): Question[] {
  if (!allQuestions?.length) return [];

  return allQuestions.filter((q) => {
    const type = normalizeQuestionType(q.type);
    if (includeOpen) return true;
    const isClosed =
      CLOSED_QUESTION_TYPES.includes(type as (typeof CLOSED_QUESTION_TYPES)[number]) ||
      type === 'question';
    return isClosed;
  });
}

export function getQuestionTypeStats(questions: Question[]): Record<string, number> {
  const stats: Record<string, number> = {};
  (questions || []).forEach((q) => {
    const type = normalizeQuestionType(q.type) || 'unknown';
    stats[type] = (stats[type] || 0) + 1;
  });
  return stats;
}

export type ConsolidationRow = {
  pergunta: string;
  sessao: string;
  tema: string;
  resposta: string;
  respondentes: number;
  percent: string;
  score: string;
};

export function computeConsolidation(
  dynamicCols: string[],
  rows: any[],
  questionMap: Record<string, string>
): ConsolidationRow[] {
  if (!dynamicCols?.length || !rows?.length) return [];
  const map: { [k: string]: { sum: number; count: number } } = {};
  dynamicCols.forEach((k) => (map[k] = { sum: 0, count: 0 }));
  rows.forEach((r) => {
    dynamicCols.forEach((k) => {
      const num = parseNumeric(r[k]);
      if (num !== null) {
        map[k].sum += num;
        map[k].count++;
      }
    });
  });
  const invited = rows.length;
  return dynamicCols.map((k) => {
    const avg = map[k].count ? map[k].sum / map[k].count : 0;
    return {
      pergunta: questionMap[k] || k,
      sessao: '',
      tema: '',
      resposta: avg.toFixed(2),
      respondentes: map[k].count,
      percent: invited ? ((map[k].count / invited) * 100).toFixed(2) + '%' : '0%',
      score: (avg * 20).toFixed(0),
    };
  });
}
