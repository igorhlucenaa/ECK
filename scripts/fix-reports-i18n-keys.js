/**
 * Adiciona chaves de Relatórios / Report Builder em en.json e es.json
 */
const fs = require('fs');
const path = require('path');

const EN = {
  'Relatório Individual': 'Individual Report',
  'Voltar para Lista': 'Back to list',
  'Projeto (automático)': 'Project (automatic)',
  'Projeto (ciclo)': 'Project (cycle)',
  'Esta avaliação está em mais de um projeto ativo': 'This assessment is linked to more than one active project',
  'Selecione para visualizar o relatório individual': 'Select to view the individual report',
  'Limpar seleção': 'Clear selection',
  'Visualizando dados individuais': 'Viewing individual data',
  'Avaliado selecionado:': 'Selected evaluatee:',
  'Montar': 'Build',
  'Seções e gráficos': 'Sections and charts',
  'Selecione quais competências aparecerão no relatório': 'Select which competencies will appear in the report',
  'Selecione uma avaliação primeiro': 'Select an assessment first',
  'Use o seletor acima para escolher qual avaliação 360° deseja analisar. As competências vinculadas serão carregadas automaticamente.':
    'Use the selector above to choose which 360° assessment to analyze. Linked competencies will load automatically.',
  'Configure as competências para esta avaliação': 'Configure competencies for this assessment',
  'Antes de montar o relatório, é necessário vincular as perguntas da avaliação às competências. Siga os passos abaixo:':
    'Before building the report, you must link assessment questions to competencies. Follow the steps below:',
  'Avaliação selecionada': 'Selected assessment',
  'Ir para Competências e vincular as perguntas': 'Go to Competencies and link questions',
  'Voltar para Relatórios': 'Back to Reports',
  'Após salvar, volte aqui e selecione a mesma avaliação. As competências aparecerão automaticamente.':
    'After saving, return here and select the same assessment. Competencies will appear automatically.',
  'Ajuste quais competências aparecerão no relatório': 'Adjust which competencies will appear in the report',
  'Clique em uma competência para ativar ou desativar. Todas estão ativas por padrão.':
    'Click a competency to enable or disable it. All are active by default.',
  'Ative pelo menos uma competência para avançar': 'Enable at least one competency to continue',
  'Montar Relatório': 'Build Report',
  'Organize as seções, textos e gráficos do relatório': 'Organize report sections, text and charts',
  'Template vinculado ao projeto': 'Template linked to project',
  'Escolha um template': 'Choose a template',
  'Edite seções abaixo': 'Edit sections below',
  'Visualize na aba Pré-visualizar': 'Preview in the Preview tab',
  'Template ativo': 'Active template',
  'Definido na criação do projeto — não pode ser alterado aqui': 'Set when the project was created — cannot be changed here',
  'Selecione um template — a estrutura é aplicada automaticamente': 'Select a template — structure is applied automatically',
  'Alterações não salvas': 'Unsaved changes',
  'Nenhum template aplicado': 'No template applied',
  'Template do projeto': 'Project template',
  'Este projeto não possui template de relatório vinculado. Edite o projeto e selecione um template para habilitar PDF e DOCX.':
    'This project has no linked report template. Edit the project and select a template to enable PDF and DOCX.',
  'Solicite ao administrador master a vinculação de um template na edição do projeto.':
    'Ask the master administrator to link a template when editing the project.',
  'Template': 'Template',
  'Recarrega a estrutura do template selecionado': 'Reloads the selected template structure',
  'Reaplicar template': 'Reapply template',
  'Grava no Firebase a estrutura atual do editor no template aplicado':
    'Saves the current editor structure to the applied template in Firebase',
  'Salvar alterações': 'Save changes',
  'Gerenciar templates…': 'Manage templates…',
  'Rascunho por avaliado (opcional)': 'Draft per evaluatee (optional)',
  'Snapshots com competências e dados específicos': 'Snapshots with competencies and specific data',
  'Salvar rascunho': 'Save draft',
  'Guarda a configuração atual vinculada a um avaliado': 'Saves current configuration linked to an evaluatee',
  'Nome do rascunho': 'Draft name',
  'Ex: Relatório João Silva': 'E.g.: John Smith Report',
  'Vinculado ao template:': 'Linked to template:',
  'Sem template aplicado — aplique um template acima antes de salvar':
    'No template applied — apply a template above before saving',
  'Carregar rascunho salvo': 'Load saved draft',
  'Selecione e clique em Carregar — não carrega automaticamente':
    'Select and click Load — does not load automatically',
  'Rascunho salvo': 'Saved draft',
  'Carregar rascunho': 'Load draft',
  'Atualizar rascunho': 'Update draft',
  'Restaurar estrutura padrão': 'Restore default structure',
  'Descarta seções atuais e volta ao layout inicial': 'Discards current sections and returns to initial layout',
  'Introdução': 'Introduction',
  'Análise Detalhada': 'Detailed Analysis',
  'Visualizar e Exportar': 'Preview and Export',
  'Relatório não publicado': 'Report not published',
  'Relatório publicado': 'Report published',
  'Avaliadores incluídos': 'Evaluators included',
  'Configure as competências primeiro': 'Configure competencies first',
  'Relatório aguardando publicação': 'Report awaiting publication',
  'Competências analisadas:': 'Competencies analyzed:',
  'Selecione uma ou mais competências na aba "Montar Relatório" para visualizar a tabela.':
    'Select one or more competencies in the "Build Report" tab to view the table.',
  'Selecione uma ou mais competências na aba "Montar Relatório" para visualizar as tabelas detalhadas.':
    'Select one or more competencies in the "Build Report" tab to view detailed tables.',
  'Selecione uma ou mais competências para gerar o gráfico.':
    'Select one or more competencies to generate the chart.',
  'Selecione uma ou more competências para gerar a Janela de Johari.':
    'Select one or more competencies to generate the Johari Window.',
  'Competências para a tabela': 'Competencies for the table',
  'Selecione as competências que devem aparecer na tabela de frequência.':
    'Select competencies to appear in the frequency table.',
  'Competências para tabela detalhada': 'Competencies for detailed table',
  'Selecione as competências para exibir na tabela de distribuição de notas (1-5).':
    'Select competencies to display in the score distribution table (1-5).',
  'Competências para o Gráfico de Defasagem': 'Competencies for Gap Chart',
  'Selecione as competências que devem aparecer no gráfico.':
    'Select competencies to appear in the chart.',
  'Configuração da Janela de Johari': 'Johari Window configuration',
  'A Janela de Johari classifica as competências em quatro quadrantes com base na autoavaliação e na avaliação dos outros. Selecione as competências que você deseja incluir nesta análise. O gráfico será gerado automaticamente.':
    'The Johari Window classifies competencies into four quadrants based on self-assessment and others\' assessment. Select competencies to include. The chart is generated automatically.',
  'Sobre a Tabela de Distribuição': 'About the Distribution Table',
  'Esta tabela mostra a contagem de respostas para cada nota (1-5) por categoria de avaliador, similar ao formato de frequência mostrado na imagem de exemplo. Cada competência selecionada gerará uma tabela completa com todas as suas perguntas.':
    'This table shows response counts for each score (1-5) by evaluator category. Each selected competency generates a full table with all its questions.',
  'Formulário carregado automaticamente': 'Form loaded automatically',
  'Selecione uma avaliação primeiro': 'Select an assessment first',
  'Configure': 'Configure',
  'ativa': 'active',
  'ativas': 'active',
  'Construtor de Relatórios': 'Report Builder',
  'Todas': 'All',
  'Não salvo': 'Not saved',
  'Salvo': 'Saved',
  'Nenhum template ou relatório carregado': 'No template or report loaded',
  'Configurar cabeçalho, rodapé e layout do documento': 'Configure document header, footer and layout',
  'Documento': 'Document',
  'Carregue um template ou relatório acima para salvar': 'Load a template or report above to save',
  'Salvar em:': 'Save to:',
  'Componentes': 'Components',
  'Estrutura do Relatório': 'Report Structure',
  'seção(ões)': 'section(s)',
  'Visualizar preview': 'View preview',
  'Nenhuma seção adicionada': 'No section added',
  'Arraste componentes da barra lateral ou clique neles para adicionar ao relatório':
    'Drag components from the sidebar or click them to add to the report',
  'Capa': 'Cover',
  'Página inicial do relatório': 'Report cover page',
  'Texto introdutório': 'Introductory text',
  'Resumo Executivo': 'Executive Summary',
  'Top competências e áreas de desenvolvimento': 'Top competencies and development areas',
  'Gráfico de Barras': 'Bar Chart',
  'Comparação por categorias': 'Comparison by categories',
  'Gráfico Radar': 'Radar Chart',
  'Comparação múltipla': 'Multiple comparison',
  'Gráfico Pizza': 'Pie Chart',
  'Distribuição percentual': 'Percentage distribution',
  'Tabela de Frequência': 'Frequency Table',
  'Dados tabulares simples': 'Simple tabular data',
  'Tabela de Distribuição': 'Distribution Table',
  'Distribuição de notas por categoria': 'Score distribution by category',
  'Análise por pergunta': 'Analysis by question',
  'Destaques': 'Highlights',
  'Pontos fortes e áreas de desenvolvimento': 'Strengths and development areas',
  'Gráfico de Defasagem': 'Gap Chart',
  'Gap entre autoavaliação e outros': 'Gap between self-assessment and others',
  'Janela de Johari': 'Johari Window',
  'Análise de percepção': 'Perception analysis',
  'Texto Livre': 'Free Text',
  'Seção de texto customizado': 'Custom text section',
  'Perguntas Abertas': 'Open Questions',
  'Respostas às perguntas: continuar, parar e começar a fazer':
    'Responses to continue, stop and start doing questions',
  'Básico': 'Basic',
  'Gráficos': 'Charts',
  'Tabelas': 'Tables',
  'Análise': 'Analysis',
  'Cores Sólidas': 'Solid Colors',
  'Ir para Competências': 'Go to Competencies',
  'Na página de Competências, selecione a mesma avaliação': 'On the Competencies page, select the same assessment',
  'crie ou edite os grupos de competências vinculando as perguntas do formulário, e clique em Salvar.':
    'create or edit competency groups by linking form questions, then click Save.',
  'Ativar todas': 'Enable all',
  'Desativar todas': 'Disable all',
  'Ativar todas as competências': 'Enable all competencies',
  'Desativar todas as competências': 'Disable all competencies',
  'Criar / editar competências': 'Create / edit competencies',
  'Ativa': 'Active',
  'Inativa': 'Inactive',
  'Questões vinculadas a esta competência:': 'Questions linked to this competency:',
  'Nenhuma questão vinculada ainda. Acesse a página de Competências para vincular perguntas.':
    'No questions linked yet. Go to the Competencies page to link questions.',
  'Editar projeto': 'Edit project',
  'Remover seleção': 'Clear selection',
  'Limpar e resetar': 'Clear and reset',
  'Visualizar Relatório': 'Preview Report',
  'Pré-visualize o relatório e exporte em PDF ou DOCX': 'Preview the report and export as PDF or DOCX',
  'Publique para que o visualizador tenha acesso.': 'Publish so the viewer can access it.',
  'O visualizador já tem acesso a esta versão.': 'The viewer already has access to this version.',
  'Sem título': 'Untitled',
  'Salvar': 'Save',
  '— Selecione um projeto —': '— Select a project —',
};

// Fix typo keys
delete EN['Selecione uma ou more competências para gerar a Janela de Johari.'];

const ES = {
  'Relatório Individual': 'Informe Individual',
  'Voltar para Lista': 'Volver a la lista',
  'Projeto (automático)': 'Proyecto (automático)',
  'Projeto (ciclo)': 'Proyecto (ciclo)',
  'Esta avaliação está em mais de um projeto ativo': 'Esta evaluación está en más de un proyecto activo',
  'Selecione para visualizar o relatório individual': 'Seleccione para visualizar el informe individual',
  'Limpar seleção': 'Limpiar selección',
  'Visualizando dados individuais': 'Visualizando datos individuales',
  'Avaliado selecionado:': 'Evaluado seleccionado:',
  'Montar': 'Montar',
  'Seções e gráficos': 'Secciones y gráficos',
  'Selecione quais competências aparecerão no relatório': 'Seleccione qué competencias aparecerán en el informe',
  'Selecione uma avaliação primeiro': 'Seleccione una evaluación primero',
  'Use o seletor acima para escolher qual avaliação 360° deseja analisar. As competências vinculadas serão carregadas automaticamente.':
    'Use el selector de arriba para elegir qué evaluación 360° desea analizar. Las competencias vinculadas se cargarán automáticamente.',
  'Configure as competências para esta avaliação': 'Configure las competencias para esta evaluación',
  'Antes de montar o relatório, é necessário vincular as perguntas da avaliação às competências. Siga os passos abaixo:':
    'Antes de montar el informe, debe vincular las preguntas de la evaluación a las competencias. Siga los pasos a continuación:',
  'Avaliação selecionada': 'Evaluación seleccionada',
  'Ir para Competências e vincular as perguntas': 'Ir a Competencias y vincular las preguntas',
  'Voltar para Relatórios': 'Volver a Informes',
  'Após salvar, volte aqui e selecione a mesma avaliação. As competências aparecerão automaticamente.':
    'Después de guardar, vuelva aquí y seleccione la misma evaluación. Las competencias aparecerán automáticamente.',
  'Ajuste quais competências aparecerão no relatório': 'Ajuste qué competencias aparecerán en el informe',
  'Clique em uma competência para ativar ou desativar. Todas estão ativas por padrão.':
    'Haga clic en una competencia para activarla o desactivarla. Todas están activas por defecto.',
  'Ative pelo menos uma competência para avançar': 'Active al menos una competencia para continuar',
  'Montar Relatório': 'Montar Informe',
  'Organize as seções, textos e gráficos do relatório': 'Organice las secciones, textos y gráficos del informe',
  'Template vinculado ao projeto': 'Plantilla vinculada al proyecto',
  'Escolha um template': 'Elija una plantilla',
  'Edite seções abaixo': 'Edite secciones abajo',
  'Visualize na aba Pré-visualizar': 'Visualice en la pestaña Vista previa',
  'Template ativo': 'Plantilla activa',
  'Definido na criação do projeto — não pode ser alterado aqui': 'Definida al crear el proyecto — no se puede cambiar aquí',
  'Selecione um template — a estrutura é aplicada automaticamente': 'Seleccione una plantilla — la estructura se aplica automáticamente',
  'Alterações não salvas': 'Cambios no guardados',
  'Nenhum template aplicado': 'Ninguna plantilla aplicada',
  'Template do projeto': 'Plantilla del proyecto',
  'Este projeto não possui template de relatório vinculado. Edite o projeto e selecione um template para habilitar PDF e DOCX.':
    'Este proyecto no tiene plantilla de informe vinculada. Edite el proyecto y seleccione una plantilla para habilitar PDF y DOCX.',
  'Solicite ao administrador master a vinculação de um template na edição do projeto.':
    'Solicite al administrador master vincular una plantilla al editar el proyecto.',
  'Template': 'Plantilla',
  'Recarrega a estrutura do template selecionado': 'Recarga la estructura de la plantilla seleccionada',
  'Reaplicar template': 'Reaplicar plantilla',
  'Grava no Firebase a estrutura atual do editor no template aplicado':
    'Guarda en Firebase la estructura actual del editor en la plantilla aplicada',
  'Salvar alterações': 'Guardar cambios',
  'Gerenciar templates…': 'Gestionar plantillas…',
  'Rascunho por avaliado (opcional)': 'Borrador por evaluado (opcional)',
  'Snapshots com competências e dados específicos': 'Instantáneas con competencias y datos específicos',
  'Salvar rascunho': 'Guardar borrador',
  'Guarda a configuração atual vinculada a um avaliado': 'Guarda la configuración actual vinculada a un evaluado',
  'Nome do rascunho': 'Nombre del borrador',
  'Ex: Relatório João Silva': 'Ej.: Informe Juan Pérez',
  'Vinculado ao template:': 'Vinculado a la plantilla:',
  'Sem template aplicado — aplique um template acima antes de salvar':
    'Sin plantilla aplicada — aplique una plantilla arriba antes de guardar',
  'Carregar rascunho salvo': 'Cargar borrador guardado',
  'Selecione e clique em Carregar — não carrega automaticamente':
    'Seleccione y haga clic en Cargar — no carga automáticamente',
  'Rascunho salvo': 'Borrador guardado',
  'Carregar rascunho': 'Cargar borrador',
  'Atualizar rascunho': 'Actualizar borrador',
  'Restaurar estrutura padrão': 'Restaurar estructura predeterminada',
  'Descarta seções atuais e volta ao layout inicial': 'Descarta secciones actuales y vuelve al diseño inicial',
  'Introdução': 'Introducción',
  'Análise Detalhada': 'Análisis Detallado',
  'Visualizar e Exportar': 'Visualizar y Exportar',
  'Relatório não publicado': 'Informe no publicado',
  'Relatório publicado': 'Informe publicado',
  'Avaliadores incluídos': 'Evaluadores incluidos',
  'Configure as competências primeiro': 'Configure las competencias primero',
  'Relatório aguardando publicação': 'Informe en espera de publicación',
  'Competências analisadas:': 'Competencias analizadas:',
  'Selecione uma ou mais competências na aba "Montar Relatório" para visualizar a tabela.':
    'Seleccione una o más competencias en la pestaña "Montar Informe" para ver la tabla.',
  'Selecione uma ou mais competências na aba "Montar Relatório" para visualizar as tabelas detalhadas.':
    'Seleccione una o más competencias en la pestaña "Montar Informe" para ver las tablas detalladas.',
  'Selecione uma ou mais competências para gerar o gráfico.':
    'Seleccione una o más competencias para generar el gráfico.',
  'Selecione uma ou mais competências para gerar a Janela de Johari.':
    'Seleccione una o más competencias para generar la Ventana de Johari.',
  'Competências para a tabela': 'Competencias para la tabla',
  'Selecione as competências que devem aparecer na tabela de frequência.':
    'Seleccione las competencias que deben aparecer en la tabla de frecuencia.',
  'Competências para tabela detalhada': 'Competencias para tabla detallada',
  'Selecione as competências para exibir na tabela de distribuição de notas (1-5).':
    'Seleccione las competencias para la tabla de distribución de notas (1-5).',
  'Competências para o Gráfico de Defasagem': 'Competencias para el Gráfico de Brecha',
  'Selecione as competências que devem aparecer no gráfico.':
    'Seleccione las competencias que deben aparecer en el gráfico.',
  'Configuração da Janela de Johari': 'Configuración de la Ventana de Johari',
  'A Janela de Johari classifica as competências em quatro quadrantes com base na autoavaliação e na avaliação dos outros. Selecione as competências que você deseja incluir nesta análise. O gráfico será gerado automaticamente.':
    'La Ventana de Johari clasifica las competencias en cuatro cuadrantes según la autoevaluación y la evaluación de otros. Seleccione las competencias a incluir. El gráfico se generará automáticamente.',
  'Sobre a Tabela de Distribuição': 'Sobre la Tabla de Distribución',
  'Esta tabela mostra a contagem de respostas para cada nota (1-5) por categoria de avaliador, similar ao formato de frequência mostrado na imagem de exemplo. Cada competência selecionada gerará uma tabela completa com todas as suas perguntas.':
    'Esta tabla muestra el conteo de respuestas para cada nota (1-5) por categoría de evaluador. Cada competencia seleccionada generará una tabla completa con todas sus preguntas.',
  'Formulário carregado automaticamente': 'Formulario cargado automáticamente',
  'Configure': 'Configure',
  'ativa': 'activa',
  'ativas': 'activas',
  'Construtor de Relatórios': 'Constructor de Informes',
  'Todas': 'Todas',
  'Não salvo': 'No guardado',
  'Salvo': 'Guardado',
  'Nenhum template ou relatório carregado': 'Ninguna plantilla o informe cargado',
  'Configurar cabeçalho, rodapé e layout do documento': 'Configurar encabezado, pie y diseño del documento',
  'Documento': 'Documento',
  'Carregue um template ou relatório acima para salvar': 'Cargue una plantilla o informe arriba para guardar',
  'Salvar em:': 'Guardar en:',
  'Componentes': 'Componentes',
  'Estrutura do Relatório': 'Estructura del Informe',
  'seção(ões)': 'sección(es)',
  'Visualizar preview': 'Ver vista previa',
  'Nenhuma seção adicionada': 'Ninguna sección agregada',
  'Arraste componentes da barra lateral ou clique neles para adicionar ao relatório':
    'Arrastre componentes de la barra lateral o haga clic para agregarlos al informe',
  'Capa': 'Portada',
  'Página inicial do relatório': 'Página inicial del informe',
  'Texto introdutório': 'Texto introductorio',
  'Resumo Executivo': 'Resumen Ejecutivo',
  'Top competências e áreas de desenvolvimento': 'Principales competencias y áreas de desarrollo',
  'Gráfico de Barras': 'Gráfico de Barras',
  'Comparação por categorias': 'Comparación por categorías',
  'Gráfico Radar': 'Gráfico Radar',
  'Comparação múltipla': 'Comparación múltiple',
  'Gráfico Pizza': 'Gráfico Circular',
  'Distribuição percentual': 'Distribución porcentual',
  'Tabela de Frequência': 'Tabla de Frecuencia',
  'Dados tabulares simples': 'Datos tabulares simples',
  'Tabela de Distribuição': 'Tabla de Distribución',
  'Distribuição de notas por categoria': 'Distribución de notas por categoría',
  'Análise por pergunta': 'Análisis por pregunta',
  'Destaques': 'Destacados',
  'Pontos fortes e áreas de desenvolvimento': 'Fortalezas y áreas de desarrollo',
  'Gráfico de Defasagem': 'Gráfico de Brecha',
  'Gap entre autoavaliação e outros': 'Brecha entre autoevaluación y otros',
  'Janela de Johari': 'Ventana de Johari',
  'Análise de percepção': 'Análisis de percepción',
  'Texto Livre': 'Texto Libre',
  'Seção de texto customizado': 'Sección de texto personalizado',
  'Perguntas Abertas': 'Preguntas Abiertas',
  'Respostas às perguntas: continuar, parar e começar a fazer':
    'Respuestas a las preguntas: continuar, dejar de hacer y empezar a hacer',
  'Básico': 'Básico',
  'Gráficos': 'Gráficos',
  'Tabelas': 'Tablas',
  'Análise': 'Análisis',
  'Cores Sólidas': 'Colores Sólidos',
  'Ir para Competências': 'Ir a Competencias',
  'Na página de Competências, selecione a mesma avaliação': 'En la página de Competencias, seleccione la misma evaluación',
  'crie ou edite os grupos de competências vinculando as perguntas do formulário, e clique em Salvar.':
    'cree o edite grupos de competencias vinculando las preguntas del formulario y haga clic en Guardar.',
  'Ativar todas': 'Activar todas',
  'Desativar todas': 'Desactivar todas',
  'Ativar todas as competências': 'Activar todas las competencias',
  'Desativar todas as competências': 'Desactivar todas las competencias',
  'Criar / editar competências': 'Crear / editar competencias',
  'Ativa': 'Activa',
  'Inativa': 'Inactiva',
  'Questões vinculadas a esta competência:': 'Preguntas vinculadas a esta competencia:',
  'Nenhuma questão vinculada ainda. Acesse a página de Competências para vincular perguntas.':
    'Ninguna pregunta vinculada aún. Vaya a la página de Competencias para vincular preguntas.',
  'Editar projeto': 'Editar proyecto',
  'Remover seleção': 'Quitar selección',
  'Limpar e resetar': 'Limpiar y restablecer',
  'Visualizar Relatório': 'Visualizar Informe',
  'Pré-visualize o relatório e exporte em PDF ou DOCX': 'Previsualice el informe y exporte en PDF o DOCX',
  'Publique para que o visualizador tenha acesso.': 'Publique para que el visualizador tenga acceso.',
  'O visualizador já tem acesso a esta versão.': 'El visualizador ya tiene acceso a esta versión.',
  'Sem título': 'Sin título',
  'Salvar': 'Guardar',
  '— Selecione um projeto —': '— Seleccione un proyecto —',
};

function merge(pathFile, manual) {
  const data = JSON.parse(fs.readFileSync(pathFile, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(manual)) {
    if (data[k] !== v) {
      data[k] = v;
      n++;
    }
  }
  const sorted = Object.keys(data)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
  fs.writeFileSync(pathFile, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  return n;
}

const ptPath = path.join(__dirname, '../src/assets/i18n/pt-BR.json');
const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
let ptN = 0;
for (const k of Object.keys(EN)) {
  if (pt[k] === undefined) {
    pt[k] = k;
    ptN++;
  }
}
fs.writeFileSync(
  ptPath,
  JSON.stringify(
    Object.keys(pt)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .reduce((acc, key) => {
        acc[key] = pt[key];
        return acc;
      }, {}),
    null,
    2
  ) + '\n',
  'utf8'
);

console.log('pt-BR added', ptN);
console.log('en updated', merge(path.join(__dirname, '../src/assets/i18n/en.json'), EN));
console.log('es updated', merge(path.join(__dirname, '../src/assets/i18n/es.json'), ES));
