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
    const requiredRole = route.data['role'];

    try {
      const userRole = await this.authService.getCurrentUserRole();

      if (userRole === 'admin_master') {
        // Redireciona para 'products' se o papel for 'admin_master'
        if (state.url === '/authentication/login') {
          this.router.navigate(['/projects']);
          return false;
        }
        return true;
      }

      if (Array.isArray(requiredRole)) {
        if (requiredRole.includes(userRole)) {
          return true;
        }
      } else if (requiredRole === userRole) {
        return true;
      }

      this.router.navigate(['/authentication/login']);
      return false;
    } catch (error) {
      console.error('Erro ao verificar papel do usuário:', error);
      this.router.navigate(['/authentication/login']);
      return false;
    }
  }
}
