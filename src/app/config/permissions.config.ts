export type AppRole = 'admin_master' | 'admin_client' | 'viewer';

export type AppAction =
  | 'criar'
  | 'editar'
  | 'excluir'
  | 'visualizar'
  | 'exportar'
  | 'bloquear'
  | 'aprovar'
  | 'gerenciar_usuarios'
  | 'gerenciar_viewers'
  | 'criar_grupos'
  | 'responder_avaliacao'
  | 'visualizar_proprio_relatorio';

export type AppRoute =
  | 'dashboard'
  | 'clients'
  | 'projects'
  | 'assessments'
  | 'participants'
  | 'reports'
  | 'competencies'
  | 'orders'
  | 'users'
  | 'mail-templates'
  | 'settings'
  | 'emails-notifications';

export interface RolePermissions {
  routes: AppRoute[];
  actions: AppAction[];
}

export const PERMISSIONS: Record<AppRole, RolePermissions> = {
  admin_master: {
    routes: [
      'dashboard',
      'clients',
      'projects',
      'assessments',
      'participants',
      'reports',
      'competencies',
      'orders',
      'users',
      'mail-templates',
      'settings',
      'emails-notifications',
    ],
    actions: [
      'criar',
      'editar',
      'excluir',
      'visualizar',
      'exportar',
      'bloquear',
      'aprovar',
      'gerenciar_usuarios',
      'gerenciar_viewers',
      'criar_grupos',
    ],
  },

  admin_client: {
    routes: [
      'dashboard',
      'clients',
      'projects',
      'participants',
      'reports',
      'orders',
      'users', // página Usuários e Grupos — admin_client acessa apenas a aba Grupos
      'mail-templates',
      'settings',
      'emails-notifications',
    ],
    actions: ['criar', 'editar', 'visualizar', 'exportar', 'bloquear', 'gerenciar_viewers'],
  },

  viewer: {
    routes: ['dashboard', 'projects', 'participants', 'reports', 'settings'],
    actions: ['visualizar', 'exportar', 'visualizar_proprio_relatorio'],
  },
};

/** Verifica se um perfil possui uma determinada ação */
export function hasPermission(role: AppRole, action: AppAction): boolean {
  return PERMISSIONS[role]?.actions.includes(action) ?? false;
}

/** Verifica se um perfil tem acesso a uma rota */
export function canAccessRoute(role: AppRole, route: AppRoute): boolean {
  return PERMISSIONS[role]?.routes.includes(route) ?? false;
}

/** Retorna os papéis autorizados para uma rota (fonte única para guards). */
export function getRolesForRoute(route: AppRoute): AppRole[] {
  return (Object.keys(PERMISSIONS) as AppRole[]).filter((role) => canAccessRoute(role, route));
}

/** Resolve papéis exigidos pela rota ativada (appRoute tem prioridade sobre role legado). */
export function resolveRequiredRoles(routeData: {
  appRoute?: AppRoute;
  role?: AppRole | AppRole[] | string | string[];
}): AppRole[] {
  if (routeData.appRoute) {
    return getRolesForRoute(routeData.appRoute);
  }

  const legacy = routeData.role;
  if (!legacy) return [];

  const roles = Array.isArray(legacy) ? legacy : [legacy];
  return roles.filter((r): r is AppRole =>
    r === 'admin_master' || r === 'admin_client' || r === 'viewer'
  );
}
