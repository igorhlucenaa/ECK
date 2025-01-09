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
    this.auth.onAuthStateChanged((user: User | null) => {
      if (user) {
        this.authService.applyUserTheme();
        // Se o usuário estiver autenticado, redirecione para a página principal
        this.router.navigate(['/clients']);
      } else {
        // Se o usuário não estiver autenticado, redirecione para a página de login
        this.router.navigate(['/authentication/login']);
      }
    });
  }
}
