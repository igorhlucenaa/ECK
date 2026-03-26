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

export function filterQuestionsByType(
  allQuestions: Question[],
  includeOpen: boolean
): Question[] {
  if (!allQuestions?.length) return [];

  const closedQuestionTypes = [
    'rating',
    'dropdown',
    'radiogroup',
    'matrix',
    'checkbox',
    'boolean',
    'ranking',
  ];

  const openQuestionTypes = [
    'text',
    'comment',
    'multipletext',
    'file',
    'signaturepad',
  ];

  return allQuestions.filter((q) => {
    const isClosed = closedQuestionTypes.includes(q.type) || q.type === 'question';
    const isOpen = openQuestionTypes.includes(q.type);
    return includeOpen ? true : isClosed;
  });
}

export function getQuestionTypeStats(questions: Question[]): Record<string, number> {
  const stats: Record<string, number> = {};
  (questions || []).forEach((q) => {
    stats[q.type] = (stats[q.type] || 0) + 1;
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
