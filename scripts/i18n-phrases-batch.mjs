/**
 * Adds PT-as-key entries to pt-BR, en, es (ECK convention).
 * pt-BR: value = key; en/es: translated value.
 */
import fs from 'fs';
import path from 'path';

const repo = path.resolve(import.meta.dirname, '..');
const i18nDir = path.join(repo, 'src/assets/i18n');

/** @type {Record<string, { en: string; es: string }>} */
const phrases = {
  'Editar Participante': {
    en: 'Edit participant',
    es: 'Editar participante',
  },
  'Altere o nome, e-mail e/ou categoria do participante': {
    en: 'Change the participant name, email and/or category',
    es: 'Cambie el nombre, correo y/o categoría del participante',
  },
  'Nome completo': { en: 'Full name', es: 'Nombre completo' },
  'email@exemplo.com': { en: 'email@example.com', es: 'correo@ejemplo.com' },
  'Histórico de Envios': { en: 'Send history', es: 'Historial de envíos' },
  'Buscar cliente...': { en: 'Search client...', es: 'Buscar cliente...' },
  'Ex: Liderança Executiva': {
    en: 'E.g. Executive Leadership',
    es: 'Ej.: Liderazgo ejecutivo',
  },
  'Ex: Liderança, Comunicação...': {
    en: 'E.g. Leadership, Communication...',
    es: 'Ej.: Liderazgo, comunicación...',
  },
  'Descreva brevemente esta competência...': {
    en: 'Briefly describe this competency...',
    es: 'Describa brevemente esta competencia...',
  },
  'Editar competência': { en: 'Edit competency', es: 'Editar competencia' },
  'Remover competência': { en: 'Remove competency', es: 'Eliminar competencia' },
  'Editar texto da pergunta': { en: 'Edit question text', es: 'Editar texto de la pregunta' },
  'Editar pergunta': { en: 'Edit question', es: 'Editar pregunta' },
  'Remover pergunta': { en: 'Remove question', es: 'Eliminar pregunta' },
  'Voltar para a lista': { en: 'Back to list', es: 'Volver a la lista' },
  'Perguntas abertas vão para a seção \'Perguntas Abertas\' do relatório automaticamente': {
    en: 'Open questions go to the Open Questions report section automatically',
    es: 'Las preguntas abiertas van a la sección Preguntas abiertas del informe automáticamente',
  },
  'Perguntas do tipo texto/comentário serão exibidas na seção \'Perguntas Abertas\' do relatório. Não geram pontuação numérica e não precisam ser vinculadas a competências.': {
    en: 'Text/comment questions appear in Open Questions. They are not scored and need not be linked to competencies.',
    es: 'Las preguntas de texto/comentario aparecen en Preguntas abiertas. No tienen puntuación y no deben vincularse a competencias.',
  },
  'Nenhum modelo encontrado': { en: 'No templates found', es: 'No se encontraron modelos' },
  'Cancelar': { en: 'Cancel', es: 'Cancelar' },
  'Cancelar projeto': { en: 'Cancel project', es: 'Cancelar proyecto' },
  'Excluir projeto': { en: 'Delete project', es: 'Eliminar proyecto' },
  'Exportar Tabelas': { en: 'Export tables', es: 'Exportar tablas' },
  'Selecione as tabelas que deseja exportar': {
    en: 'Select the tables you want to export',
    es: 'Seleccione las tablas que desea exportar',
  },
  'Dashboard Interativo': { en: 'Interactive dashboard', es: 'Panel interactivo' },
  'Recarregar': { en: 'Reload', es: 'Recargar' },
  'Extrato do cliente': { en: 'Client statement', es: 'Extracto del cliente' },
  'Selecionar todos': { en: 'Select all', es: 'Seleccionar todos' },
  'Desmarcar todos': { en: 'Deselect all', es: 'Desmarcar todos' },
  'Nome do template': { en: 'Template name', es: 'Nombre del modelo' },
  'Ex: Padrão Liderança': { en: 'E.g. Leadership default', es: 'Ej.: Liderazgo estándar' },
  'Tipo de gráfico': { en: 'Chart type', es: 'Tipo de gráfico' },
  'Voltar': { en: 'Back', es: 'Volver' },
  'Criar Pedido': { en: 'Create order', es: 'Crear pedido' },
  'resultado(s)': { en: 'result(s)', es: 'resultado(s)' },
  'Importar Participantes': { en: 'Import participants', es: 'Importar participantes' },
  'Vincular Avaliados': { en: 'Link evaluatees', es: 'Vincular evaluados' },
  'Enviar Link': { en: 'Send link', es: 'Enviar enlace' },
  'Remover Avaliação': { en: 'Remove assessment', es: 'Eliminar evaluación' },
  'Exportar Dados': { en: 'Export data', es: 'Exportar datos' },
  'Importe participantes em massa via planilha Excel.': {
    en: 'Import participants in bulk via Excel spreadsheet.',
    es: 'Importe participantes en masa mediante hoja Excel.',
  },
  'Buscar cliente…': { en: 'Search client…', es: 'Buscar cliente…' },
  'Grupo "{{name}}" selecionado com {{count}} competências': {
    en: 'Group "{{name}}" selected with {{count}} competencies',
    es: 'Grupo "{{name}}" seleccionado con {{count}} competencias',
  },
  'Nenhuma competência encontrada para o grupo "{{name}}"': {
    en: 'No competencies found for group "{{name}}"',
    es: 'No se encontraron competencias para el grupo "{{name}}"',
  },
  'Nenhuma pergunta encontrada nas competências selecionadas. Verifique se elas têm perguntas vinculadas no grupo de competências.': {
    en: 'No questions found in selected competencies. Check linked questions in the competency group.',
    es: 'No se encontraron preguntas en las competencias seleccionadas. Verifique preguntas vinculadas en el grupo.',
  },
  '{{count}} competência(s) sem perguntas foram ignoradas.': {
    en: '{{count}} competency(ies) without questions were skipped.',
    es: '{{count}} competencia(s) sin preguntas fueron omitidas.',
  },
  'Este projeto já possui o avaliado {{name}}.': {
    en: 'This project already has evaluatee {{name}}.',
    es: 'Este proyecto ya tiene al evaluado {{name}}.',
  },
  'Digite o nome da pergunta...': {
    en: 'Enter the question text...',
    es: 'Escriba el texto de la pregunta...',
  },
  'Variáveis Dinâmicas': { en: 'Dynamic variables', es: 'Variables dinámicas' },
  'Copiar': { en: 'Copy', es: 'Copiar' },
};

const langs = ['pt-BR', 'en', 'es'];
const data = Object.fromEntries(
  langs.map((l) => [l, JSON.parse(fs.readFileSync(path.join(i18nDir, `${l}.json`), 'utf8'))])
);

let added = 0;
for (const [key, tr] of Object.entries(phrases)) {
  for (const lang of langs) {
    const val = lang === 'pt-BR' ? key : lang === 'en' ? tr.en : tr.es;
    if (!(key in data[lang])) added++;
    data[lang][key] = val;
  }
}

for (const lang of langs) {
  fs.writeFileSync(path.join(i18nDir, `${lang}.json`), JSON.stringify(data[lang], null, 2) + '\n');
}
console.log('Phrase batch: updated', Object.keys(phrases).length, 'keys,', added, 'new slot entries');
