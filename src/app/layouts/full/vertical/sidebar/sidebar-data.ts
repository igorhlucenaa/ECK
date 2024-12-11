import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Personal',
  },
  {
    displayName: 'Analytical',
    iconName: 'solar:screencast-2-linear',
    route: '/dashboards/dashboard1',
  },
  {
    displayName: 'Classic',
    iconName: 'solar:atom-linear',
    route: '/dashboards/dashboard2',
  },
  {
    displayName: 'Demographical',
    iconName: 'solar:box-minimalistic-linear',
    route: '/dashboards/dashboard3',
  },
  {
    displayName: 'Minimal',
    iconName: 'solar:buildings-2-linear',
    route: '/dashboards/dashboard4',
  },
  {
    displayName: 'eCommerce',
    iconName: 'solar:basketball-linear',
    route: '/dashboards/dashboard5',
  },
  {
    displayName: 'Modern',
    iconName: 'solar:cart-large-2-linear',
    route: '/dashboards/dashboard6',
  },
  {
    navCap: 'Apps',
  },
  {
    displayName: 'Chat',
    iconName: 'solar:chat-line-linear',
    route: 'apps/chat',
  },
  {
    displayName: 'Calendar',
    iconName: 'solar:calendar-linear',
    route: 'apps/calendar',
  },
  {
    displayName: 'Email',
    iconName: 'solar:letter-unread-linear',
    route: 'apps/email/inbox',
  },
  {
    displayName: 'Kanban',
    iconName: 'solar:clapperboard-edit-linear',
    route: 'apps/taskboard',
  },
  {
    displayName: 'Contacts',
    iconName: 'solar:list-check-linear',
    route: 'apps/contacts',
  },
  {
    displayName: 'ContactsApp',
    iconName: 'solar:phone-rounded-linear',
    route: 'apps/contact-app',
    chip: true,
    chipClass: 'b-1 border-accent text-accent',
    chipContent: 'New',
  },
  {
    displayName: 'Courses',
    iconName: 'solar:diploma-broken',
    route: 'apps/courses',
  },
  {
    displayName: 'Employee',
    iconName: 'solar:people-nearby-linear',
    route: 'apps/employee',
  },
  {
    displayName: 'Notes',
    iconName: 'solar:palette-linear',
    route: 'apps/notes',
  },
  {
    displayName: 'Tickets',
    iconName: 'solar:ticket-linear',
    route: 'apps/tickets',
  },
  {
    displayName: 'Invoice',
    iconName: 'solar:bill-list-line-duotone',
    route: '',
    children: [
      {
        displayName: 'List',
        iconName: 'point',
        route: '/apps/invoice',
      },
      {
        displayName: 'Detail',
        iconName: 'point',
        route: '/apps/viewInvoice/101',
      },
      {
        displayName: 'Create',
        iconName: 'point',
        route: '/apps/addInvoice',
      },
      {
        displayName: 'Edit',
        iconName: 'point',
        route: '/apps/editinvoice/101',
      },
    ],
  },
  {
    displayName: 'ToDo',
    iconName: 'solar:pen-new-square-linear',
    route: 'apps/todo',
  },
  {
    displayName: 'Blog',
    iconName: 'solar:widget-4-linear',
    route: 'apps/blog',
    children: [
      {
        displayName: 'Post',
        iconName: 'point',
        route: 'apps/blog/post',
      },
      {
        displayName: 'Detail',
        iconName: 'point',
        route: 'apps/blog/detail/Early Black Friday Amazon deals: cheap TVs, headphones',
      },
    ],
  },
  {
    navCap: 'Pages',
  },
  {
    displayName: 'Roll Base Access',
    iconName: 'solar:folder-security-linear',
    route: 'apps/permission',
  },
  {
    displayName: 'Treeview',
    iconName: 'solar:three-squares-linear',
    route: 'theme-pages/treeview',
  },
  {
    displayName: 'Pricing',
    iconName: 'solar:dollar-minimalistic-linear',
    route: 'theme-pages/pricing',
  },
  {
    displayName: 'Account Setting',
    iconName: 'solar:user-circle-linear',
    route: 'theme-pages/account-setting',
  },
  {
    displayName: 'FAQ',
    iconName: 'solar:question-circle-linear',
    route: 'theme-pages/faq',
  },
  {
    displayName: 'Landingpage',
    iconName: 'solar:layers-linear',
    route: 'landingpage',
  },
  {
    displayName: 'Widgets',
    iconName: 'solar:widget-4-linear',
    route: 'widgets',
    children: [
      {
        displayName: 'Cards',
        iconName: 'point',
        route: 'widgets/cards',
      },
      {
        displayName: 'Banners',
        iconName: 'point',
        route: 'widgets/banners',
      },
      {
        displayName: 'Charts',
        iconName: 'point',
        route: 'widgets/charts',
      },
    ],
  },
  {
    navCap: 'Forms',
  },
  {
    displayName: 'Form elements',
    iconName: 'solar:notification-unread-lines-linear',
    route: 'forms/forms-elements',
    children: [
      {
        displayName: 'Autocomplete',
        iconName: 'point',
        route: 'forms/forms-elements/autocomplete',
      },
      {
        displayName: 'Button',
        iconName: 'point',
        route: 'forms/forms-elements/button',
      },
      {
        displayName: 'Checkbox',
        iconName: 'point',
        route: 'forms/forms-elements/checkbox',
      },
      {
        displayName: 'Radio',
        iconName: 'point',
        route: 'forms/forms-elements/radio',
      },
      {
        displayName: 'Datepicker',
        iconName: 'point',
        route: 'forms/forms-elements/datepicker',
      },
    ],
  },
  {
    displayName: 'Form Layouts',
    iconName: 'solar:file-text-linear',
    route: '/forms/form-layouts',
  },
  {
    displayName: 'Form Horizontal',
    iconName: 'solar:file-check-linear',
    route: '/forms/form-horizontal',
  },
  {
    displayName: 'Form Vertical',
    iconName: 'solar:file-favourite-linear',
    route: '/forms/form-vertical',
  },
  {
    displayName: 'Form Wizard',
    iconName: 'solar:download-twice-square-linear',
    route: '/forms/form-wizard',
  },
  {
    navCap: 'Tables',
  },
  {
    displayName: 'Tables',
    iconName: 'solar:window-frame-linear',
    route: 'tables',
    children: [
      {
        displayName: 'Basic Table',
        iconName: 'point',
        route: 'tables/basic-table',
      },
      {
        displayName: 'Dynamic Table',
        iconName: 'point',
        route: 'tables/dynamic-table',
      },
      {
        displayName: 'Expand Table',
        iconName: 'point',
        route: 'tables/expand-table',
      },
      {
        displayName: 'Filterable Table',
        iconName: 'point',
        route: 'tables/filterable-table',
      },
      {
        displayName: 'Footer Row Table',
        iconName: 'point',
        route: 'tables/footer-row-table',
      },
      {
        displayName: 'HTTP Table',
        iconName: 'point',
        route: 'tables/http-table',
      },
      {
        displayName: 'Mix Table',
        iconName: 'point',
        route: 'tables/mix-table',
      },
      {
        displayName: 'Multi Header Footer',
        iconName: 'point',
        route: 'tables/multi-header-footer-table',
      },
      {
        displayName: 'Pagination Table',
        iconName: 'point',
        route: 'tables/pagination-table',
      },
      {
        displayName: 'Row Context Table',
        iconName: 'point',
        route: 'tables/row-context-table',
      },
      {
        displayName: 'Selection Table',
        iconName: 'point',
        route: 'tables/selection-table',
      },
      {
        displayName: 'Sortable Table',
        iconName: 'point',
        route: 'tables/sortable-table',
      },
      {
        displayName: 'Sticky Column',
        iconName: 'point',
        route: 'tables/sticky-column-table',
      },
      {
        displayName: 'Sticky Header Footer',
        iconName: 'point',
        route: 'tables/sticky-header-footer-table',
      },
    ],
  },
  {
    displayName: 'Data table',
    iconName: 'solar:sidebar-code-linear',
    route: '/datatable/kichen-sink',
  },
  {
    navCap: 'Chart',
  },
  {
    displayName: 'Line',
    iconName: 'solar:chart-2-linear',
    route: '/charts/line',
  },
  {
    displayName: 'Gredient',
    iconName: 'solar:round-graph-linear',
    route: '/charts/gredient',
  },
  {
    displayName: 'Area',
    iconName: 'solar:graph-new-up-linear',
    route: '/charts/area',
  },
  {
    displayName: 'Candlestick',
    iconName: 'solar:tuning-3-linear',
    route: '/charts/candlestick',
  },
  {
    displayName: 'Column',
    iconName: 'solar:chart-square-linear',
    route: '/charts/column',
  },
  {
    displayName: 'Doughnut & Pie',
    iconName: 'solar:pie-chart-3-linear',
    route: '/charts/doughnut-pie',
  },
  {
    displayName: 'Radialbar & Radar',
    iconName: 'solar:radar-2-linear',
    route: '/charts/radial-radar',
  },
  {
    navCap: 'UI',
  },
  {
    displayName: 'Ui Components',
    iconName: 'solar:widget-linear',
    route: 'ui-components',
    children: [
      {
        displayName: 'Badge',
        iconName: 'point',
        route: 'ui-components/badge',
      },
      {
        displayName: 'Expansion Panel',
        iconName: 'point',
        route: 'ui-components/expansion',
      },
      {
        displayName: 'Chips',
        iconName: 'point',
        route: 'ui-components/chips',
      },
      {
        displayName: 'Dialog',
        iconName: 'point',
        route: 'ui-components/dialog',
      },
      {
        displayName: 'Lists',
        iconName: 'point',
        route: 'ui-components/lists',
      },
      {
        displayName: 'Divider',
        iconName: 'point',
        route: 'ui-components/divider',
      },
      {
        displayName: 'Menu',
        iconName: 'point',
        route: 'ui-components/menu',
      },
      {
        displayName: 'Paginator',
        iconName: 'point',
        route: 'ui-components/paginator',
      },
      {
        displayName: 'Progress Bar',
        iconName: 'point',
        route: 'ui-components/progress',
      },
      {
        displayName: 'Progress Spinner',
        iconName: 'point',
        route: 'ui-components/progress-spinner',
      },
      {
        displayName: 'Ripples',
        iconName: 'point',
        route: 'ui-components/ripples',
      },
      {
        displayName: 'Slide Toggle',
        iconName: 'point',
        route: 'ui-components/slide-toggle',
      },
      {
        displayName: 'Slider',
        iconName: 'point',
        route: 'ui-components/slider',
      },
      {
        displayName: 'Snackbar',
        iconName: 'point',
        route: 'ui-components/snackbar',
      },
      {
        displayName: 'Tabs',
        iconName: 'point',
        route: 'ui-components/tabs',
      },
      {
        displayName: 'Toolbar',
        iconName: 'point',
        route: 'ui-components/toolbar',
      },
      {
        displayName: 'Tooltips',
        iconName: 'point',
        route: 'ui-components/tooltips',
      },
    ],
  },
  {
    navCap: 'Auth',
  },
  {
    displayName: 'Login',
    iconName: 'solar:lock-keyhole-minimalistic-linear',
    route: '/authentication',
    children: [
      {
        displayName: 'Side Login',
        iconName: 'point',
        route: '/authentication/login',
      },
      {
        displayName: 'Boxed Login',
        iconName: 'point',
        route: '/authentication/boxed-login',
      },
    ],
  },
  {
    displayName: 'Register',
    iconName: 'solar:user-plus-rounded-linear',
    route: '/authentication',
    children: [
      {
        displayName: 'Side Register',
        iconName: 'point',
        route: '/authentication/side-register',
      },
      {
        displayName: 'Boxed Register',
        iconName: 'point',
        route: '/authentication/boxed-register',
      },
    ],
  },
  {
    displayName: 'Forgot Password',
    iconName: 'solar:password-minimalistic-input-linear',
    route: '/authentication',
    children: [
      {
        displayName: 'Side Forgot Password',
        iconName: 'point',
        route: '/authentication/side-forgot-pwd',
      },
      {
        displayName: 'Boxed Forgot Password',
        iconName: 'point',
        route: '/authentication/boxed-forgot-pwd',
      },
    ],
  },
  {
    displayName: 'Two Steps',
    iconName: 'solar:compass-big-linear',
    route: '/authentication',
    children: [
      {
        displayName: 'Side Two Steps',
        iconName: 'point',
        route: '/authentication/side-two-steps',
      },
      {
        displayName: 'Boxed Two Steps',
        iconName: 'point',
        route: '/authentication/boxed-two-steps',
      },
    ],
  },
  {
    displayName: 'Error',
    iconName: 'solar:shield-warning-linear',
    route: '/authentication/error',
  },
  {
    displayName: 'Maintenance',
    iconName: 'solar:calendar-minimalistic-linear',
    route: '/authentication/maintenance',
  },
  {
    navCap: 'Other',
  },
  {
    displayName: 'Menu Level',
    iconName: 'solar:layers-minimalistic-line-duotone',
    route: 'menu-level',
    children: [
      {
        displayName: 'Menu 1',
        iconName: 'point',
        route: '/menu-level/menu-1',
        children: [
          {
            displayName: 'Menu 1',
            iconName: 'point',
            route: '/menu-level/menu-1',
          },

          {
            displayName: 'Menu 2',
            iconName: 'point',
            route: '/menu-level/menu-2',
          },
        ],
      },

      {
        displayName: 'Menu 2',
        iconName: 'point',
        route: '/menu-2',
      },
    ],
  },
  {
    displayName: 'Disabled',
    iconName: 'solar:forbidden-circle-line-duotone',
    route: '/disabled',
    disabled: true,
  },
  {
    displayName: 'Chip',
    iconName: 'solar:shield-check-line-duotone',
    route: '/',
    chip: true,
    chipClass: 'bg-primary text-white',
    chipContent: '9',
  },
  {
    displayName: 'Outlined',
    iconName: 'solar:smile-circle-outline',
    route: '/',
    chip: true,
    chipClass: 'b-1 border-primary text-primary',
    chipContent: 'outlined',
  },
  {
    displayName: 'External Link',
    iconName: 'solar:link-square-linear',
    route: 'https://www.google.com/',
    external: true,
  },
];
