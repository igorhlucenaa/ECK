import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Auth, User } from '@angular/fire/auth';
import { AuthService } from './services/apps/authentication/auth.service';
import { filter } from 'rxjs/operators';
import { GlobalLoadingComponent } from './components/global-loading/global-loading.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GlobalLoadingComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  constructor(
    private auth: Auth,
    private router: Router,
    private authService: AuthService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // i18n: inicialização de idioma
    const supportedLangs = ['pt-BR', 'es', 'en'];
    this.translate.addLangs(supportedLangs);
    const storedLang = localStorage.getItem('lang');
    const browserLang = this.translate.getBrowserLang();
    const initialLang = storedLang || (browserLang === 'pt' ? 'pt-BR' : (supportedLangs.includes(browserLang || '') ? (browserLang as string) : 'pt-BR'));
    this.translate.setDefaultLang('pt-BR');
    this.translate.use(initialLang);

    this.auth.onAuthStateChanged(async (user: User | null) => {
      const currentUrl = this.router.url.split('?')[0];
      console.log(
        'Auth state changed. User:',
        user ? user.uid : null,
        'Current URL:',
        currentUrl
      );

      if (user) {
        try {
          await this.authService.applyUserTheme();
          const role = await this.authService.getCurrentUserRole();

          const publicPages = ['/', '/assessment'];
          const isPublicPage = publicPages.includes(currentUrl);

          if (isPublicPage) {
            return; // Não interfere em páginas públicas
          }

          // Permite a navegação após login sem forçar redirecionamento
          if (role === 'admin_master' || role === 'admin_client') {
            if (
              currentUrl === '/' ||
              currentUrl === '' ||
              currentUrl.includes('/authentication')
            ) {
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
        // Se não houver usuário, permite acesso a páginas públicas e login
        const allowedPages = ['/', '/assessment', '/authentication/login'];
        if (!allowedPages.includes(currentUrl)) {
                    this.router.navigate(['/authentication/login']);
        }
      }
    });

    // Log de navegação para debug
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        )
      )
      .subscribe((event) => {
              });
  }
}
