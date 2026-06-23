/**
 * Aplica traduções manuais para chaves ainda em português em en/es.
 * Uso: node scripts/i18n-translate-patch.mjs
 */
import fs from 'fs';

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function sortObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')));
}

function saveJson(path, data) {
  fs.writeFileSync(path, JSON.stringify(sortObject(data), null, 2) + '\n', 'utf8');
}

const EN = {
  'Erro ao salvar grupo de competências.': 'Error saving competency group.',
  'Adicionar Usuário': 'Add User',
  'Buscar Usuário': 'Search User',
  'O nome é obrigatório.': 'First name is required.',
  'O sobrenome é obrigatório.': 'Last name is required.',
  'Digite um e-mail válido.': 'Enter a valid email.',
  'Status de Notificação': 'Notification Status',
  'Excluir Usuário': 'Delete User',
  'Adicionar Grupo de Usuários': 'Add User Group',
  'Grupo excluído com sucesso!': 'Group deleted successfully!',
  'Tem certeza de que deseja excluir o usuário "{{name}}"?':
    'Are you sure you want to delete the user "{{name}}"?',
  'Usuário excluído com sucesso!': 'User deleted successfully!',
  'Erro ao excluir usuário.': 'Error deleting user.',
  'Erro ao carregar usuários.': 'Error loading users.',
  'Erro ao carregar grupos de usuários.': 'Error loading user groups.',
  'Editar Usuário': 'Edit User',
  'Criar Novo Usuário': 'Create New User',
  'O e-mail é obrigatório.': 'Email is required.',
  'Criar Usuário': 'Create User',
  'Você não tem permissão para atribuir este papel.': 'You do not have permission to assign this role.',
  'Usuário atualizado com sucesso!': 'User updated successfully!',
  'Usuário não encontrado.': 'User not found.',
  'O usuário já existe no sistema!': 'User already exists in the system!',
  'Usuário criado com sucesso!': 'User created successfully!',
  'Erro ao atualizar usuário.': 'Error updating user.',
  'Erro ao criar usuário.': 'Error creating user.',
  'Editar Grupo de Usuários': 'Edit User Group',
  'Criar Novo Grupo de Usuários': 'Create New User Group',
  'O nome do grupo é obrigatório.': 'Group name is required.',
  'O nome do cliente é obrigatório.': 'Client name is required.',
  'Créditos Remanescentes': 'Remaining Credits',
  'Função do Representante': 'Representative Role',
  'Usuários do Cliente': 'Client Users',
  Confirmação: 'Confirmation',
  'Ao remover o cliente, todos os projetos, grupos e usuários associados também serão excluídos. Deseja continuar?':
    'Removing the client will also delete all associated projects, groups and users. Continue?',
  'Cliente e dados relacionados excluídos com sucesso.': 'Client and related data deleted successfully.',
  'Cliente não encontrado.': 'Client not found.',
  'Erro ao salvar alterações.': 'Error saving changes.',
  'Usuário adicionado com sucesso!': 'User added successfully!',
  'Erro ao adicionar usuário. Tente novamente mais tarde.': 'Error adding user. Please try again later.',
  'Gerar senha aleatória': 'Generate random password',
  'A senha é obrigatória.': 'Password is required.',
  Usuário: 'User',
  'ADM Cliente não possui permissão para editar usuários': 'Client Admin does not have permission to edit users',
  'Você não pode editar sua própria conta MASTER': 'You cannot edit your own MASTER account',
  'ADM Cliente não possui permissão para excluir usuários': 'Client Admin does not have permission to delete users',
  'Você não pode remover sua própria conta MASTER. Solicite a outro admin MASTER que realize esta ação':
    'You cannot remove your own MASTER account. Ask another MASTER admin to perform this action',
  'Você não pode excluir sua própria conta': 'You cannot delete your own account',
  'Você não pode remover sua própria conta MASTER.': 'You cannot remove your own MASTER account.',
  'Não é possível remover o único admin MASTER da plataforma.':
    'Cannot remove the only MASTER admin on the platform.',
  'Usuários excluídos com sucesso!': 'Users deleted successfully!',
  'Erro ao excluir usuários.': 'Error deleting users.',
  'Grupos excluídos com sucesso!': 'Groups deleted successfully!',
  'Você não pode remover sua própria conta MASTER. Solicite a outro admin MASTER que realize esta ação.':
    'You cannot remove your own MASTER account. Ask another MASTER admin to perform this action.',
  'Tem certeza de que deseja excluir o usuário ': 'Are you sure you want to delete the user ',
  'Erro ao carregar usuário.': 'Error loading user.',
  'Elemento do dashboard não encontrado.': 'Dashboard element not found.',
  'Preparando impressão...': 'Preparing print...',
  'Erro ao salvar usuário.': 'Error saving user.',
  'Erro ao atualizar documentos dos usuários.': 'Error updating user documents.',
  'Cliente excluído com sucesso.': 'Client deleted successfully.',
  'Clientes excluídos com sucesso.': 'Clients deleted successfully.',
  'ADM Cliente não possui permissão para criar ou editar usuários.':
    'Client Admin does not have permission to create or edit users.',
  'Acesso negado (403): ADM Cliente não pode criar ou editar usuários.':
    'Access denied (403): Client Admin cannot create or edit users.',
  'Tem certeza de que deseja cancelar este projeto? Ele não aparecerá mais no Dashboard.':
    'Are you sure you want to cancel this project? It will no longer appear on the Dashboard.',
  'Projetos excluídos com sucesso.': 'Projects deleted successfully.',
  'Tem certeza de que deseja excluir este projeto? Participantes, links e créditos reservados também serão removidos.':
    'Are you sure you want to delete this project? Participants, links and reserved credits will also be removed.',
  Usuários: 'Users',
  'Visualizar clientes vinculados e saldo de créditos': 'View linked clients and credit balance',
  'Visualizar grupos de usuários da empresa': 'View company user groups',
  'Acessar relatórios publicados pelo administrador': 'Access reports published by the administrator',
  'Não cadastra, edita ou exclui clientes': 'Cannot register, edit or delete clients',
  'Sem acesso à lista de usuários': 'No access to user list',
  'Sem acesso a formulários de avaliação': 'No access to assessment forms',
  'Ver relatórios publicados pelo administrador': 'View reports published by the administrator',
  Crédito: 'Credit',
  'Distribuição de todos os projetos por status atual': 'Distribution of all projects by current status',
  'Distribuição dos participantes da empresa': 'Distribution of company participants',
  Formulário: 'Form',
  Avaliação: 'Assessment',
  'Exibe as respostas de todos os participantes (avaliado e avaliadores) às perguntas: o que continuar, parar e começar a fazer. As respostas são agrupadas por categoria (Avaliado(a), Gestor(es), Pares, Subordinados, Outros).':
    'Shows responses from all participants to continue/stop/start questions, grouped by category.',
  'Pergunta não encontrada.': 'Question not found.',
  'Não é possível remover uma pergunta que está vinculada a uma competência.':
    'Cannot remove a question linked to a competency.',
  'Nenhum cliente disponível para exportação.': 'No client available for export.',
  'Erro ao carregar dados da avaliação. Tente novamente.': 'Error loading assessment data. Please try again.',
  'Selecione um cliente antes de salvar o relatório.': 'Select a client before saving the report.',
  'Selecione um cliente antes de atualizar o relatório.': 'Select a client before updating the report.',
  'Selecione um relatório para excluir.': 'Select a report to delete.',
  'Relatório excluído com sucesso!': 'Report deleted successfully!',
  'Erro ao excluir relatório.': 'Error deleting report.',
  'Template excluído com sucesso!': 'Template deleted successfully!',
  'Template não encontrado.': 'Template not found.',
  'Este template não possui seções salvas. Atualize o template ou crie um novo.':
    'This template has no saved sections. Update the template or create a new one.',
  'Configure as competências antes de gerar relatórios em lote.':
    'Configure competencies before generating batch reports.',
  'Nenhum projeto ativo utiliza esta avaliação.': 'No active project uses this assessment.',
  'Esta avaliação existe em mais de um projeto — selecione o ciclo desejado.':
    'This assessment exists in more than one project — select the desired cycle.',
  'Este projeto não utiliza a avaliação selecionada.': 'This project does not use the selected assessment.',
  'Apenas administradores podem liberar relatórios.': 'Only administrators can release reports.',
  'Avaliado inválido para liberação do relatório.': 'Invalid participant for report release.',
  'Selecione um cliente antes de publicar o relatório.': 'Select a client before publishing the report.',
  'Selecione uma avaliação antes de publicar o relatório.': 'Select an assessment before publishing the report.',
  'Relatório publicado com sucesso.': 'Report published successfully.',
  'Erro ao publicar relatório.': 'Error publishing report.',
  'Apenas administradores podem revogar liberação.': 'Only administrators can revoke release.',
  'Liberação de relatório revogada.': 'Report release revoked.',
  'Erro ao revogar liberação.': 'Error revoking release.',
  'Seleção de avaliado limpa.': 'Participant selection cleared.',
  'kpi.clientes_ativos': 'Active Clients',
  'kpi.projetos_ativos': 'Active Projects',
  'kpi.avaliacoes_andamento': 'Assessments in Progress',
  'kpi.participantes_ativos': 'Active Participants',
  'kpi.creditos_disponiveis': 'Available Credits',
  'alert.prazo_vencido': 'Deadline Expired',
  'alert.prazo_proximo': 'Deadline Approaching',
  'alert.sem_creditos': 'No Credits',
  'alert.vencido_descricao': 'Expired {{days}} day(s) ago — {{rate}}% responded',
  'alert.proximo_descricao': '{{days}} day(s) remaining — {{pending}} pending response(s) ({{rate}}% complete)',
  'alert.creditos_esgotados': 'Credits exhausted — place an order to continue',
  'Extrato do cliente (Excel)': 'Client statement (Excel)',
};

const ES = {
  Gráficos: 'Gráficos',
  'ADM Cliente não possui permissão para editar usuários':
    'El Admin Cliente no tiene permiso para editar usuarios',
  'Você não pode editar sua própria conta MASTER': 'No puede editar su propia cuenta MASTER',
  'ADM Cliente não possui permissão para excluir usuários':
    'El Admin Cliente no tiene permiso para eliminar usuarios',
  'Você não pode remover sua própria conta MASTER. Solicite a outro admin MASTER que realize esta ação':
    'No puede eliminar su propia cuenta MASTER. Solicite a otro admin MASTER que realice esta acción',
  'Você não pode excluir sua própria conta': 'No puede eliminar su propia cuenta',
  'Você não pode remover sua própria conta MASTER.': 'No puede eliminar su propia cuenta MASTER.',
  'Não é possível remover o único admin MASTER da plataforma.':
    'No es posible eliminar el único admin MASTER de la plataforma.',
  'Usuários excluídos com sucesso!': '¡Usuarios eliminados con éxito!',
  'Erro ao excluir usuários.': 'Error al eliminar usuarios.',
  'Grupos excluídos com sucesso!': '¡Grupos eliminados con éxito!',
  'Você não pode remover sua própria conta MASTER. Solicite a outro admin MASTER que realize esta ação.':
    'No puede eliminar su propia cuenta MASTER. Solicite a otro admin MASTER que realice esta acción.',
  'Tem certeza de que deseja excluir o usuário ': '¿Está seguro de que desea eliminar el usuario ',
  'Erro ao carregar usuário.': 'Error al cargar usuario.',
  'Elemento do dashboard não encontrado.': 'Elemento del panel no encontrado.',
  'Preparando impressão...': 'Preparando impresión...',
  'Erro ao salvar usuário.': 'Error al guardar usuario.',
  'Erro ao atualizar documentos dos usuários.': 'Error al actualizar documentos de usuarios.',
  'Cliente excluído com sucesso.': 'Cliente eliminado con éxito.',
  'Clientes excluídos com sucesso.': 'Clientes eliminados con éxito.',
  'ADM Cliente não possui permissão para criar ou editar usuários.':
    'El Admin Cliente no tiene permiso para crear o editar usuarios.',
  'Acesso negado (403): ADM Cliente não pode criar ou editar usuários.':
    'Acceso denegado (403): Admin Cliente no puede crear o editar usuarios.',
  'Tem certeza de que deseja cancelar este projeto? Ele não aparecerá mais no Dashboard.':
    '¿Está seguro de que desea cancelar este proyecto? Ya no aparecerá en el Panel.',
  'Projetos excluídos com sucesso.': 'Proyectos eliminados con éxito.',
  'Tem certeza de que deseja excluir este projeto? Participantes, links e créditos reservados também serão removidos.':
    '¿Está seguro de que desea eliminar este proyecto? También se eliminarán participantes, enlaces y créditos reservados.',
  Usuários: 'Usuarios',
  'Visualizar clientes vinculados e saldo de créditos': 'Ver clientes vinculados y saldo de créditos',
  'Visualizar grupos de usuários da empresa': 'Ver grupos de usuarios de la empresa',
  'Acessar relatórios publicados pelo administrador': 'Acceder a informes publicados por el administrador',
  'Não cadastra, edita ou exclui clientes': 'No registra, edita ni elimina clientes',
  'Sem acesso à lista de usuários': 'Sin acceso a la lista de usuarios',
  'Sem acesso a formulários de avaliação': 'Sin acceso a formularios de evaluación',
  'Ver relatórios publicados pelo administrador': 'Ver informes publicados por el administrador',
  Crédito: 'Crédito',
  'Distribuição de todos os projetos por status atual': 'Distribución de todos los proyectos por estado actual',
  'Distribuição dos participantes da empresa': 'Distribución de participantes de la empresa',
  Formulário: 'Formulario',
  Avaliação: 'Evaluación',
  'Tipo de gráfico': 'Tipo de gráfico',
  'Gráfico de Barras Comparativo:': 'Gráfico de barras comparativo:',
  'Exibe as respostas de todos os participantes (avaliado e avaliadores) às perguntas: o que continuar, parar e começar a fazer. As respostas são agrupadas por categoria (Avaliado(a), Gestor(es), Pares, Subordinados, Outros).':
    'Muestra las respuestas de todos los participantes a las preguntas continuar/dejar de hacer/empezar a hacer, agrupadas por categoría.',
  'Pergunta não encontrada.': 'Pregunta no encontrada.',
  'Não é possível remover uma pergunta que está vinculada a uma competência.':
    'No es posible eliminar una pregunta vinculada a una competencia.',
  'Nenhum cliente disponível para exportação.': 'Ningún cliente disponible para exportación.',
  'Erro ao carregar dados da avaliação. Tente novamente.': 'Error al cargar datos de la evaluación. Inténtelo de nuevo.',
  'Selecione um cliente antes de salvar o relatório.': 'Seleccione un cliente antes de guardar el informe.',
  'Selecione um cliente antes de atualizar o relatório.': 'Seleccione un cliente antes de actualizar el informe.',
  'Selecione um relatório para excluir.': 'Seleccione un informe para eliminar.',
  'Relatório excluído com sucesso!': '¡Informe eliminado con éxito!',
  'Erro ao excluir relatório.': 'Error al eliminar informe.',
  'Template excluído com sucesso!': '¡Plantilla eliminada con éxito!',
  'Template não encontrado.': 'Plantilla no encontrada.',
  'Este template não possui seções salvas. Atualize o template ou crie um novo.':
    'Esta plantilla no tiene secciones guardadas. Actualice la plantilla o cree una nueva.',
  'Configure as competências antes de gerar relatórios em lote.':
    'Configure las competencias antes de generar informes en lote.',
  'Nenhum projeto ativo utiliza esta avaliação.': 'Ningún proyecto activo utiliza esta evaluación.',
  'Esta avaliação existe em mais de um projeto — selecione o ciclo desejado.':
    'Esta evaluación existe en más de un proyecto — seleccione el ciclo deseado.',
  'Este projeto não utiliza a avaliação selecionada.': 'Este proyecto no utiliza la evaluación seleccionada.',
  'Apenas administradores podem liberar relatórios.': 'Solo los administradores pueden liberar informes.',
  'Avaliado inválido para liberação do relatório.': 'Evaluado inválido para liberación del informe.',
  'Selecione um cliente antes de publicar o relatório.': 'Seleccione un cliente antes de publicar el informe.',
  'Selecione uma avaliação antes de publicar o relatório.': 'Seleccione una evaluación antes de publicar el informe.',
  'Relatório publicado com sucesso.': 'Informe publicado con éxito.',
  'Erro ao publicar relatório.': 'Error al publicar informe.',
  'Apenas administradores podem revogar liberação.': 'Solo los administradores pueden revocar la liberación.',
  'Liberação de relatório revogada.': 'Liberación de informe revocada.',
  'Erro ao revogar liberação.': 'Error al revocar liberación.',
  'Seleção de avaliado limpa.': 'Selección de evaluado limpiada.',
  'kpi.clientes_ativos': 'Clientes Activos',
  'kpi.projetos_ativos': 'Proyectos Activos',
  'kpi.avaliacoes_andamento': 'Evaluaciones en Curso',
  'kpi.participantes_ativos': 'Participantes Activos',
  'kpi.creditos_disponiveis': 'Créditos Disponibles',
  'alert.prazo_vencido': 'Plazo Vencido',
  'alert.prazo_proximo': 'Plazo Próximo',
  'alert.sem_creditos': 'Sin Créditos',
  'alert.vencido_descricao': 'Vencido hace {{days}} día(s) — {{rate}}% respondido',
  'alert.proximo_descricao': '{{days}} día(s) restante(s) — {{pending}} respuesta(s) pendiente(s) ({{rate}}% completado)',
  'alert.creditos_esgotados': 'Créditos agotados — realice un pedido para continuar',
  'Extrato do cliente (Excel)': 'Extracto del cliente (Excel)',
};

// ES também recebe traduções EN onde aplicável (chaves comuns)
for (const [k, v] of Object.entries(EN)) {
  if (!(k in ES)) ES[k] = v; // fallback EN melhor que PT para chaves não mapeadas em ES
}

const enPath = 'src/assets/i18n/en.json';
const esPath = 'src/assets/i18n/es.json';
const ptPath = 'src/assets/i18n/pt-BR.json';
const en = loadJson(enPath);
const es = loadJson(esPath);
const pt = loadJson(ptPath);

let patchedEn = 0;
let patchedEs = 0;

for (const [k, v] of Object.entries(EN)) {
  if (k in en && (en[k] === k || en[k] === pt[k])) {
    en[k] = v;
    patchedEn++;
  }
}

for (const [k, v] of Object.entries(ES)) {
  if (k in es && (es[k] === k || es[k] === pt[k])) {
    es[k] = v;
    patchedEs++;
  }
}

saveJson(enPath, en);
saveJson(esPath, es);
console.log(`Patched EN: ${patchedEn}, ES: ${patchedEs}`);
