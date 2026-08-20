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
 * Rotas mais específicas devem vir antes das genéricas.
 */
export const TOUR_REGISTRY: TourConfig[] = [
  /* Dashboard: tour desabilitado conforme solicitado */
  {
    routePattern: /^\/clients\/[^/]+\/customization/,
    steps: [
      {
        element: '[data-tour="customization-header"]',
        popover: {
          title: 'tour.customization.step1.title',
          description: 'tour.customization.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="customization-form"]',
        popover: {
          title: 'tour.customization.step2.title',
          description: 'tour.customization.step2.description',
          side: 'top',
        },
      },
    ],
  },
  {
    routePattern: /^\/clients/,
    steps: [
      {
        element: '[data-tour="clients-header"]',
        popover: {
          title: 'tour.clients.step1.title',
          description: 'tour.clients.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="clients-add"]',
        popover: {
          title: 'tour.clients.step2.title',
          description: 'tour.clients.step2.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="clients-search"]',
        popover: {
          title: 'tour.clients.step3.title',
          description: 'tour.clients.step3.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="clients-table"]',
        popover: {
          title: 'tour.clients.step4.title',
          description: 'tour.clients.step4.description',
          side: 'top',
        },
      },
      {
        element: '[data-tour="clients-actions"]',
        popover: {
          title: 'tour.clients.step5.title',
          description: 'tour.clients.step5.description',
          side: 'left',
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
          title: 'tour.projectUsers.step1.title',
          description: 'tour.projectUsers.step1.description',
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
          title: 'tour.questionnaires.step1.title',
          description: 'tour.questionnaires.step1.description',
          side: 'bottom',
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
          title: 'tour.projects.step1.title',
          description: 'tour.projects.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="projects-add"]',
        popover: {
          title: 'tour.projects.step2.title',
          description: 'tour.projects.step2.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="projects-search"]',
        popover: {
          title: 'tour.projects.step3.title',
          description: 'tour.projects.step3.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="projects-table"]',
        popover: {
          title: 'tour.projects.step4.title',
          description: 'tour.projects.step4.description',
          side: 'top',
        },
      },
      {
        element: '[data-tour="projects-actions"]',
        popover: {
          title: 'tour.projects.step5.title',
          description: 'tour.projects.step5.description',
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
          title: 'tour.assessmentsUpload.step1.title',
          description: 'tour.assessmentsUpload.step1.description',
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
          title: 'tour.assessmentsDashboard.step1.title',
          description: 'tour.assessmentsDashboard.step1.description',
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
          title: 'tour.assessmentsExport.step1.title',
          description: 'tour.assessmentsExport.step1.description',
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
          title: 'tour.assessmentsEditor.step1.title',
          description: 'tour.assessmentsEditor.step1.description',
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
          title: 'tour.participants.step1.title',
          description: 'tour.participants.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="participants-add"]',
        popover: {
          title: 'tour.participants.step2.title',
          description: 'tour.participants.step2.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="participants-search"]',
        popover: {
          title: 'tour.participants.step3.title',
          description: 'tour.participants.step3.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="participants-table"]',
        popover: {
          title: 'tour.participants.step4.title',
          description: 'tour.participants.step4.description',
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
          title: 'tour.assessments.step1.title',
          description: 'tour.assessments.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="assessments-search"]',
        popover: {
          title: 'tour.assessments.step2.title',
          description: 'tour.assessments.step2.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="assessments-table"]',
        popover: {
          title: 'tour.assessments.step3.title',
          description: 'tour.assessments.step3.description',
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
          title: 'tour.competencies.step1.title',
          description: 'tour.competencies.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="competencies-assessment"]',
        popover: {
          title: 'tour.competencies.step2.title',
          description: 'tour.competencies.step2.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="competencies-groups"]',
        popover: {
          title: 'tour.competencies.step3.title',
          description: 'tour.competencies.step3.description',
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
          title: 'tour.reports.step1.title',
          description: 'tour.reports.step1.description',
          side: 'bottom',
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
          title: 'tour.newOrder.step1.title',
          description: 'tour.newOrder.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="new-order-form"]',
        popover: {
          title: 'tour.newOrder.step2.title',
          description: 'tour.newOrder.step2.description',
          side: 'top',
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
          title: 'tour.orders.step1.title',
          description: 'tour.orders.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="orders-add"]',
        popover: {
          title: 'tour.orders.step2.title',
          description: 'tour.orders.step2.description',
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
          title: 'tour.mailTemplates.step1.title',
          description: 'tour.mailTemplates.step1.description',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="mail-templates-add"]',
        popover: {
          title: 'tour.mailTemplates.step2.title',
          description: 'tour.mailTemplates.step2.description',
          side: 'bottom',
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
          title: 'tour.emailsNotifications.step1.title',
          description: 'tour.emailsNotifications.step1.description',
          side: 'bottom',
        },
      },
    ],
  },
];
