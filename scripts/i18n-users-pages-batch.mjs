/**
 * i18n batch for users/clients/project/competencies/assessments/email pages.
 */
import fs from 'fs';
import path from 'path';

const repo = path.resolve(import.meta.dirname, '..');
const i18nDir = path.join(repo, 'src/assets/i18n');

/** @type {Record<string, { en: string; es: string }>} */
const phrases = {
  'Novo Usuário': { en: 'New User', es: 'Nuevo Usuario' },
  'Atualize os dados do usuário': { en: 'Update user details', es: 'Actualice los datos del usuario' },
  'Preencha os dados para criar um novo usuário': {
    en: 'Fill in the details to create a new user',
    es: 'Complete los datos para crear un nuevo usuario',
  },
  'Digite o sobrenome': { en: 'Enter surname', es: 'Escriba el apellido' },
  'Nome é obrigatório': { en: 'Name is required', es: 'El nombre es obligatorio' },
  'Sobrenome é obrigatório': { en: 'Surname is required', es: 'El apellido es obligatorio' },
  'E-mail é obrigatório': { en: 'Email is required', es: 'El correo es obligatorio' },
  'Digite um e-mail válido': { en: 'Enter a valid email', es: 'Escriba un correo válido' },
  'Este e-mail já está cadastrado na plataforma': {
    en: 'This email is already registered on the platform',
    es: 'Este correo ya está registrado en la plataforma',
  },
  'Este e-mail pertence a um usuário inativo. Reative o cadastro existente ou use outro e-mail': {
    en: 'This email belongs to an inactive user. Reactivate the existing account or use another email',
    es: 'Este correo pertenece a un usuario inactivo. Reactive el registro existente o use otro correo',
  },
  'O e-mail não pode ser alterado': { en: 'Email cannot be changed', es: 'El correo no puede modificarse' },
  'Papel / Perfil': { en: 'Role / Profile', es: 'Rol / Perfil' },
  'Papel é obrigatório': { en: 'Role is required', es: 'El rol es obligatorio' },
  'Selecione um ou mais clientes': { en: 'Select one or more clients', es: 'Seleccione uno o más clientes' },
  'Selecione pelo menos um cliente': { en: 'Select at least one client', es: 'Seleccione al menos un cliente' },
  'Filtrar grupos por cliente': { en: 'Filter groups by client', es: 'Filtrar grupos por cliente' },
  'Use para filtrar a lista de grupos abaixo': {
    en: 'Use to filter the group list below',
    es: 'Use para filtrar la lista de grupos abajo',
  },
  'Grupo(s) *': { en: 'Group(s) *', es: 'Grupo(s) *' },
  'Carregando grupos…': { en: 'Loading groups…', es: 'Cargando grupos…' },
  'O acesso ao cliente e aos projetos vem do grupo selecionado': {
    en: 'Client and project access comes from the selected group',
    es: 'El acceso al cliente y proyectos proviene del grupo seleccionado',
  },
  'Selecione pelo menos um grupo': { en: 'Select at least one group', es: 'Seleccione al menos un grupo' },
  'Cliente:': { en: 'Client:', es: 'Cliente:' },
  'Projetos com acesso:': { en: 'Projects with access:', es: 'Proyectos con acceso:' },
  'Carregando usuário...': { en: 'Loading user...', es: 'Cargando usuario...' },
  'Perfil atual': { en: 'Current profile', es: 'Perfil actual' },
  Master: { en: 'Master', es: 'Master' },
  'Admin Cliente': { en: 'Client Admin', es: 'Admin Cliente' },
  Visualizador: { en: 'Viewer', es: 'Visualizador' },
  'Projetos com acesso': { en: 'Projects with access', es: 'Proyectos con acceso' },
  'Alterações refletirão imediatamente no sistema': {
    en: 'Changes will take effect immediately in the system',
    es: 'Los cambios se reflejarán de inmediato en el sistema',
  },
  'Atualize os dados do usuário abaixo': {
    en: 'Update the user details below',
    es: 'Actualice los datos del usuario abajo',
  },
  Identificação: { en: 'Identification', es: 'Identificación' },
  Acesso: { en: 'Access', es: 'Acceso' },
  'Vínculo com Cliente': { en: 'Client link', es: 'Vínculo con cliente' },
  'Grupos de Acesso': { en: 'Access groups', es: 'Grupos de acceso' },
  'Defina os grupos que este viewer pertence': {
    en: 'Define the groups this viewer belongs to',
    es: 'Defina los grupos a los que pertenece este visualizador',
  },
  'Salvar alterações': { en: 'Save changes', es: 'Guardar cambios' },
  'Carregando grupo...': { en: 'Loading group...', es: 'Cargando grupo...' },
  'Grupo de usuários': { en: 'User group', es: 'Grupo de usuarios' },
  'Projetos vinculados': { en: 'Linked projects', es: 'Proyectos vinculados' },
  projeto: { en: 'project', es: 'proyecto' },
  projetos: { en: 'projects', es: 'proyectos' },
  'Membros selecionados': { en: 'Selected members', es: 'Miembros seleccionados' },
  membro: { en: 'member', es: 'miembro' },
  membros: { en: 'members', es: 'miembros' },
  'Atualize os dados e membros do grupo abaixo': {
    en: 'Update group details and members below',
    es: 'Actualice los datos y miembros del grupo abajo',
  },
  'Nome do Grupo': { en: 'Group name', es: 'Nombre del grupo' },
  'Ex: Líderes de Projetos': { en: 'E.g. Project Leaders', es: 'Ej.: Líderes de proyectos' },
  'Descreva o propósito deste grupo': {
    en: 'Describe the purpose of this group',
    es: 'Describa el propósito de este grupo',
  },
  'Cliente é obrigatório': { en: 'Client is required', es: 'El cliente es obligatorio' },
  Vínculo: { en: 'Link', es: 'Vínculo' },
  'Acesso a Projetos': { en: 'Project access', es: 'Acceso a proyectos' },
  'Todos os projetos do cliente': { en: 'All client projects', es: 'Todos los proyectos del cliente' },
  'Novos projetos entram automaticamente': {
    en: 'New projects are included automatically',
    es: 'Los nuevos proyectos se incluyen automáticamente',
  },
  'Projetos com Acesso': { en: 'Projects with access', es: 'Proyectos con acceso' },
  'Nenhum projeto encontrado para este cliente': {
    en: 'No projects found for this client',
    es: 'No se encontraron proyectos para este cliente',
  },
  'Selecione um cliente para carregar projetos': {
    en: 'Select a client to load projects',
    es: 'Seleccione un cliente para cargar proyectos',
  },
  'Viewers terão acesso apenas a estes projetos · {{count}} selecionado(s)': {
    en: 'Viewers will only access these projects · {{count}} selected',
    es: 'Los visualizadores solo accederán a estos proyectos · {{count}} seleccionado(s)',
  },
  'Viewers do grupo terão acesso apenas a estes projetos · {{count}} selecionado(s)': {
    en: 'Group viewers will only access these projects · {{count}} selected',
    es: 'Los visualizadores del grupo solo accederán a estos proyectos · {{count}} seleccionado(s)',
  },
  'Acesso a todos os projetos presentes e futuros do cliente': {
    en: 'Access to all current and future client projects',
    es: 'Acceso a todos los proyectos actuales y futuros del cliente',
  },
  Membros: { en: 'Members', es: 'Miembros' },
  'Usuários do Grupo': { en: 'Group users', es: 'Usuarios del grupo' },
  'Selecione um cliente para carregar usuários': {
    en: 'Select a client to load users',
    es: 'Seleccione un cliente para cargar usuarios',
  },
  '{{count}} usuário(s) selecionado(s)': {
    en: '{{count}} user(s) selected',
    es: '{{count}} usuario(s) seleccionado(s)',
  },
  'Editar Grupo': { en: 'Edit Group', es: 'Editar Grupo' },
  'Novo Grupo de Usuários': { en: 'New User Group', es: 'Nuevo Grupo de Usuarios' },
  'Atualize os dados do grupo': { en: 'Update group details', es: 'Actualice los datos del grupo' },
  'Preencha os dados para criar um novo grupo': {
    en: 'Fill in the details to create a new group',
    es: 'Complete los datos para crear un nuevo grupo',
  },
  'Criar Grupo': { en: 'Create Group', es: 'Crear Grupo' },
  'Atualize os dados do cliente': { en: 'Update client details', es: 'Actualice los datos del cliente' },
  'Preencha os dados para cadastrar um novo cliente': {
    en: 'Fill in the details to register a new client',
    es: 'Complete los datos para registrar un nuevo cliente',
  },
  'Nome da Empresa': { en: 'Company name', es: 'Nombre de la empresa' },
  'Ex: Empresa Ltda.': { en: 'E.g. Company Ltd.', es: 'Ej.: Empresa S.A.' },
  'Nome da empresa é obrigatório.': { en: 'Company name is required.', es: 'El nombre de la empresa es obligatorio.' },
  'Ex: Tecnologia, Saúde...': { en: 'E.g. Technology, Healthcare...', es: 'Ej.: Tecnología, Salud...' },
  'Nome da empresa': { en: 'Company name', es: 'Nombre de la empresa' },
  'Nome é obrigatório.': { en: 'Name is required.', es: 'El nombre es obligatorio.' },
  'E-mail inválido.': { en: 'Invalid email.', es: 'Correo inválido.' },
  'Observações...': { en: 'Notes...', es: 'Observaciones...' },
  'Função / Cargo': { en: 'Role / Job title', es: 'Función / Cargo' },
  'Ex: Diretor de RH': { en: 'E.g. HR Director', es: 'Ej.: Director de RR.HH.' },
  'Editar Questionário': { en: 'Edit Questionnaire', es: 'Editar Cuestionario' },
  'Novo Questionário': { en: 'New Questionnaire', es: 'Nuevo Cuestionario' },
  'O nome é obrigatório.': { en: 'Name is required.', es: 'El nombre es obligatorio.' },
  'O nome deve ter pelo menos 3 caracteres.': {
    en: 'Name must be at least 3 characters.',
    es: 'El nombre debe tener al menos 3 caracteres.',
  },
  'Conteúdo do Questionário': { en: 'Questionnaire content', es: 'Contenido del cuestionario' },
  'O conteúdo é obrigatório.': { en: 'Content is required.', es: 'El contenido es obligatorio.' },
  'Criar Questionário': { en: 'Create Questionnaire', es: 'Crear Cuestionario' },
  'Usuários do Projeto': { en: 'Project Users', es: 'Usuarios del Proyecto' },
  'Membros vinculados a este projeto via grupos de usuários': {
    en: 'Members linked to this project via user groups',
    es: 'Miembros vinculados a este proyecto mediante grupos de usuarios',
  },
  'Nome, e-mail ou tipo...': { en: 'Name, email or type...', es: 'Nombre, correo o tipo...' },
  Limpar: { en: 'Clear', es: 'Limpiar' },
  usuário: { en: 'user', es: 'usuario' },
  usuários: { en: 'users', es: 'usuarios' },
  'Nenhum usuário encontrado para a busca': {
    en: 'No users found for this search',
    es: 'No se encontraron usuarios para la búsqueda',
  },
  'Nenhum usuário encontrado': { en: 'No users found', es: 'No se encontraron usuarios' },
  'Este projeto não possui usuários vinculados via grupos.': {
    en: 'This project has no users linked via groups.',
    es: 'Este proyecto no tiene usuarios vinculados mediante grupos.',
  },
  'Usuários do Grupo: {{name}}': { en: 'Group users: {{name}}', es: 'Usuarios del grupo: {{name}}' },
  'Busque por nome ou e-mail': { en: 'Search by name or email', es: 'Busque por nombre o correo' },
  'Nenhum usuário encontrado para este grupo.': {
    en: 'No users found for this group.',
    es: 'No se encontraron usuarios para este grupo.',
  },
  'Editar Pergunta': { en: 'Edit Question', es: 'Editar Pregunta' },
  'Nova Pergunta': { en: 'New Question', es: 'Nueva Pregunta' },
  'Altere o título ou tipo da pergunta': {
    en: 'Change the question title or type',
    es: 'Cambie el título o tipo de la pregunta',
  },
  'Configure a nova pergunta da avaliação': {
    en: 'Configure the new assessment question',
    es: 'Configure la nueva pregunta de la evaluación',
  },
  'Título da Pergunta': { en: 'Question title', es: 'Título de la pregunta' },
  'Ex: Como você avalia sua liderança?': {
    en: 'E.g. How do you rate your leadership?',
    es: 'Ej.: ¿Cómo evalúa su liderazgo?',
  },
  'Título obrigatório': { en: 'Title is required', es: 'Título obligatorio' },
  'Mínimo 3 caracteres': { en: 'Minimum 3 characters', es: 'Mínimo 3 caracteres' },
  'Tipo de Pergunta': { en: 'Question type', es: 'Tipo de pregunta' },
  Obrigatório: { en: 'Required', es: 'Obligatorio' },
  'Título da pergunta...': { en: 'Question title...', es: 'Título de la pregunta...' },
  'Selecione uma opção': { en: 'Select an option', es: 'Seleccione una opción' },
  'Comentários...': { en: 'Comments...', es: 'Comentarios...' },
  Sim: { en: 'Yes', es: 'Sí' },
  Não: { en: 'No', es: 'No' },
  'Criar Pergunta': { en: 'Create Question', es: 'Crear Pregunta' },
  'Adicionar Pergunta': { en: 'Add Question', es: 'Agregar Pregunta' },
  'Remover opção': { en: 'Remove option', es: 'Eliminar opción' },
  'Editar Formulário': { en: 'Edit Form', es: 'Editar Formulario' },
  'Criar Formulário': { en: 'Create Form', es: 'Crear Formulario' },
  'Atualize as informações e perguntas do formulário': {
    en: 'Update form information and questions',
    es: 'Actualice la información y preguntas del formulario',
  },
  'Configure as informações e crie as perguntas da avaliação': {
    en: 'Configure details and create assessment questions',
    es: 'Configure la información y cree las preguntas de la evaluación',
  },
  'Salvar Formulário': { en: 'Save Form', es: 'Guardar Formulario' },
  'Configurações do formulário': { en: 'Form settings', es: 'Configuración del formulario' },
  'Cliente selecionado': { en: 'Client selected', es: 'Cliente seleccionado' },
  'Título do Formulário': { en: 'Form title', es: 'Título del formulario' },
  'Ex: Avaliação de Liderança 2026': { en: 'E.g. Leadership Assessment 2026', es: 'Ej.: Evaluación de Liderazgo 2026' },
  'Opcional — descreva o objetivo desta avaliação': {
    en: 'Optional — describe the purpose of this assessment',
    es: 'Opcional — describa el objetivo de esta evaluación',
  },
  'Grupo de Competências': { en: 'Competency group', es: 'Grupo de competencias' },
  '— Nenhum —': { en: '— None —', es: '— Ninguno —' },
  Misturar: { en: 'Shuffle', es: 'Mezclar' },
  'Lista salva': { en: 'Saved list', es: 'Lista guardada' },
  'Salvar como lista': { en: 'Save as list', es: 'Guardar como lista' },
  'Nome da nova lista': { en: 'New list name', es: 'Nombre de la nueva lista' },
  'Salvar lista': { en: 'Save list', es: 'Guardar lista' },
  'Construtor de Formulários': { en: 'Form Builder', es: 'Constructor de formularios' },
  'Adicione e configure as perguntas da avaliação': {
    en: 'Add and configure assessment questions',
    es: 'Agregue y configure las preguntas de la evaluación',
  },
  'Configure o conteúdo e as configurações do modelo de e-mail': {
    en: 'Configure email template content and settings',
    es: 'Configure el contenido y ajustes del modelo de correo',
  },
  'Não identificado': { en: 'Not identified', es: 'No identificado' },
  'Insira as variáveis abaixo no editor. Elas serão substituídas automaticamente no momento do envio.': {
    en: 'Insert the variables below in the editor. They will be replaced automatically when sending.',
    es: 'Inserte las variables abajo en el editor. Se reemplazarán automáticamente al enviar.',
  },
  Participante: { en: 'Participant', es: 'Participante' },
  'Nome do participante': { en: 'Participant name', es: 'Nombre del participante' },
  'Nome completo de quem receberá o e-mail.': {
    en: 'Full name of the email recipient.',
    es: 'Nombre completo de quien recibirá el correo.',
  },
  'Todos os tipos': { en: 'All types', es: 'Todos los tipos' },
  'Categoria do participante': { en: 'Participant category', es: 'Categoría del participante' },
  'Papel do participante no ciclo 360° (ex.: Avaliado, Gestor, Par, Subordinado, Outros).': {
    en: 'Participant role in the 360° cycle (e.g. Evaluatee, Manager, Peer, Subordinate, Other).',
    es: 'Rol del participante en el ciclo 360° (ej.: Evaluado, Gestor, Par, Subordinado, Otros).',
  },
  'Nome do avaliado': { en: 'Evaluatee name', es: 'Nombre del evaluado' },
  'Nome de quem está sendo avaliado (apenas em e-mails para o avaliador).': {
    en: 'Name of the person being evaluated (only in emails to evaluators).',
    es: 'Nombre de quien está siendo evaluado (solo en correos al evaluador).',
  },
  'Convite Avaliador': { en: 'Evaluator Invite', es: 'Invitación Evaluador' },
  'Lembrete Avaliador': { en: 'Evaluator Reminder', es: 'Recordatorio Evaluador' },
  'Projeto & Cliente': { en: 'Project & Client', es: 'Proyecto y Cliente' },
  'Nome do projeto': { en: 'Project name', es: 'Nombre del proyecto' },
  'Nome do projeto de avaliação selecionado.': {
    en: 'Name of the selected assessment project.',
    es: 'Nombre del proyecto de evaluación seleccionado.',
  },
  'Nome do cliente': { en: 'Client name', es: 'Nombre del cliente' },
  'Nome da empresa / cliente associado ao projeto.': {
    en: 'Company / client name associated with the project.',
    es: 'Nombre de la empresa / cliente asociado al proyecto.',
  },
  'Data de expiração': { en: 'Expiration date', es: 'Fecha de expiración' },
  'Data limite do projeto no formato DD/MM/AAAA.': {
    en: 'Project deadline in DD/MM/YYYY format.',
    es: 'Fecha límite del proyecto en formato DD/MM/AAAA.',
  },
  'Links gerados automaticamente': { en: 'Automatically generated links', es: 'Enlaces generados automáticamente' },
  'Link da avaliação': { en: 'Assessment link', es: 'Enlace de la evaluación' },
  'URL única de acesso ao formulário. Inserido automaticamente ao salvar o template.': {
    en: 'Unique URL to access the form. Inserted automatically when saving the template.',
    es: 'URL única de acceso al formulario. Se inserta automáticamente al guardar el modelo.',
  },
  Convite: { en: 'Invite', es: 'Invitación' },
  Lembrete: { en: 'Reminder', es: 'Recordatorio' },
  'Link do relatório': { en: 'Report link', es: 'Enlace del informe' },
  'URL de acesso ao relatório finalizado do participante.': {
    en: 'URL to access the participant’s finalized report.',
    es: 'URL de acceso al informe finalizado del participante.',
  },
  'Exemplo de uso no corpo do e-mail': { en: 'Example use in email body', es: 'Ejemplo de uso en el cuerpo del correo' },
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
console.log(`users-pages batch: ${Object.keys(phrases).length} keys, ${added} new slot entries`);
