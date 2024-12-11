import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

@Component({
  selector: 'app-side-login',
  standalone: true,
  imports: [
    RouterModule,
    MaterialModule,
    NgIf,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './side-login.component.html',
})
export class AppSideLoginComponent {
  options = this.settings.getOptions();
  errorMessage: string = ''; // Para mensagens de erro
  isLoading: boolean = false; // Indicador de carregamento

  constructor(
    private settings: CoreService,
    private authService: AuthService,
    private router: Router
  ) {}

  form = new FormGroup({
    uname: new FormControl('', [Validators.required, Validators.email]), // Campo de email
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]), // Campo de senha
  });

  get f() {
    return this.form.controls;
  }

  async submit() {
    if (this.form.invalid) {
      this.errorMessage = 'Preencha os campos corretamente.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = ''; // Limpa mensagens anteriores

    const { uname, password } = this.form.value;

    try {
      // Login com o AuthService
      console.log(uname)
      await this.authService.login(uname!, password!).then(res=>console.log(res))
      this.router.navigate(['/starter']); // Redireciona para a página inicial após login
      console.log('entrou no try')
    } catch (error: any) {
      // Captura erros do serviço de autenticação
      this.errorMessage =
        error.message || 'Erro ao realizar login. Tente novamente.';
    } finally {
      this.isLoading = false;
    }
  }
}
