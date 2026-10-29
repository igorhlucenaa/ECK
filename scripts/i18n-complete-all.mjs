/**
 * Completa i18n: traduz EN/ES pendentes, preenche DE/FR a partir de EN, remove órfãos.
 * Uso: node scripts/i18n-complete-all.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N = path.join(ROOT, 'src/assets/i18n');

function load(lang) {
  return JSON.parse(fs.readFileSync(path.join(I18N, `${lang}.json`), 'utf8'));
}
function save(lang, data) {
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')));
  fs.writeFileSync(path.join(I18N, `${lang}.json`), JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

/** @type {Record<string, { en: string; es: string; de?: string; fr?: string }>} */
const TR = {
  '{{count}} relatório(s) empacotados em {{file}}!': {
    en: '{{count}} report(s) packaged in {{file}}!',
    es: '¡{{count}} informe(s) empaquetados en {{file}}!',
  },
  'Avaliação excluída com sucesso.': { en: 'Assessment deleted successfully.', es: 'Evaluación eliminada con éxito.' },
  'Avaliação não encontrada': { en: 'Assessment not found', es: 'Evaluación no encontrada' },
  'Avaliação removida com sucesso!': { en: 'Assessment removed successfully!', es: '¡Evaluación eliminada con éxito!' },
  'Avaliações adicionadas com sucesso!': { en: 'Assessments added successfully!', es: '¡Evaluaciones añadidas con éxito!' },
  'Avaliações atualizadas com sucesso!': { en: 'Assessments updated successfully!', es: '¡Evaluaciones actualizadas con éxito!' },
  'Centralize com alinhamento, altere cores no seletor, ou use Modo HTML / botão de código-fonte para layout avançado.': {
    en: 'Center with alignment, change colors in the picker, or use HTML Mode / source code for advanced layout.',
    es: 'Centre con alineación, cambie colores en el selector o use Modo HTML / código fuente para diseño avanzado.',
  },
  'Centralize textos e logos com os botões de alinhamento. Altere cores com o seletor de cor do texto ou do fundo. Para HTML avançado (rotação, layout flex), use Modo HTML ou o botão de código-fonte no editor. Placeholders: $%NOME_AVALIADO$%, $%DATA_RELATORIO$%.': {
    en: 'Center text and logos with alignment buttons. Change colors with text or background pickers. For advanced HTML (rotation, flex), use HTML Mode or the source button. Placeholders: $%NOME_AVALIADO$%, $%DATA_RELATORIO$%.',
    es: 'Centre textos y logos con los botones de alineación. Cambie colores con el selector de texto o fondo. Para HTML avanzado (rotación, flex), use Modo HTML o el botón de código fuente. Placeholders: $%NOME_AVALIADO$%, $%DATA_RELATORIO$%.',
  },
  'Cliente e projeto são opcionais para consulta': {
    en: 'Client and project are optional for lookup',
    es: 'Cliente y proyecto son opcionales para la consulta',
  },
  'Cliente não identificado. Redirecionando...': {
    en: 'Client not identified. Redirecting...',
    es: 'Cliente no identificado. Redirigiendo...',
  },
  'Cole ou edite HTML completo. O preview e o PDF respeitarão tags, estilos inline, imagens e transformações CSS.': {
    en: 'Paste or edit full HTML. Preview and PDF will respect tags, inline styles, images, and CSS transforms.',
    es: 'Pegue o edite HTML completo. La vista previa y el PDF respetarán etiquetas, estilos inline, imágenes y transformaciones CSS.',
  },
  'Configure as competências antes de gerar relatórios.': {
    en: 'Configure competencies before generating reports.',
    es: 'Configure las competencias antes de generar informes.',
  },
  'Configure o formulário em Projetos → Editar projeto': {
    en: 'Configure the form under Projects → Edit project',
    es: 'Configure el formulario en Proyectos → Editar proyecto',
  },
  'Créditos insuficientes para importar o avaliado.': {
    en: 'Insufficient credits to import the evaluatee.',
    es: 'Créditos insuficientes para importar al evaluado.',
  },
  'Definir a senha de login (Auth) para {{email}}? A senha usada será a configurada em qaDefaultPassword no ambiente de dev.': {
    en: 'Set login password (Auth) for {{email}}? The password will be the one configured in qaDefaultPassword in dev.',
    es: '¿Definir la contraseña de acceso (Auth) para {{email}}? Se usará la configurada en qaDefaultPassword en dev.',
  },
  'Erro ao abrir relatório. Tente novamente.': { en: 'Error opening report. Try again.', es: 'Error al abrir el informe. Inténtelo de nuevo.' },
  'Erro ao carregar avaliação': { en: 'Error loading assessment', es: 'Error al cargar la evaluación' },
  'Erro ao carregar avaliação.': { en: 'Error loading assessment.', es: 'Error al cargar la evaluación.' },
  'Erro ao carregar avaliações': { en: 'Error loading assessments', es: 'Error al cargar evaluaciones' },
  'Erro ao carregar avaliações disponíveis.': { en: 'Error loading available assessments.', es: 'Error al cargar evaluaciones disponibles.' },
  'Erro ao carregar competências': { en: 'Error loading competencies', es: 'Error al cargar competencias' },
  'Erro ao carregar grupos de competências': { en: 'Error loading competency groups', es: 'Error al cargar grupos de competencias' },
  'Erro ao carregar lista de avaliações': { en: 'Error loading assessment list', es: 'Error al cargar la lista de evaluaciones' },
  'Erro ao carregar os usuários.': { en: 'Error loading users.', es: 'Error al cargar los usuarios.' },
  'Erro ao carregar pré-visualização.': { en: 'Error loading preview.', es: 'Error al cargar la vista previa.' },
  'Erro ao carregar questionário.': { en: 'Error loading questionnaire.', es: 'Error al cargar el cuestionario.' },
  'Erro ao definir senha. Verifique se a função setUserPasswordByMaster está publicada.': {
    en: 'Error setting password. Check that setUserPasswordByMaster is deployed.',
    es: 'Error al definir la contraseña. Verifique que setUserPasswordByMaster esté publicada.',
  },
  'Erro ao excluir avaliação.': { en: 'Error deleting assessment.', es: 'Error al eliminar la evaluación.' },
  'Erro ao gerar formulário a partir das competências': {
    en: 'Error generating form from competencies',
    es: 'Error al generar formulario a partir de las competencias',
  },
  'Erro ao gerar PDF do formulário.': { en: 'Error generating form PDF.', es: 'Error al generar PDF del formulario.' },
  'Erro ao obter dados do usuário.': { en: 'Error fetching user data.', es: 'Error al obtener datos del usuario.' },
  'Erro ao obter informações do usuário.': { en: 'Error fetching user information.', es: 'Error al obtener información del usuario.' },
  'Erro ao salvar questionário.': { en: 'Error saving questionnaire.', es: 'Error al guardar el cuestionario.' },
  'Erro: ID da avaliação não fornecido': { en: 'Error: assessment ID not provided', es: 'Error: ID de evaluación no proporcionado' },
  'Este participante ainda não respondeu.': { en: 'This participant has not responded yet.', es: 'Este participante aún no ha respondido.' },
  'Este participante já possui acesso como visualizador.': {
    en: 'This participant already has viewer access.',
    es: 'Este participante ya tiene acceso como visualizador.',
  },
  'Formulário atualizado com sucesso!': { en: 'Form updated successfully!', es: '¡Formulario actualizado con éxito!' },
  'Formulário criado com sucesso!': { en: 'Form created successfully!', es: '¡Formulario creado con éxito!' },
  'Formulário definido na criação do projeto': {
    en: 'Form set when the project was created',
    es: 'Formulario definido al crear el proyecto',
  },
  'Informe um nome e selecione ao menos uma competência.': {
    en: 'Enter a name and select at least one competency.',
    es: 'Indique un nombre y seleccione al menos una competencia.',
  },
  'Já existe um grupo com este nome para o cliente selecionado. Escolha outro nome.': {
    en: 'A group with this name already exists for the selected client. Choose another name.',
    es: 'Ya existe un grupo con este nombre para el cliente seleccionado. Elija otro nombre.',
  },
  'Link de avaliação enviado com sucesso!': { en: 'Assessment link sent successfully!', es: '¡Enlace de evaluación enviado con éxito!' },
  'Modelo de e-mail não encontrado.': { en: 'Email template not found.', es: 'Modelo de correo no encontrado.' },
  'Não foi possível identificar o avaliado para exportar.': {
    en: 'Could not identify the evaluatee to export.',
    es: 'No fue posible identificar al evaluado para exportar.',
  },
  'Não há resultados elegíveis para esta avaliação.': {
    en: 'There are no eligible results for this assessment.',
    es: 'No hay resultados elegibles para esta evaluación.',
  },
  'Não há resultados para esta avaliação.': { en: 'There are no results for this assessment.', es: 'No hay resultados para esta evaluación.' },
  'Nenhum participante válido encontrado na planilha.': {
    en: 'No valid participants found in the spreadsheet.',
    es: 'No se encontraron participantes válidos en la hoja.',
  },
  'Nenhuma competência encontrada para o grupo \\': { en: 'No competencies found for group ', es: 'No se encontraron competencias para el grupo ' },
  'O prazo de preenchimento não pode ser uma data anterior a hoje.': {
    en: 'The completion deadline cannot be before today.',
    es: 'El plazo de respuesta no puede ser anterior a hoy.',
  },
  'Ocultar bloco automático de avaliado/respondentes no preview': {
    en: 'Hide automatic evaluatee/respondents block in preview',
    es: 'Ocultar bloque automático de evaluado/encuestados en la vista previa',
  },
  'Operação não permitida.': { en: 'Operation not allowed.', es: 'Operación no permitida.' },
  'Participante não tem e-mail cadastrado.': { en: 'Participant has no email on file.', es: 'El participante no tiene correo registrado.' },
  'Participantes excluídos com sucesso!': { en: 'Participants deleted successfully!', es: '¡Participantes eliminados con éxito!' },
  'PDF do formulário baixado com sucesso.': { en: 'Form PDF downloaded successfully.', es: 'PDF del formulario descargado con éxito.' },
  'Pergunta criada e adicionada à avaliação com sucesso!': {
    en: 'Question created and added to the assessment successfully!',
    es: '¡Pregunta creada y añadida a la evaluación con éxito!',
  },
  'Pergunta não encontrada na avaliação': { en: 'Question not found in assessment', es: 'Pregunta no encontrada en la evaluación' },
  'Preencha todos os campos obrigatórios': { en: 'Fill in all required fields', es: 'Complete todos los campos obligatorios' },
  'Preencha todos os campos obrigatórios!': { en: 'Fill in all required fields!', es: '¡Complete todos los campos obligatorios!' },
  'Preencha todos os campos obrigatórios.': { en: 'Fill in all required fields.', es: 'Complete todos los campos obligatorios.' },
  'Projeto concluído com sucesso! 1 crédito debitado.': {
    en: 'Project completed successfully! 1 credit debited.',
    es: '¡Proyecto concluido con éxito! 1 crédito debitado.',
  },
  'Projeto não encontrado!': { en: 'Project not found!', es: '¡Proyecto no encontrado!' },
  'Questionário não encontrado.': { en: 'Questionnaire not found.', es: 'Cuestionario no encontrado.' },
  'Relatório gerado com sucesso!': { en: 'Report generated successfully!', es: '¡Informe generado con éxito!' },
  'Relatório restaurado — continue de onde parou.': {
    en: 'Report restored — pick up where you left off.',
    es: 'Informe restaurado — continúe donde lo dejó.',
  },
  'Selecione pelo menos uma competência para gerar o relatório.': {
    en: 'Select at least one competency to generate the report.',
    es: 'Seleccione al menos una competencia para generar el informe.',
  },
  'Selecione um Formulário (Avaliação) para gerar o relatório.': {
    en: 'Select a form (assessment) to generate the report.',
    es: 'Seleccione un formulario (evaluación) para generar el informe.',
  },
  'Selecione uma ou mais competências para gerar a Janela de Johari.': {
    en: 'Select one or more competencies to generate the Johari Window.',
    es: 'Seleccione una o más competencias para generar la Ventana de Johari.',
  },
  'Senha definida. O usuário já pode entrar na plataforma.': {
    en: 'Password set. The user can now sign in.',
    es: 'Contraseña definida. El usuario ya puede acceder a la plataforma.',
  },
  'Upload e salvamento concluídos!': { en: 'Upload and save completed!', es: '¡Carga y guardado completados!' },
  'Você não tem permissão para esta ação.': { en: 'You do not have permission for this action.', es: 'No tiene permiso para esta acción.' },
  'Você não tem permissão para excluir este template.': {
    en: 'You do not have permission to delete this template.',
    es: 'No tiene permiso para eliminar esta plantilla.',
  },
  // HTML / UI strings (leaks)
  'Links Rápidos': { en: 'Quick links', es: 'Enlaces rápidos' },
  'Pré-visualização do Formulário': { en: 'Form preview', es: 'Vista previa del formulario' },
  'Descrição:': { en: 'Description:', es: 'Descripción:' },
  'Criado por:': { en: 'Created by:', es: 'Creado por:' },
  'Data:': { en: 'Date:', es: 'Fecha:' },
  'Este formulário não possui perguntas configuradas.': {
    en: 'This form has no questions configured.',
    es: 'Este formulario no tiene preguntas configuradas.',
  },
  'Gerando PDF do formulário...': { en: 'Generating form PDF...', es: 'Generando PDF del formulario...' },
  'Gerando PDF em página contínua (sem quebras). Aguarde...': {
    en: 'Generating continuous-page PDF (no breaks). Please wait...',
    es: 'Generando PDF en página continua (sin saltos). Espere...',
  },
  'Baixar PDF': { en: 'Download PDF', es: 'Descargar PDF' },
  'Dashboard de Avaliações': { en: 'Assessments dashboard', es: 'Panel de evaluaciones' },
  'Visualize e analise os resultados das suas avaliações': {
    en: 'View and analyze your assessment results',
    es: 'Visualice y analice los resultados de sus evaluaciones',
  },
  'Visualizações detalhadas para perguntas de matriz serão exibidas na tabela abaixo.': {
    en: 'Detailed views for matrix questions appear in the table below.',
    es: 'Las vistas detalladas de preguntas matriz se muestran en la tabla inferior.',
  },
  'Média:': { en: 'Average:', es: 'Media:' },
  'Desvio Padrão:': { en: 'Standard deviation:', es: 'Desviación estándar:' },
  'Mínimo:': { en: 'Minimum:', es: 'Mínimo:' },
  'Máximo:': { en: 'Maximum:', es: 'Máximo:' },
  'Data de Conclusão': { en: 'Completion date', es: 'Fecha de finalización' },
  'Créditos do Cliente': { en: 'Client credits', es: 'Créditos del cliente' },
  'Disponíveis': { en: 'Available', es: 'Disponibles' },
  'projetos concluídos': { en: 'completed projects', es: 'proyectos concluidos' },
  '1 crédito é reservado ao cadastrar um Avaliado e consumido ao concluir o projeto': {
    en: '1 credit is reserved when registering an evaluatee and consumed when the project completes',
    es: '1 crédito se reserva al registrar un evaluado y se consume al concluir el proyecto',
  },
  'Nome da Organização': { en: 'Organization name', es: 'Nombre de la organización' },
  'Digite o nome da organização': { en: 'Enter the organization name', es: 'Escriba el nombre de la organización' },
  'Logo da Organização': { en: 'Organization logo', es: 'Logo de la organización' },
  'Informações gerais do cliente': { en: 'General client information', es: 'Información general del cliente' },
  'Contato responsável pelo cliente': { en: 'Client contact person', es: 'Contacto responsable del cliente' },
  'Definições': { en: 'Definitions', es: 'Definiciones' },
  'Gerenciar Competências': { en: 'Manage competencies', es: 'Gestionar competencias' },
  'Configure grupos de competências e vincule perguntas para análise em relatórios': {
    en: 'Configure competency groups and link questions for report analysis',
    es: 'Configure grupos de competencias y vincule preguntas para análisis en informes',
  },
  'opcional': { en: 'optional', es: 'opcional' },
  'Vincule para usar perguntas do formulário': {
    en: 'Link to use form questions',
    es: 'Vincule para usar preguntas del formulario',
  },
  'Adicione competências': { en: 'Add competencies', es: 'Añada competencias' },
  'Clique em um grupo na barra lateral para gerenciar suas competências, ou crie um novo.': {
    en: 'Click a group in the sidebar to manage its competencies, or create a new one.',
    es: 'Haga clic en un grupo en la barra lateral para gestionar competencias o cree uno nuevo.',
  },
  'Avaliação vinculada (opcional)': { en: 'Linked assessment (optional)', es: 'Evaluación vinculada (opcional)' },
  'Vincular avaliação (opcional)': { en: 'Link assessment (optional)', es: 'Vincular evaluación (opcional)' },
  'Você já pode cadastrar competências. Vincule um formulário se quiser associar perguntas existentes às competências deste grupo.': {
    en: 'You can register competencies now. Link a form to associate existing questions with this group’s competencies.',
    es: 'Ya puede registrar competencias. Vincule un formulario para asociar preguntas existentes a las competencias de este grupo.',
  },
  'Vinculáveis': { en: 'Linkable', es: 'Vinculables' },
  'Sem competência': { en: 'No competency', es: 'Sin competencia' },
  'Preencha nome e descrição. Você pode adicionar perguntas manualmente ou vincular uma avaliação depois.': {
    en: 'Fill in name and description. Add questions manually or link an assessment later.',
    es: 'Complete nombre y descripción. Añada preguntas manualmente o vincule una evaluación después.',
  },
  'Preencha os dados e vincule as perguntas do formulário': {
    en: 'Fill in the details and link form questions',
    es: 'Complete los datos y vincule las preguntas del formulario',
  },
  'Nome da Competência': { en: 'Competency name', es: 'Nombre de la competencia' },
  'Crie perguntas manualmente ou vincule uma avaliação depois': {
    en: 'Create questions manually or link an assessment later',
    es: 'Cree preguntas manualmente o vincule una evaluación después',
  },
  'Questões Vinculadas': { en: 'Linked questions', es: 'Preguntas vinculadas' },
  'Competências do Grupo': { en: 'Group competencies', es: 'Competencias del grupo' },
  'Nenhuma competência cadastrada': { en: 'No competencies registered', es: 'Ninguna competencia registrada' },
  'Clique em "Nova Competência" para começar.': { en: 'Click "New competency" to get started.', es: 'Haga clic en "Nueva competencia" para comenzar.' },
  'Vincule a uma competência para incluir nos gráficos': {
    en: 'Link to a competency to include in charts',
    es: 'Vincule a una competencia para incluir en los gráficos',
  },
  'Aparecerão no relatório': { en: 'Will appear in the report', es: 'Aparecerán en el informe' },
  'Questionários do Projeto': { en: 'Project questionnaires', es: 'Cuestionarios del proyecto' },
  'Competência': { en: 'Competency', es: 'Competencia' },
  'Autoavaliação': { en: 'Self-assessment', es: 'Autoevaluación' },
  'Análise de defasagem': { en: 'Gap analysis', es: 'Análisis de brecha' },
  'Média das demais avaliações': { en: 'Average of other assessments', es: 'Media de las demás evaluaciones' },
  'Avaliadores incluídos': { en: 'Evaluators included', es: 'Evaluadores incluidos' },
  'Configure as competências primeiro': { en: 'Configure competencies first', es: 'Configure las competencias primero' },
  'Relatório aguardando publicação': { en: 'Report awaiting publication', es: 'Informe pendiente de publicación' },
  'Pág. ': { en: 'Page ', es: 'Pág. ' },
  'Média': { en: 'Average', es: 'Media' },
  'Nenhuma competência selecionada ou sem dados.': {
    en: 'No competency selected or no data.',
    es: 'Ninguna competencia seleccionada o sin datos.',
  },
  'Competências analisadas:': { en: 'Competencies analyzed:', es: 'Competencias analizadas:' },
  'Nenhuma competência selecionada para exibir gráficos.': {
    en: 'No competency selected to display charts.',
    es: 'Ninguna competencia seleccionada para mostrar gráficos.',
  },
  'Média sem autoavaliação': { en: 'Average excluding self-assessment', es: 'Media sin autoevaluación' },
  'Selecione uma ou mais competências na aba "Montar Relatório" para visualizar a tabela.': {
    en: 'Select one or more competencies in the "Build report" tab to view the table.',
    es: 'Seleccione una o más competencias en la pestaña "Armar informe" para ver la tabla.',
  },
  'Importante:': { en: 'Important:', es: 'Importante:' },
  'A opção "Sem dados" não é exibida no relatório exportado.': {
    en: 'The "No data" option is not shown in the exported report.',
    es: 'La opción "Sin datos" no se muestra en el informe exportado.',
  },
  'Selecione uma ou mais competências na aba "Montar Relatório" para visualizar as tabelas detalhadas.': {
    en: 'Select one or more competencies in the "Build report" tab to view detailed tables.',
    es: 'Seleccione una o más competencias en la pestaña "Armar informe" para ver las tablas detalladas.',
  },
  'Avaliações mais altas': { en: 'Highest ratings', es: 'Evaluaciones más altas' },
  'Avaliações mais baixas': { en: 'Lowest ratings', es: 'Evaluaciones más bajas' },
  'Classificação': { en: 'Rank', es: 'Clasificación' },
  'Pontuação do(a) Avaliado(a)': { en: 'Evaluatee score', es: 'Puntuación del evaluado' },
  'Pontuação sem autoavaliação': { en: 'Score excluding self-assessment', es: 'Puntuación sin autoevaluación' },
  'Nenhum dado disponível para gerar as tabelas de avaliações. Certifique-se de que há competências cadastradas e dados de resposta.': {
    en: 'No data available to build rating tables. Ensure competencies and response data exist.',
    es: 'No hay datos para generar las tablas de evaluaciones. Verifique competencias y respuestas.',
  },
  'Selecione uma ou mais competências para gerar o gráfico.': {
    en: 'Select one or more competencies to generate the chart.',
    es: 'Seleccione una o más competencias para generar el gráfico.',
  },
  'Selecione uma ou mais competências para gerar a Janela de Johari.': {
    en: 'Select one or more competencies to generate the Johari Window.',
    es: 'Seleccione una o más competencias para generar la Ventana de Johari.',
  },
  'Gestão / Grupos': { en: 'Management / Groups', es: 'Gestión / Grupos' },
  'Informações e membros do grupo de usuários': {
    en: 'User group information and members',
    es: 'Información y miembros del grupo de usuarios',
  },
  'Informações do Grupo': { en: 'Group information', es: 'Información del grupo' },
  'Dados cadastrais do grupo de usuários': { en: 'User group profile data', es: 'Datos del grupo de usuarios' },
  'Usuário': { en: 'User', es: 'Usuario' },
  'Grupo não encontrado': { en: 'Group not found', es: 'Grupo no encontrado' },
  'Gestão / Usuários': { en: 'Management / Users', es: 'Gestión / Usuarios' },
  'Informações detalhadas do usuário': { en: 'Detailed user information', es: 'Información detallada del usuario' },
  'Dados cadastrais do usuário': { en: 'User profile data', es: 'Datos del usuario' },
  'Status de Notificação': { en: 'Notification status', es: 'Estado de notificación' },
  'Vínculos': { en: 'Links', es: 'Vínculos' },
  'Grupos e projetos aos quais o usuário pertence': {
    en: 'Groups and projects the user belongs to',
    es: 'Grupos y proyectos a los que pertenece el usuario',
  },
  'Usuário não encontrado': { en: 'User not found', es: 'Usuario no encontrado' },
  'Esta ação <strong>não pode ser desfeita</strong>.': {
    en: 'This action <strong>cannot be undone</strong>.',
    es: 'Esta acción <strong>no se puede deshacer</strong>.',
  },
  'Não é possível excluir': { en: 'Cannot delete', es: 'No es posible eliminar' },
  'Crítica': { en: 'Critical', es: 'Crítica' },
  'Crítico': { en: 'Critical', es: 'Crítico' },
  'Gráficos': { en: 'Charts', es: 'Gráficos' },
  'Mínimo 3 caracteres': { en: 'Minimum 3 characters', es: 'Mínimo 3 caracteres' },
  'Mínimo 6 caracteres': { en: 'Minimum 6 characters', es: 'Mínimo 6 caracteres' },
  'Verificando vínculos existentes...': { en: 'Checking existing links...', es: 'Verificando vínculos existentes...' },
  'Vínculo': { en: 'Link', es: 'Vínculo' },
  'Sáb': { en: 'Sat', es: 'Sáb' },
  Créditos: { en: 'Credits', es: 'Créditos' },
  'Tipo de gráfico': { en: 'Chart type', es: 'Tipo de gráfico' },
  'Nenhum dado disponível para gerar as tabelas de avaliações. Certifique-se de que há competências cadastradas e dados de avaliação carregados.':
    {
      en: 'No data available to build rating tables. Ensure competencies are registered and assessment data is loaded.',
      es: 'No hay datos para generar las tablas de evaluaciones. Verifique competencias registradas y datos de evaluación cargados.',
    },
  'Pontuação média sem autoavaliação': {
    en: 'Average score excluding self-assessment',
    es: 'Puntuación media sin autoevaluación',
  },
  'Pág.': { en: 'Page', es: 'Pág.' },
  'Esta seção apresenta os comportamentos em que você obteve as maiores pontuações <strong>médias</strong> (com base na avaliação de todos os avaliadores). Pela perspectiva das outras pessoas, seus pontos fortes são estes padrões de comportamento específicos:':
    {
      en: 'This section shows behaviors where you received the highest <strong>average</strong> scores (based on all evaluators). From others’ perspective, your strengths are these specific behavior patterns:',
      es: 'Esta sección presenta los comportamientos con las puntuaciones <strong>medias</strong> más altas (según todos los evaluadores). Desde la perspectiva de los demás, sus fortalezas son estos patrones de comportamiento:',
    },
  'Esta seção apresenta os comportamentos em que você obteve as menores pontuações <strong>médias</strong> (com base na avaliação de todos os avaliadores). Pela perspectiva das outras pessoas, estes são os padrões de comportamento que podem ser desenvolvidos:':
    {
      en: 'This section shows behaviors where you received the lowest <strong>average</strong> scores (based on all evaluators). From others’ perspective, these behavior patterns may be developed:',
      es: 'Esta sección presenta los comportamientos con las puntuaciones <strong>medias</strong> más bajas (según todos los evaluadores). Desde la perspectiva de los demás, estos patrones pueden desarrollarse:',
    },
  'Erro ao contar participantes respondentes.': {
    en: 'Error counting respondents.',
    es: 'Error al contar participantes que respondieron.',
  },
  'Erro ao abrir modal de envio.': { en: 'Error opening send modal.', es: 'Error al abrir el modal de envío.' },
  'Nenhum participante encontrado para este cliente.': {
    en: 'No participants found for this client.',
    es: 'No se encontraron participantes para este cliente.',
  },
  'Erro ao carregar participantes respondentes.': {
    en: 'Error loading respondents.',
    es: 'Error al cargar participantes que respondieron.',
  },
  'Nenhum projectId fornecido.': { en: 'No projectId provided.', es: 'No se proporcionó projectId.' },
  'Lista salva com sucesso!': { en: 'List saved successfully!', es: '¡Lista guardada con éxito!' },
  'Erro ao salvar lista.': { en: 'Error saving list.', es: 'Error al guardar la lista.' },
  'Erro ao salvar. Tente novamente.': { en: 'Error saving. Try again.', es: 'Error al guardar. Inténtelo de nuevo.' },
  'Erro ao processar dados. Tente novamente.': {
    en: 'Error processing data. Try again.',
    es: 'Error al procesar datos. Inténtelo de nuevo.',
  },
  'Buscar e Filtrar Participantes': { en: 'Search and filter participants', es: 'Buscar y filtrar participantes' },
  Comportamento: { en: 'Behavior', es: 'Comportamiento' },
};

const ORPHAN = [
  'Grupo ',
  'Grupo \\',
  'Nenhuma competência encontrada para o grupo ',
  'Nenhuma competência encontrada para o grupo \\',
  'Tem certeza de que deseja excluir o grupo ',
  'Tem certeza de que deseja excluir o grupo \\',
  'Tem certeza de que deseja excluir o usuário ',
  'Esta ação',
  'não pode ser desfeita',
  'médias',
  ', você foi convidado(a) a avaliar',
  'Comportamento',
  'Pág.',
];

const pt = load('pt-BR');
let en = load('en');
let es = load('es');
let de = load('de');
let fr = load('fr');

for (const k of ORPHAN) {
  delete pt[k];
  delete en[k];
  delete es[k];
  delete de[k];
  delete fr[k];
}

let applied = 0;
for (const [key, tr] of Object.entries(TR)) {
  if (!(key in pt)) pt[key] = key;
  en[key] = tr.en;
  es[key] = tr.es;
  applied++;
}

const ptKeys = Object.keys(pt);
for (const key of ptKeys) {
  if (!(key in en)) en[key] = pt[key];
  if (!(key in es)) es[key] = en[key] ?? pt[key];
}

for (const key of ptKeys) {
  if (!(key in de)) de[key] = en[key] ?? pt[key];
  if (!(key in fr)) fr[key] = en[key] ?? pt[key];
}

for (const key of Object.keys({ ...de })) {
  if (!(key in pt)) delete de[key];
}
for (const key of Object.keys({ ...fr })) {
  if (!(key in pt)) delete fr[key];
}

save('pt-BR', pt);
save('en', en);
save('es', es);
save('de', de);
save('fr', fr);

const ptAccent = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/;
const enStill = ptKeys.filter((k) => ptAccent.test(k) && en[k] === pt[k]).length;
const esStill = ptKeys.filter((k) => ptAccent.test(k) && es[k] === pt[k]).length;

console.log(`Applied ${applied} translation entries.`);
console.log(`Keys: pt=${ptKeys.length} en=${Object.keys(en).length} es=${Object.keys(es).length} de=${Object.keys(de).length} fr=${Object.keys(fr).length}`);
console.log(`EN still identical to PT (accent keys): ${enStill}`);
console.log(`ES still identical to PT (accent keys): ${esStill}`);
