import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/apps/authentication/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    private auth: Auth
  ) {}

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    // Aguarda o Firebase restaurar a sessão (resolve o bug do refresh que redireciona para login)
    const currentUser = await firstValueFrom(user(this.auth));

    if (!currentUser) {
      // Salva a URL atual para restaurar após login
      if (state.url !== '/authentication/login') {
        localStorage.setItem('returnUrl', state.url);
      }
      this.router.navigate(['/authentication/login']);
      return false;
    }

    const requiredRole = route.data['role'];

    try {
      const userRole = await this.authService.getCurrentUserRole();

      // Se não há restrição de role na rota, qualquer usuário autenticado passa
      if (!requiredRole) {
        return true;
      }

      const allowed = Array.isArray(requiredRole)
        ? requiredRole.includes(userRole)
        : requiredRole === userRole;

      if (allowed) {
        return true;
      }

      // Usuário autenticado mas sem permissão → página de não autorizado
      this.router.navigate(['/nao-autorizado']);
      return false;
    } catch (error) {
      console.error('Erro ao verificar papel do usuário:', error);
      this.router.navigate(['/authentication/login']);
      return false;
    }
  }
}
