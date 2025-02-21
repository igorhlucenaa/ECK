import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Auth, User } from '@angular/fire/auth';
import { AuthService } from './services/apps/authentication/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  constructor(
    private auth: Auth,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Verifica o estado de autenticação apenas na inicialização
    this.auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        try {
          await this.authService.applyUserTheme();
          const role = await this.authService.getCurrentUserRole();
          const currentUrl = this.router.url.split('?')[0];

          // Define páginas públicas que não requerem redirecionamento
          const publicPages = ['/', '/assessment'];
          const isPublicPage = publicPages.includes(currentUrl);

          if (isPublicPage) {
            return; // Não redireciona em páginas públicas
          }

          // Redireciona para dashboard apenas se estiver em uma rota inicial ou inválida
          if (role === 'admin_master' || role === 'admin_client') {
            if (currentUrl === '/' || currentUrl === '') {
              this.router.navigate(['/dashboard']);
            }
          } else {
            console.warn(
              'Papel do usuário não reconhecido. Redirecionando para login.'
            );
            this.router.navigate(['/authentication/login']);
          }
        } catch (error) {
          console.error('Erro ao processar autenticação:', error);
          this.router.navigate(['/authentication/login']);
        }
      } else {
        // Se não houver usuário autenticado, redireciona para login, exceto em páginas públicas
        const currentUrl = this.router.url.split('?')[0];
        const publicPages = ['/', '/assessment'];
        if (!publicPages.includes(currentUrl)) {
          this.router.navigate(['/authentication/login']);
        }
      }
    });

    // Opcional: log de navegação para debug
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        )
      )
      .subscribe((event) => {
        console.log('Current URL:', event.urlAfterRedirects);
      });
  }
}
