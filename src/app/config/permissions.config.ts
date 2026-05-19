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
  | 'reports'
  | 'competencies'
  | 'orders'
  | 'users'
  | 'mail-templates';

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
      'reports',
      'competencies',
      'orders',
      'users',
      'mail-templates',
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
    routes: ['dashboard', 'projects', 'assessments', 'reports'],
    actions: ['visualizar', 'exportar'],
  },

  viewer: {
    routes: ['dashboard', 'projects', 'assessments', 'reports'],
    actions: ['visualizar', 'exportar', 'responder_avaliacao', 'visualizar_proprio_relatorio'],
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
