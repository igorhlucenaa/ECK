/**
 * Corrige entradas de en.json onde valor === chave (texto PT não traduzido).
 * Uso: node scripts/fix-en-i18n.js
 */
const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../src/assets/i18n/en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

/** Traduções manuais para chaves PT prioritárias */
const MANUAL = {
  'Adicionar Cliente': 'Add Client',
  'Cadastrar Cliente': 'Register Client',
  'Editar Cliente': 'Edit Client',
  'Detalhes do Cliente': 'Client Details',
  'Lista de Clientes': 'Client List',
  'Lista de clientes atualizada!': 'Client list updated!',
  'Cliente atualizado com sucesso!': 'Client updated successfully!',
  'Cliente cadastrado com ID {{id}}!': 'Client registered with ID {{id}}!',
  'Carregando detalhes do cliente...': 'Loading client details...',
  'Erro ao carregar os dados do cliente.': 'Error loading client data.',
  'Erro ao carregar os detalhes do cliente.': 'Error loading client details.',
  'Erro ao salvar cliente. Tente novamente.': 'Error saving client. Please try again.',
  'Erro ao excluir cliente. Tente novamente.': 'Error deleting client. Please try again.',
  'Erro ao excluir clientes. Tente novamente.': 'Error deleting clients. Please try again.',
  'Digite o nome do cliente': 'Enter client name',
  'Digite o nome': 'Enter first name',
  'Digite o sobrenome': 'Enter last name',
  'Digite o setor': 'Enter sector',
  'Digite o CNPJ': 'Enter CNPJ',
  'Digite o e-mail': 'Enter email',
  'Digite a senha': 'Enter password',
  'Senha': 'Password',
  'Sobrenome': 'Last name',
  'Telefone': 'Phone',
  'Ocultar senha': 'Hide password',
  'Revelar senha': 'Show password',
  'Nome do Grupo': 'Group name',
  'Nome do Representante': 'Representative name',
  'Nome Fantasia': 'Trade name',
  'Notas Adicionais': 'Additional notes',
  'Dados do Representante': 'Representative data',
  'Confirmar': 'Confirm',
  'Salvar': 'Save',
  'Salvando...': 'Saving...',
  'Excluir Grupo': 'Delete group',
  'Tem certeza de que deseja excluir o grupo "{{name}}"?':
    'Are you sure you want to delete the group "{{name}}"?',
  'Erro ao excluir grupo.': 'Error deleting group.',
  'Erro ao salvar grupo.': 'Error saving group.',
  'Erro ao carregar grupo.': 'Error loading group.',
  'Erro ao carregar projetos ou grupos.': 'Error loading projects or groups.',
  'Erro ao excluir projetos. Tente novamente.': 'Error deleting projects. Please try again.',
  'Projeto cancelado com sucesso.': 'Project canceled successfully.',
  'Erro ao cancelar projeto.': 'Error canceling project.',
  'Configurar templates de convites': 'Configure invitation templates',
  'Enviar E-mail': 'Send email',
  'E-mail enviado para {{email}}': 'Email sent to {{email}}',
  'Dashboard exportado com sucesso!': 'Dashboard exported successfully!',
  'Erro ao exportar o dashboard.': 'Error exporting dashboard.',
  'Erro ao exportar extrato.': 'Error exporting statement.',
  'Exportado com sucesso!': 'Exported successfully!',
  'Exportando': 'Exporting',
  'DOCX exportado com sucesso!': 'DOCX exported successfully!',
  'Erro ao gerar o DOCX.': 'Error generating DOCX.',
  'PDF gerado com sucesso usando PDFMake!': 'PDF generated successfully using PDFMake!',
  'Gerando extrato do cliente...': 'Generating client statement...',
  'Extrato exportado: {{resumo}} linhas...': 'Statement exported: {{resumo}} rows...',
  'Consumidos': 'Consumed',
  'Grupos': 'Groups',
  'Sem Clientes': 'No clients',
  'Sem grupos': 'No groups',
  'Sem projetos': 'No projects',
  'Todos os projetos': 'All projects',
  'Ver Clientes': 'View clients',
  'Ver Grupos': 'View groups',
  'Ver Projetos': 'View projects',
  'Selecione um cliente antes de salvar o template.': 'Select a client before saving the template.',
  'Selecione um template para excluir.': 'Select a template to delete.',
  'Apenas um admin MASTER pode editar outro admin MASTER':
    'Only a MASTER admin can edit another MASTER admin',
  'Apenas um admin MASTER pode remover outro admin MASTER':
    'Only a MASTER admin can remove another MASTER admin',
  'Apenas um admin MASTER pode remover outro admin MASTER.':
    'Only a MASTER admin can remove another MASTER admin.',
  'A senha deve ter pelo menos 6 caracteres.': 'Password must be at least 6 characters.',
  'Administrador': 'Administrator',
  'Criado por': 'Created by',
  'Buscar Grupo': 'Search group',
  'Status': 'Status',
  'Participantes Ativos': 'Active Participants',
  'Análise 360°': '360° Analysis',
  'Configure e visualize relatórios de avaliação 360°':
    'Configure and view 360° assessment reports',
  'Buscar projeto': 'Search project',
  'Nome do projeto...': 'Project name...',
  'Filtrar por cliente': 'Filter by client',
  'Buscar cliente...': 'Search client...',
  'Todos os clientes': 'All clients',
  'Nenhum cliente encontrado': 'No client found',
  'Indicadores e métricas da sua empresa em tempo real':
    'Your company indicators and metrics in real time',
  'Programe o reenvio automático para participantes pendentes com intervalo, horário, dias e templates.':
    'Schedule automatic resending for pending participants with interval, time, days and templates.',
  'Nenhum cliente disponível para configurar lembretes.':
    'No client available to configure reminders.',
  'Carregando configurações...': 'Loading settings...',
  'Selecione um projeto acima para configurar os lembretes automáticos.':
    'Select a project above to configure automatic reminders.',
  'Este cliente não possui projetos ativos.': 'This client has no active projects.',
  'Lembretes automáticos': 'Automatic reminders',
  'Ativo — participantes pendentes receberão lembretes automaticamente':
    'Active — pending participants will receive reminders automatically',
  'Inativo — nenhum lembrete será enviado automaticamente':
    'Inactive — no reminders will be sent automatically',
  'Agendamento': 'Scheduling',
  'Data de início dos lembretes': 'Reminder start date',
  'Intervalo entre lembretes': 'Interval between reminders',
  'Horário de disparo': 'Send time',
  'Fuso horário': 'Timezone',
  'Máximo de lembretes por participante': 'Maximum reminders per participant',
  'dias': 'days',
  'Dias da semana': 'Days of the week',
  'Templates de e-mail': 'Email templates',
  'Salvar configurações': 'Save settings',
  'Usuários do projeto': 'Project users',
  'Formulário de avaliação': 'Assessment form',
  'Editar projeto': 'Edit project',
  'Projeto': 'Project',
  'Prazo': 'Deadline',
  'pendente': 'pending',
  'Hoje': 'Today',
  'd atrasado': 'd overdue',
  'd restante(s)': 'd remaining',
  'projeto': 'project',
  'projetos': 'projects',
  'Ver tutorial desta página': 'View tutorial for this page',
  'Menu do usuário': 'User menu',
  'Usuário': 'User',
  'Alterar senha': 'Change password',
  'Sair': 'Log out',
  'Senha alterada com sucesso!': 'Password changed successfully!',
  'Avaliado(a)': 'Evaluatee',
  'Gestor(es)': 'Manager(s)',
  'Subordinados': 'Subordinates',
  'Gestor': 'Manager',
  'Par': 'Peer',
  'Subordinado': 'Subordinate',
  'Avaliado': 'Evaluatee',
  'Outros': 'Others',
  'Selecione um cliente e um projeto para salvar as configurações.':
    'Select a client and a project to save settings.',
  'Configurações de lembrete salvas com sucesso.': 'Reminder settings saved successfully.',
  'Informe um horário válido no formato HH:mm.': 'Enter a valid time in HH:mm format.',
  'Elemento do dashboard não encontrado.': 'Dashboard element not found.',
  'Preparando impressão...': 'Preparing print...',
  'Fechar': 'Close',
  'Cliente': 'Client',
  'Formulário': 'Form',
  'Visualizar': 'View',
  'PDF e exportação': 'PDF and export',
  'Selecione acima': 'Select above',
  '— Selecione um cliente —': '— Select a client —',
  '— Selecione o formulário —': '— Select the form —',
  'Carregando dados...': 'Loading data...',
  'Relatório Individual': 'Individual Report',
  'Avaliado:': 'Evaluatee:',
  'Template:': 'Template:',
  'Voltar para Lista': 'Back to list',
  'Configurando': 'Configuring',
  'Último processamento': 'Last processing',
  'Carregando projetos...': 'Loading projects...',
  'Nenhum projeto ativo': 'No active project',
  '— Selecione um projeto —': '— Select a project —',
  'Seg': 'Mon',
  'Ter': 'Tue',
  'Qua': 'Wed',
  'Qui': 'Thu',
  'Sex': 'Fri',
  'Sáb': 'Sat',
  'Dom': 'Sun',
  'Dias úteis': 'Business days',
  'Todos os dias': 'Every day',
  'Template padrão': 'Default template',
  'Selecione um template': 'Select a template',
  'Usar template original do convite': 'Use original invitation template',
  'Para avaliados': 'For evaluatees',
  'Template para avaliados': 'Template for evaluatees',
  'Usar template padrão de lembrete': 'Use default reminder template',
  'Para avaliadores': 'For evaluators',
  'Template para avaliadores': 'Template for evaluators',
  'Resultado do último envio': 'Last send result',
  'Enviados': 'Sent',
  'Pulados': 'Skipped',
  'Erros': 'Errors',
  'Global': 'Global',
  'Carregando relatório individual para {{name}}...': 'Loading individual report for {{name}}...',
  'Selecionada': 'Selected',
  'Nenhum formulário cadastrado para este cliente': 'No form registered for this client',
  'Primeiro lembrete será disparado nesta data (ou depois, se já passou)':
    'First reminder will be sent on this date (or later, if it has already passed)',
  'Selecione a data de início': 'Select start date',
  'Ex: 3 = reenvia a cada 3 dias após o último envio': 'E.g. 3 = resend every 3 days after the last send',
  'Formato 24h (HH:mm)': '24h format (HH:mm)',
  '0 = sem limite de reenvios': '0 = no resend limit',
  'Selecione os dias em que o lembrete pode ser disparado.': 'Select the days when the reminder can be sent.',
  'Nenhum dia selecionado = todos os dias.': 'No day selected = every day.',
  'Defina qual template será usado para cada tipo de participante. A hierarquia é:':
    'Define which template will be used for each participant type. The hierarchy is:',
  'avaliado/avaliador → padrão → template original do convite':
    'evaluatee/evaluator → default → original invitation template',
  'Alterar Senha': 'Change Password',
  'Senha atual': 'Current password',
  'Nova senha': 'New password',
  'Confirmar nova senha': 'Confirm new password',
  'Mínimo 6 caracteres': 'Minimum 6 characters',
  'Senhas não coincidem': 'Passwords do not match',
  'Cancelar': 'Cancel',
  'Revise os campos antes de salvar.': 'Review the fields before saving.',
  'Erro ao salvar configurações de lembrete.': 'Error saving reminder settings.',
  'Não foi possível carregar os clientes.': 'Could not load clients.',
  'Não foi possível carregar as configurações.': 'Could not load settings.',
  'Informe um fuso horário válido (ex.: America/Fortaleza).':
    'Enter a valid timezone (e.g. America/Fortaleza).',
  'Selecione a data de início dos lembretes.': 'Select the reminder start date.',
};

let fixed = 0;
for (const [key, value] of Object.entries(MANUAL)) {
  if (en[key] === undefined) {
    en[key] = value;
    fixed++;
  } else if (en[key] === key) {
    en[key] = value;
    fixed++;
  }
}

// Ordenar chaves alfabeticamente
const sorted = Object.keys(en)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  .reduce((acc, k) => {
    acc[k] = en[k];
    return acc;
  }, {});

fs.writeFileSync(enPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
console.log(`Fixed/added ${fixed} translation entries in en.json`);
