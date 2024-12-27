import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from '../services/apps/authentication/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    const requiredRole = route.data['role']; // Papel necessário para a rota

    try {
      const userRole = await this.authService.getCurrentUserRole();

      // Garantir que o `admin_master` tenha acesso irrestrito
      if (userRole === 'admin_master') {
        return true; // Permitir acesso para admin_master
      }

      // Permitir acesso se o papel do usuário corresponder ao necessário
      if (!requiredRole || userRole === requiredRole) {
        return true;
      }

      console.warn('Acesso negado: Redirecionando para login.');
      this.router.navigate(['/authentication/login']);
      return false;
    } catch (error) {
      console.error('Erro ao verificar papel do usuário:', error);
      this.router.navigate(['/authentication/login']);
      return false; // Bloqueia acesso em caso de erro
    }
  }
}
