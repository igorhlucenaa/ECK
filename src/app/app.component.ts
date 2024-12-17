import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Auth, User } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  constructor(private auth: Auth, private router: Router) {}

  ngOnInit(): void {
    // Verifica o estado de autenticação ao inicializar o app
    this.auth.onAuthStateChanged((user: User | null) => {
      if (user) {
        // Se o usuário estiver autenticado, redirecione para a página principal
        this.router.navigate(['/starter']);
      } else {
        // Se o usuário não estiver autenticado, redirecione para a página de login
        this.router.navigate(['/authentication/login']);
      }
    });
  }
}
