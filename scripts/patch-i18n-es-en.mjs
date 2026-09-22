/**
 * Corrige traduções EN/ES erradas (dashboard, prioridades, placeholders ES).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'src/assets/i18n', name), 'utf8'));
}
function save(name, data) {
  fs.writeFileSync(path.join(ROOT, 'src/assets/i18n', name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const enPatch = {
  Vencimento: 'Expiration',
  Prioridade: 'Priority',
  Crítica: 'Critical',
  Alta: 'High',
  Média: 'Medium',
  Baixa: 'Low',
  'Nome ou assunto...': 'Name or subject...',
  modelo: 'template',
  modelos: 'templates',
  salvo: 'saved',
  salvos: 'saved',
  'Configure as Competências': 'Configure Competencies',
  'Selecione um cliente na barra lateral para começar.':
    'Select a client in the sidebar to get started.',
  'competencies.step1': 'Select the <strong>client</strong>',
  'competencies.step2': 'Create or select a <strong>group</strong>',
  'competencies.step3': 'Add <strong>competencies</strong>',
  'competencies.step4': 'Save the <strong>group</strong>',
  'Busque por nome ou filtre por cliente e projeto. Para enviar e-mails, selecione o contexto completo.':
    'Search by name or filter by client and project. To send emails, select the full context.',
};

const esPatch = {
  Participantes: 'Participantes',
  Vencimento: 'Vencimiento',
  Prioridade: 'Prioridad',
  Crítica: 'Crítica',
  Alta: 'Alta',
  Média: 'Media',
  Baixa: 'Baja',
  'Nome ou assunto...': 'Nombre o asunto...',
  modelo: 'modelo',
  modelos: 'modelos',
  salvo: 'guardado',
  salvos: 'guardados',
  'Configure as Competências': 'Configure las competencias',
  'Selecione um cliente na barra lateral para começar.':
    'Seleccione un cliente en la barra lateral para comenzar.',
  'competencies.step1': 'Seleccione el <strong>cliente</strong>',
  'competencies.step2': 'Cree o seleccione un <strong>grupo</strong>',
  'competencies.step3': 'Agregue las <strong>competencias</strong>',
  'competencies.step4': 'Guarde el <strong>grupo</strong>',
  'Busque por nome ou filtre por cliente e projeto. Para enviar e-mails, selecione o contexto completo.':
    'Busque por nombre o filtre por cliente y proyecto. Para enviar correos, seleccione el contexto completo.',
  'Buscar por cliente…': 'Buscar por cliente…',
  'Buscar por projeto ou cliente…': 'Buscar por proyecto o cliente…',
  'Buscar por projeto ou descrição…': 'Buscar por proyecto o descripción…',
  'Buscar por projeto…': 'Buscar por proyecto…',
  'Créditos por Cliente': 'Créditos por cliente',
  'Utilizados e disponíveis — clientes críticos no topo':
    'Utilizados y disponibles — clientes críticos arriba',
  'Projetos em Andamento': 'Proyectos en curso',
  'Ordenados por criticidade — atrasados e em risco no topo':
    'Ordenados por criticidad — atrasados y en riesgo arriba',
  Crítico: 'Crítico',
  Atenção: 'Atención',
  Aviso: 'Aviso',
  'Funil de Projetos': 'Embudo de proyectos',
  'Projetos por Status': 'Proyectos por estado',
  'Pedidos com validade nos próximos 30 dias': 'Pedidos que vencen en los próximos 30 días',
  'Filtrar por cliente': 'Filtrar por cliente',
  Ver: 'Ver',
  Progresso: 'Progreso',
  Créditos: 'Créditos',
  Progress: 'Progreso',
  Credits: 'Créditos',
  Level: 'Nivel',
  Type: 'Tipo',
  Description: 'Descripción',
  'Filter by client': 'Filtrar por cliente',
  'Used and available — critical clients at the top':
    'Utilizados y disponibles — clientes críticos arriba',
  'Ordered by criticality — overdue and at risk at the top':
    'Ordenados por criticidad — atrasados y en riesgo arriba',
  'Orders expiring in the next 30 days': 'Pedidos que vencen en los próximos 30 días',
  'Project overview: total, in progress and completed':
    'Panorama de proyectos: total, en curso y concluidos',
  'Distribution of participants by evaluator type':
    'Distribución de participantes por tipo de evaluador',
  'Distribution of active projects among clients':
    'Distribución de proyectos activos entre los clientes',
  'Active + Completed = total projects in funnel (excludes cancelled)':
    'Activos + Concluidos = total de proyectos del embudo (excluye cancelados)',
  'Projects in Progress': 'Proyectos en curso',
  'Projects by Status': 'Proyectos por estado',
  'Project Funnel': 'Embudo de proyectos',
  'Credits by Client': 'Créditos por cliente',
  'Search by client…': 'Buscar por cliente…',
  'Search by project or client…': 'Buscar por proyecto o cliente…',
  'Search by project or description…': 'Buscar por proyecto o descripción…',
  'Search by project…': 'Buscar por proyecto…',
  View: 'Ver',
};

for (const [file, patch] of [
  ['en.json', enPatch],
  ['es.json', esPatch],
]) {
  const data = load(file);
  Object.assign(data, patch);
  save(file, data);
  console.log(`Patched ${file}: ${Object.keys(patch).length} keys`);
}
