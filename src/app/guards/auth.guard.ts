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

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    const requiredRole = route.data['role']; // Role necessário, se houver

    return this.authService.getCurrentUserRole().then((userRole) => {
      if (!requiredRole || userRole === requiredRole) {
        return true; // Permite o acesso
      }
      this.router.navigate(['/authentication/login']); // Redireciona para login se não permitido
      return false;
    });
  }
}
