import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Auth, User } from '@angular/fire/auth';
import { AuthService } from './services/apps/authentication/auth.service';

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
    // Verifica o estado de autenticação ao inicializar o app
    this.auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        try {
          // Aplica o tema do usuário
          await this.authService.applyUserTheme();

          // Obtém o papel do usuário
          const role = await this.authService.getCurrentUserRole();

          // Redireciona com base no papel do usuário
          if (role === 'admin_master') {
            this.router.navigate(['/dashboard']);
          } else if (role === 'admin_client') {
            this.router.navigate(['/dashboard']); // Redireciona para a página de usuários
          } else {
            console.warn(
              'Papel do usuário não reconhecido. Redirecionando para login.'
            );
            this.router.navigate(['/authentication/login']);
          }
        } catch (error) {
          console.error(
            'Erro ao redirecionar com base no papel do usuário:',
            error
          );
          this.router.navigate(['/authentication/login']);
        }
      } else {
        // Se o usuário não estiver autenticado, redirecione para a página de login
        this.router.navigate(['/authentication/login']);
      }
    });
  }
}
