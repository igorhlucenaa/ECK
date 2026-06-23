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
import { AppRole, resolveRequiredRoles } from '../config/permissions.config';

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
    const currentUser = await firstValueFrom(user(this.auth));

    if (!currentUser) {
      if (state.url !== '/authentication/login') {
        localStorage.setItem('returnUrl', state.url);
      }
      this.router.navigate(['/authentication/login']);
      return false;
    }

    const requiredRoles = resolveRequiredRoles(route.data);

    try {
      const userRole = (await this.authService.getCurrentUserRole()) as AppRole | null;

      if (requiredRoles.length === 0) {
        return true;
      }

      if (userRole && requiredRoles.includes(userRole)) {
        return true;
      }

      this.router.navigate(['/nao-autorizado']);
      return false;
    } catch (error) {
      console.error('Erro ao verificar papel do usuário:', error);
      this.router.navigate(['/authentication/login']);
      return false;
    }
  }
}
