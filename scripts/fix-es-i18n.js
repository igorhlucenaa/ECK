/**
 * Corrige e completa entradas de es.json (traduções PT → ES).
 * Uso: node scripts/fix-es-i18n.js
 */
const fs = require('fs');
const path = require('path');

const esPath = path.join(__dirname, '../src/assets/i18n/es.json');
const enPath = path.join(__dirname, '../src/assets/i18n/en.json');
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

/** Traduções PT → ES para chaves prioritárias (mesmo escopo do fix-en-i18n.js) */
const MANUAL = {
  'Adicionar Cliente': 'Agregar Cliente',
  'Cadastrar Cliente': 'Registrar Cliente',
  'Editar Cliente': 'Editar Cliente',
  'Detalhes do Cliente': 'Detalles del Cliente',
  'Lista de Clientes': 'Lista de Clientes',
  'Lista de clientes atualizada!': '¡Lista de clientes actualizada!',
  'Cliente atualizado com sucesso!': '¡Cliente actualizado con éxito!',
  'Cliente cadastrado com ID {{id}}!': '¡Cliente registrado con ID {{id}}!',
  'Carregando detalhes do cliente...': 'Cargando detalles del cliente...',
  'Erro ao carregar os dados do cliente.': 'Error al cargar los datos del cliente.',
  'Erro ao carregar os detalhes do cliente.': 'Error al cargar los detalles del cliente.',
  'Erro ao salvar cliente. Tente novamente.': 'Error al guardar el cliente. Inténtelo de nuevo.',
  'Erro ao excluir cliente. Tente novamente.': 'Error al eliminar el cliente. Inténtelo de nuevo.',
  'Erro ao excluir clientes. Tente novamente.': 'Error al eliminar los clientes. Inténtelo de nuevo.',
  'Digite o nome do cliente': 'Ingrese el nombre del cliente',
  'Digite o nome': 'Ingrese el nombre',
  'Digite o sobrenome': 'Ingrese el apellido',
  'Digite o setor': 'Ingrese el sector',
  'Digite o CNPJ': 'Ingrese el CNPJ',
  'Digite o e-mail': 'Ingrese el correo electrónico',
  'Digite a senha': 'Ingrese la contraseña',
  'Senha': 'Contraseña',
  'Sobrenome': 'Apellido',
  'Telefone': 'Teléfono',
  'Ocultar senha': 'Ocultar contraseña',
  'Revelar senha': 'Mostrar contraseña',
  'Nome do Grupo': 'Nombre del grupo',
  'Nome do Representante': 'Nombre del representante',
  'Nome Fantasia': 'Nombre comercial',
  'Notas Adicionais': 'Notas adicionales',
  'Dados do Representante': 'Datos del representante',
  'Confirmar': 'Confirmar',
  'Salvar': 'Guardar',
  'Salvando...': 'Guardando...',
  'Excluir Grupo': 'Eliminar grupo',
  'Tem certeza de que deseja excluir o grupo "{{name}}"?':
    '¿Está seguro de que desea eliminar el grupo "{{name}}"?',
  'Erro ao excluir grupo.': 'Error al eliminar el grupo.',
  'Erro ao salvar grupo.': 'Error al guardar el grupo.',
  'Erro ao carregar grupo.': 'Error al cargar el grupo.',
  'Erro ao carregar projetos ou grupos.': 'Error al cargar proyectos o grupos.',
  'Erro ao excluir projetos. Tente novamente.': 'Error al eliminar proyectos. Inténtelo de nuevo.',
  'Projeto cancelado com sucesso.': 'Proyecto cancelado con éxito.',
  'Erro ao cancelar projeto.': 'Error al cancelar el proyecto.',
  'Configurar templates de convites': 'Configurar plantillas de invitación',
  'Enviar E-mail': 'Enviar correo',
  'E-mail enviado para {{email}}': 'Correo enviado a {{email}}',
  'Dashboard exportado com sucesso!': '¡Panel exportado con éxito!',
  'Erro ao exportar o dashboard.': 'Error al exportar el panel.',
  'Erro ao exportar extrato.': 'Error al exportar el extracto.',
  'Exportado com sucesso!': '¡Exportado con éxito!',
  'Exportando': 'Exportando',
  'DOCX exportado com sucesso!': '¡DOCX exportado con éxito!',
  'Erro ao gerar o DOCX.': 'Error al generar el DOCX.',
  'PDF gerado com sucesso usando PDFMake!': '¡PDF generado con éxito usando PDFMake!',
  'Gerando extrato do cliente...': 'Generando extracto del cliente...',
  'Extrato exportado: {{resumo}} linhas...': 'Extracto exportado: {{resumo}} filas...',
  'Consumidos': 'Consumidos',
  'Grupos': 'Grupos',
  'Sem Clientes': 'Sin clientes',
  'Sem grupos': 'Sin grupos',
  'Sem projetos': 'Sin proyectos',
  'Todos os projetos': 'Todos los proyectos',
  'Ver Clientes': 'Ver clientes',
  'Ver Grupos': 'Ver grupos',
  'Ver Projetos': 'Ver proyectos',
  'Selecione um cliente antes de salvar o template.': 'Seleccione un cliente antes de guardar la plantilla.',
  'Selecione um template para excluir.': 'Seleccione una plantilla para eliminar.',
  'Apenas um admin MASTER pode editar outro admin MASTER':
    'Solo un admin MASTER puede editar a otro admin MASTER',
  'Apenas um admin MASTER pode remover outro admin MASTER':
    'Solo un admin MASTER puede eliminar a otro admin MASTER',
  'Apenas um admin MASTER pode remover outro admin MASTER.':
    'Solo un admin MASTER puede eliminar a otro admin MASTER.',
  'A senha deve ter pelo menos 6 caracteres.': 'La contraseña debe tener al menos 6 caracteres.',
  'Administrador': 'Administrador',
  'Criado por': 'Creado por',
  'Buscar Grupo': 'Buscar grupo',
  'Status': 'Estado',
  'Participantes Ativos': 'Participantes Activos',
  'Análise 360°': 'Análisis 360°',
  'Configure e visualize relatórios de avaliação 360°':
    'Configure y visualice informes de evaluación 360°',
  'Buscar projeto': 'Buscar proyecto',
  'Nome do projeto...': 'Nombre del proyecto...',
  'Filtrar por cliente': 'Filtrar por cliente',
  'Buscar cliente...': 'Buscar cliente...',
  'Todos os clientes': 'Todos los clientes',
  'Nenhum cliente encontrado': 'Ningún cliente encontrado',
  'Indicadores e métricas da sua empresa em tempo real':
    'Indicadores y métricas de su empresa en tiempo real',
  'Indicadores e métricas de toda a plataforma em tempo real':
    'Indicadores y métricas de toda la plataforma en tiempo real',
  'Programe o reenvio automático para participantes pendentes com intervalo, horário, dias e templates.':
    'Programe el reenvío automático para participantes pendientes con intervalo, horario, días y plantillas.',
  'Nenhum cliente disponível para configurar lembretes.':
    'Ningún cliente disponible para configurar recordatorios.',
  'Carregando configurações...': 'Cargando configuraciones...',
  'Selecione um projeto acima para configurar os lembretes automáticos.':
    'Seleccione un proyecto arriba para configurar los recordatorios automáticos.',
  'Este cliente não possui projetos ativos.': 'Este cliente no tiene proyectos activos.',
  'Lembretes automáticos': 'Recordatorios automáticos',
  'Ativo — participantes pendentes receberão lembretes automaticamente':
    'Activo — los participantes pendientes recibirán recordatorios automáticamente',
  'Inativo — nenhum lembrete será enviado automaticamente':
    'Inactivo — no se enviarán recordatorios automáticamente',
  'Agendamento': 'Programación',
  'Data de início dos lembretes': 'Fecha de inicio de los recordatorios',
  'Intervalo entre lembretes': 'Intervalo entre recordatorios',
  'Horário de disparo': 'Horario de envío',
  'Fuso horário': 'Zona horaria',
  'Máximo de lembretes por participante': 'Máximo de recordatorios por participante',
  'dias': 'días',
  'Dias da semana': 'Días de la semana',
  'Templates de e-mail': 'Plantillas de correo',
  'Salvar configurações': 'Guardar configuraciones',
  'Usuários do projeto': 'Usuarios del proyecto',
  'Formulário de avaliação': 'Formulario de evaluación',
  'Editar projeto': 'Editar proyecto',
  'Projeto': 'Proyecto',
  'Prazo': 'Plazo',
  'pendente': 'pendiente',
  'pendentes': 'pendientes',
  'Hoje': 'Hoy',
  'd atrasado': 'd de retraso',
  'd restante(s)': 'd restante(s)',
  'projeto': 'proyecto',
  'projetos': 'proyectos',
  'Ver tutorial desta página': 'Ver tutorial de esta página',
  'Menu do usuário': 'Menú de usuario',
  'Usuário': 'Usuario',
  'Alterar senha': 'Cambiar contraseña',
  'Sair': 'Salir',
  'Senha alterada com sucesso!': '¡Contraseña cambiada con éxito!',
  'Avaliado(a)': 'Evaluado(a)',
  'Gestor(es)': 'Gestor(es)',
  'Subordinados': 'Subordinados',
  'Gestor': 'Gestor',
  'Par': 'Par',
  'Subordinado': 'Subordinado',
  'Avaliado': 'Evaluado',
  'Outros': 'Otros',
  'Selecione um cliente e um projeto para salvar as configurações.':
    'Seleccione un cliente y un proyecto para guardar las configuraciones.',
  'Configurações de lembrete salvas com sucesso.': 'Configuraciones de recordatorio guardadas con éxito.',
  'Informe um horário válido no formato HH:mm.': 'Ingrese un horario válido en formato HH:mm.',
  'Elemento do dashboard não encontrado.': 'Elemento del panel no encontrado.',
  'Preparando impressão...': 'Preparando impresión...',
  'Fechar': 'Cerrar',
  'Cliente': 'Cliente',
  'Clientes': 'Clientes',
  'Formulário': 'Formulario',
  'Visualizar': 'Visualizar',
  'PDF e exportação': 'PDF y exportación',
  'Selecione acima': 'Seleccione arriba',
  '— Selecione um cliente —': '— Seleccione un cliente —',
  '— Selecione o formulário —': '— Seleccione el formulario —',
  'Carregando dados...': 'Cargando datos...',
  'Relatório Individual': 'Informe Individual',
  'Avaliado:': 'Evaluado:',
  'Template:': 'Plantilla:',
  'Voltar para Lista': 'Volver a la lista',
  'Configurando': 'Configurando',
  'Último processamento': 'Último procesamiento',
  'Carregando projetos...': 'Cargando proyectos...',
  'Nenhum projeto ativo': 'Ningún proyecto activo',
  '— Selecione um projeto —': '— Seleccione un proyecto —',
  'Seg': 'Lun',
  'Ter': 'Mar',
  'Qua': 'Mié',
  'Qui': 'Jue',
  'Sex': 'Vie',
  'Sáb': 'Sáb',
  'Dom': 'Dom',
  'Dias úteis': 'Días laborables',
  'Todos os dias': 'Todos los días',
  'Template padrão': 'Plantilla predeterminada',
  'Selecione um template': 'Seleccione una plantilla',
  'Usar template original do convite': 'Usar plantilla original de la invitación',
  'Para avaliados': 'Para evaluados',
  'Template para avaliados': 'Plantilla para evaluados',
  'Usar template padrão de lembrete': 'Usar plantilla predeterminada de recordatorio',
  'Para avaliadores': 'Para evaluadores',
  'Template para avaliadores': 'Plantilla para evaluadores',
  'Resultado do último envio': 'Resultado del último envío',
  'Enviados': 'Enviados',
  'Pulados': 'Omitidos',
  'Erros': 'Errores',
  'Global': 'Global',
  'Carregando relatório individual para {{name}}...': 'Cargando informe individual para {{name}}...',
  'Selecionada': 'Seleccionada',
  'Nenhum formulário cadastrado para este cliente': 'Ningún formulario registrado para este cliente',
  'Primeiro lembrete será disparado nesta data (ou depois, se já passou)':
    'El primer recordatorio se enviará en esta fecha (o después, si ya pasó)',
  'Selecione a data de início': 'Seleccione la fecha de inicio',
  'Ex: 3 = reenvia a cada 3 dias após o último envio':
    'Ej.: 3 = reenvía cada 3 días después del último envío',
  'Formato 24h (HH:mm)': 'Formato 24h (HH:mm)',
  '0 = sem limite de reenvios': '0 = sin límite de reenvíos',
  'Selecione os dias em que o lembrete pode ser disparado.':
    'Seleccione los días en que se puede enviar el recordatorio.',
  'Nenhum dia selecionado = todos os dias.': 'Ningún día seleccionado = todos los días.',
  'Defina qual template será usado para cada tipo de participante. A hierarquia é:':
    'Defina qué plantilla se usará para cada tipo de participante. La jerarquía es:',
  'avaliado/avaliador → padrão → template original do convite':
    'evaluado/evaluador → predeterminada → plantilla original de la invitación',
  'Alterar Senha': 'Cambiar Contraseña',
  'Senha atual': 'Contraseña actual',
  'Nova senha': 'Nueva contraseña',
  'Confirmar nova senha': 'Confirmar nueva contraseña',
  'Mínimo 6 caracteres': 'Mínimo 6 caracteres',
  'Senhas não coincidem': 'Las contraseñas no coinciden',
  'Cancelar': 'Cancelar',
  'Gestão': 'Gestión',
  'Gerencie os clientes cadastrados na plataforma': 'Gestione los clientes registrados en la plataforma',
  'Gerencie os projetos cadastrados na plataforma': 'Gestione los proyectos registrados en la plataforma',
  'Nome do Cliente': 'Nombre del Cliente',
  'Setor': 'Sector',
  'Créditos': 'Créditos',
  'Adquiridos': 'Adquiridos',
  'Usados': 'Usados',
  'Disponíveis': 'Disponibles',
  'resultado': 'resultado',
  'resultados': 'resultados',
  'Limpar filtros': 'Limpiar filtros',
  'Limpar': 'Limpiar',
  'Todos os setores': 'Todos los sectores',
  'Nome da empresa...': 'Nombre de la empresa...',
  'Participantes': 'Participantes',
  'Projetos': 'Proyectos',
  'Relatórios': 'Informes',
  'Lembretes Automáticos': 'Recordatorios Automáticos',
  'Configurações': 'Configuraciones',
  'Em andamento': 'En curso',
  'Concluído': 'Concluido',
  'Cancelado': 'Cancelado',
  'Todos': 'Todos',
  'Respostas': 'Respuestas',
  'Ações': 'Acciones',
  'Avaliação': 'Evaluación',
  'responderam': 'respondieron',
  'Ativos': 'Activos',
  'Em risco': 'En riesgo',
  'Atrasado': 'Atrasado',
  'Buscar': 'Buscar',
  'Buscar grupo': 'Buscar grupo',
  'Buscar Participante': 'Buscar participante',
  'Bloqueado': 'Bloqueado',
  'Bloquear participante': 'Bloquear participante',
  'Desbloquear participante': 'Desbloquear participante',
  'Editar': 'Editar',
  'Editar Grupo': 'Editar grupo',
  'Enviado': 'Enviado',
  'Enviando...': 'Enviando...',
  'Exportar PDF': 'Exportar PDF',
  'Exportar DOCX': 'Exportar DOCX',
  'Exportar base (Excel)': 'Exportar base (Excel)',
  'Filtrar Participantes': 'Filtrar participantes',
  'Filtrar por Tipo': 'Filtrar por tipo',
  'Gráficos': 'Gráficos',
  'Importar Excel': 'Importar Excel',
  'Lista de Participantes': 'Lista de Participantes',
  'Modo HTML': 'Modo HTML',
  'Editor visual': 'Editor visual',
  'Pedidos': 'Pedidos',
  'Respondido': 'Respondido',
  'Respondidos': 'Respondidos',
  'projeto selecionado': 'proyecto seleccionado',
  'projetos selecionados': 'proyectos seleccionados',
  'Revise os campos antes de salvar.': 'Revise los campos antes de guardar.',
  'Erro ao salvar configurações de lembrete.': 'Error al guardar las configuraciones de recordatorio.',
  'Não foi possível carregar os clientes.': 'No fue posible cargar los clientes.',
  'Não foi possível carregar as configurações.': 'No fue posible cargar las configuraciones.',
  'Informe um fuso horário válido (ex.: America/Fortaleza).':
    'Ingrese una zona horaria válida (ej.: America/Fortaleza).',
  'Selecione a data de início dos lembretes.': 'Seleccione la fecha de inicio de los recordatorios.',
};

let fixed = 0;
for (const [key, value] of Object.entries(MANUAL)) {
  if (es[key] === undefined || es[key] === key) {
    if (es[key] !== value) {
      es[key] = value;
      fixed++;
    }
  }
}

// Corrigir entradas que ficaram em inglês (copiadas de versões antigas)
for (const [key, value] of Object.entries(MANUAL)) {
  if (es[key] === en[key] && en[key] !== key && es[key] !== value) {
    es[key] = value;
    fixed++;
  }
}

// Garantir que todas as chaves do en existam em es
for (const key of Object.keys(en)) {
  if (es[key] === undefined) {
    es[key] = MANUAL[key] ?? en[key];
    fixed++;
  }
}

const sorted = Object.keys(es)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  .reduce((acc, k) => {
    acc[k] = es[k];
    return acc;
  }, {});

fs.writeFileSync(esPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
console.log(`Fixed/added ${fixed} translation entries in es.json`);
