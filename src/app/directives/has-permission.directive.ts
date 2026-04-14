import {
  Directive,
  Input,
  OnInit,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { AuthService } from '../services/apps/authentication/auth.service';
import { AppAction, hasPermission, AppRole } from '../config/permissions.config';

/**
 * Diretiva estrutural que exibe o elemento somente se o usuário logado
 * possuir a permissão (action) solicitada.
 *
 * Uso:
 *   <button *hasPermission="'criar'">Novo</button>
 *   <button *hasPermission="['criar', 'editar']">Ação</button>
 */
@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective implements OnInit {
  private requiredActions: AppAction[] = [];
  private hasView = false;

  @Input()
  set hasPermission(actions: AppAction | AppAction[]) {
    this.requiredActions = Array.isArray(actions) ? actions : [actions];
  }

  constructor(
    private templateRef: TemplateRef<unknown>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentUserRole().then((role) => {
      const allowed = this.requiredActions.some((action) =>
        hasPermission((role ?? 'viewer') as AppRole, action)
      );

      if (allowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
