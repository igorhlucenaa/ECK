import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable } from 'rxjs';
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
    // console.log('Rota requisitada:', state.url);
    // console.log('Papel necessário:', requiredRole);

    try {
      const userRole = await this.authService.getCurrentUserRole();
      // console.log('Papel do usuário:', userRole);

      if (!requiredRole || userRole === requiredRole) {
        return true; // Permite acesso se o papel for válido
      }

      console.warn('Acesso negado: Redirecionando para login.');
      this.router.navigate(['/authentication/login']);
      return false; // Bloqueia acesso se o papel não corresponder
    } catch (error) {
      console.error('Erro ao verificar papel do usuário:', error);
      this.router.navigate(['/authentication/login']);
      return false; // Bloqueia acesso em caso de erro
    }
  }
}
