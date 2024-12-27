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
    const requiredRole = route.data['role']; // Papel necessário para a rota (pode ser string ou array)

    try {
      const userRole = await this.authService.getCurrentUserRole();

      // Garantir que o `admin_master` tenha acesso irrestrito
      if (userRole === 'admin_master') {
        return true; // Permitir acesso para admin_master
      }

      // Verificar se `requiredRole` é um array ou string e validar o acesso
      if (Array.isArray(requiredRole)) {
        if (requiredRole.includes(userRole)) {
          return true;
        }
      } else if (requiredRole === userRole) {
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
