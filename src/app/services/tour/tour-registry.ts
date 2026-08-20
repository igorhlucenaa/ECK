export interface TourStep {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  };
}

export interface TourConfig {
  routePattern: RegExp | string;
  steps: TourStep[];
}

/**
 * Registro de tutoriais por rota.
 * Cada rota pode ter múltiplos passos que guiam o usuário.
 */
export const TOUR_REGISTRY: TourConfig[] = [
  /* Dashboard: tour desabilitado conforme solicitado */
  {
    routePattern: /^\/clients/,
    steps: [
      {
        element: '[data-tour="clients-header"]',
        popover: {
          title: '1. Gestão de Clientes',
          description: 'Bem-vindo à tela de clientes! Aqui você gerencia todos os clientes da plataforma. Vamos percorrer cada funcionalidade.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="clients-add"]',
        popover: {
          title: '2. Adicionar Cliente',
          description: 'Clique aqui para cadastrar um novo cliente. Preencha nome, setor, CNPJ e outras informações.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="clients-search"]',
        popover: {
          title: '3. Buscar Clientes',
          description: 'Use este campo para filtrar a lista por nome do cliente. Digite para buscar em tempo real.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="clients-table"]',
        popover: {
          title: '4. Tabela de Clientes',
          description: 'A tabela exibe: nome, setor, CNPJ, créditos remanescentes. Clique no cabeçalho das colunas para ordenar.',
          side: 'top',
        },
      },
      {
        element: '[data-tour="clients-actions"]',
        popover: {
          title: '5. Ações',
          description: 'Use o ícone de lápis para editar o cliente e o ícone de lixeira para excluir. Clique em uma linha para ver detalhes.',
          side: 'left',
        },
      },
    ],
  },
  {
    routePattern: /^\/projects/,
    steps: [
      {
        element: '[data-tour="projects-title"]',
        popover: {
          title: '1. Lista de Projetos',
          description: 'Aqui você gerencia todos os projetos de avaliação 360°. Cada projeto tem participantes, formulários e prazos. Vamos ver cada funcionalidade.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="projects-add"]',
        popover: {
          title: '2. Adicionar Projeto',
          description: 'Clique aqui para criar um novo projeto. Defina o nome, o cliente, o prazo de preenchimento e os participantes.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="projects-search"]',
        popover: {
          title: '3. Buscar Projetos',
          description: 'Use este campo para filtrar a lista por nome do projeto. A busca é em tempo real.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="projects-table"]',
        popover: {
          title: '4. Tabela de Projetos',
          description: 'A tabela mostra: nome, prazo, cliente e quantas respostas foram recebidas (ex: 6/9 - Faltam 3). Clique nos cabeçalhos para ordenar.',
          side: 'top',
        },
      },
      {
        element: '[data-tour="projects-actions"]',
        popover: {
          title: '5. Ações Rápidas',
          description: 'Use os ícones: Usuários do projeto, Modelos de e-mail, Formulário de avaliação, Participantes (enviar links), Editar e Excluir.',
          side: 'left',
        },
      },
    ],
  },
  {
    routePattern: /^\/assessments\/upload/,
    steps: [
      {
        element: '[data-tour="upload-page"]',
        popover: {
          title: 'Upload de Avaliações',
          description: 'Importe participantes em massa usando planilhas Excel. Use o modelo para preencher os dados e faça o upload.',
          side: 'bottom',
        },
      },
    ],
  },
  {
    routePattern: /^\/assessments\/dashboard/,
    steps: [
      {
        element: '[data-tour="assessment-dashboard-page"]',
        popover: {
          title: 'Dashboard de Avaliação',
          description: 'Visualize análises e estatísticas das respostas da avaliação.',
          side: 'bottom',
        },
      },
    ],
  },
  {
    routePattern: /^\/assessments\/export/,
    steps: [
      {
        element: '[data-tour="export-page"]',
        popover: {
          title: 'Exportar Dados',
          description: 'Exporte as respostas das avaliações em diferentes formatos para análise externa.',
          side: 'bottom',
        },
      },
    ],
  },
  {
    routePattern: /^\/assessments\/(new|\d+\/edit)/,
    steps: [
      {
        element: '[data-tour="create-assessment-page"]',
        popover: {
          title: 'Editor de Formulário',
          description: 'Crie ou edite o formulário de avaliação. Use o editor visual para adicionar perguntas, escalas e seções.',
          side: 'bottom',
        },
      },
    ],
  },
  {
    routePattern: /^\/assessments\/participants/,
    steps: [
      {
        element: '[data-tour="participants-header"]',
        popover: {
          title: '1. Participantes',
          description: 'Gerencie avaliados e avaliadores do projeto. Adicione pessoas, envie links por e-mail e acompanhe quem respondeu.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="participants-add"]',
        popover: {
          title: '2. Adicionar Participante',
          description: 'Clique para adicionar um novo participante. Você pode também baixar a planilha modelo e carregar vários de uma vez.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="participants-search"]',
        popover: {
          title: '3. Buscar',
          description: 'Filtre participantes por nome ou e-mail.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="participants-table"]',
        popover: {
          title: '4. Lista de Participantes',
          description: 'Veja nome, tipo (avaliado/avaliador), categoria, status e data de envio. Use as ações para enviar ou reenviar e-mails.',
          side: 'top',
        },
      },
    ],
  },
  {
    routePattern: /^\/assessments/,
    steps: [
      {
        element: '[data-tour="assessments-create"]',
        popover: {
          title: '1. Criar Formulário',
          description: 'Clique aqui para criar um novo formulário de avaliação 360°. Use o editor visual ou importe de competências.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="assessments-search"]',
        popover: {
          title: '2. Buscar',
          description: 'Filtre os formulários por nome.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="assessments-table"]',
        popover: {
          title: '3. Formulários',
          description: 'Lista de formulários. Cada um pode ser editado, duplicado ou vinculado a projetos. Use as abas para Upload, Dashboard e Export.',
          side: 'top',
        },
      },
    ],
  },
  {
    routePattern: /^\/users/,
    steps: [
      {
        element: '[data-tour="users-tabs"]',
        popover: {
          title: 'tour.users.step1.title',
          description: 'tour.users.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="users-add"]',
        popover: {
          title: 'tour.users.step2.title',
          description: 'tour.users.step2.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="users-table"]',
        popover: {
          title: 'tour.users.step3.title',
          description: 'tour.users.step3.description',
          side: 'top',
        },
      },
    ],
  },
  {
    routePattern: /^\/competencies/,
    steps: [
      {
        element: '[data-tour="competencies-header"]',
        popover: {
          title: '1. Competências',
          description: 'Defina as competências avaliadas nos formulários. Crie grupos e vincule perguntas a cada competência.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="competencies-assessment"]',
        popover: {
          title: '2. Vincular Avaliação',
          description: 'Selecione uma avaliação existente ou crie uma nova a partir das competências. Defina o nome da avaliação.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="competencies-groups"]',
        popover: {
          title: '3. Grupos de Competências',
          description: 'Selecione o cliente e gerencie grupos. Salve e carregue grupos para reutilizar em outras avaliações.',
          side: 'top',
        },
      },
    ],
  },
  {
    routePattern: /^\/reports/,
    steps: [
      {
        element: '[data-tour="reports-header"]',
        popover: {
          title: '1. Relatórios',
          description: 'Selecione a avaliação e o avaliado. Use as abas: Competências (configurar), Montar Relatório (organizar seções) e Visualizar (exportar PDF/Excel).',
          side: 'bottom',
        },
      },
    ],
  },
  {
    routePattern: /^\/orders/,
    steps: [
      {
        element: '[data-tour="orders-header"]',
        popover: {
          title: '1. Pedidos de Crédito',
          description: 'Gerencie os créditos para avaliações. Cada avaliação consome créditos. Veja o histórico e faça novos pedidos.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="orders-add"]',
        popover: {
          title: '2. Novo Pedido',
          description: 'Clique para criar um novo pedido. Selecione o cliente, quantidade de créditos e datas de validade.',
          side: 'bottom',
        },
      },
    ],
  },
  {
    routePattern: /^\/mail-templates/,
    steps: [
      {
        element: '[data-tour="mail-templates-header"]',
        popover: {
          title: '1. Modelos de E-mail',
          description: 'Crie e edite templates enviados aos participantes.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="mail-templates-add"]',
        popover: {
          title: '2. Adicionar Modelo',
          description: 'Clique para criar um novo template. Escolha o tipo (convite, lembrete, cadastro) e personalize o conteúdo.',
          side: 'bottom',
        },
      },
    ],
  },
  {
    routePattern: /^\/clients\/[^/]+\/customization/,
    steps: [
      {
        element: '[data-tour="customization-header"]',
        popover: {
          title: '1. Personalização',
          description: 'Personalize a aparência do cliente: nome da organização, logo e cor do tema.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="customization-form"]',
        popover: {
          title: '2. Configurações',
          description: 'Preencha o nome, faça upload da logo e escolha a cor principal. As alterações afetam o visual da plataforma para este cliente.',
          side: 'top',
        },
      },
    ],
  },
  {
    routePattern: /^\/orders\/new/,
    steps: [
      {
        element: '[data-tour="new-order-header"]',
        popover: {
          title: '1. Novo Pedido de Crédito',
          description: 'Preencha o formulário: selecione o cliente, informe a quantidade de créditos e as datas de início e validade.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="new-order-form"]',
        popover: {
          title: '2. Campos',
          description: 'Cliente: quem receberá os créditos. Quantidade: número de avaliações disponíveis. Datas: período de uso dos créditos.',
          side: 'top',
        },
      },
    ],
  },
  {
    routePattern: /^\/emails-notifications/,
    steps: [
      {
        element: '[data-tour="emails-notifications-page"]',
        popover: {
          title: 'E-mails e Notificações',
          description: 'Configure e gerencie as notificações por e-mail enviadas pela plataforma.',
          side: 'bottom',
        },
      },
    ],
  },
  {
    routePattern: /^\/projects\/[^/]+\/users/,
    steps: [
      {
        element: '[data-tour="project-users-page"]',
        popover: {
          title: 'Usuários do Projeto',
          description: 'Gerencie quais usuários têm acesso a este projeto. Vincule usuários e grupos ao projeto.',
          side: 'bottom',
        },
      },
    ],
  },
  {
    routePattern: /^\/projects\/[^/]+\/questionnaires/,
    steps: [
      {
        element: '[data-tour="questionnaires-page"]',
        popover: {
          title: 'Formulários do Projeto',
          description: 'Gerencie os questionários vinculados a este projeto. Crie, edite e visualize os formulários de avaliação.',
          side: 'bottom',
        },
      },
    ],
  },
];

