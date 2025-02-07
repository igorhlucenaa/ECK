import { Component, inject } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import {
  FormGroup,
  FormControl,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { MaterialModule } from 'src/app/material.module';
import { NgIf } from '@angular/common';
import {
  Auth,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
} from '@angular/fire/auth';
import { collection, Firestore, getDocs, where } from '@angular/fire/firestore';
import { query } from 'firebase/firestore/lite';

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
  form = new FormGroup({
    uname: new FormControl('', [Validators.required, Validators.email]), // E-mail
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]), // Senha
    rememberMe: new FormControl(false), // Lembrar-me
  });

  private firestore = inject(Firestore);
  private auth = inject(Auth);

  errorMessage: string = ''; // Mensagens de erro
  isLoading: boolean = false; // Indicador de carregamento

  constructor(
    private settings: CoreService,
    private authService: AuthService,
    private router: Router
  ) {}

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

    const { uname, password, rememberMe } = this.form.value;

    try {
      // 🔹 Verifica se o usuário já está cadastrado no Firestore
      const usersCollection = collection(this.firestore, 'users');
      const userQuery = query(usersCollection, where('email', '==', uname));
      const querySnapshot = await getDocs(userQuery);

      if (!querySnapshot.empty) {
        // 🔹 Verifica se já existe no Firebase Authentication
        const signInMethods = await fetchSignInMethodsForEmail(
          this.auth,
          uname!
        );

        if (signInMethods.length === 0) {
          // 🔹 Se não existir no Firebase Auth, cria automaticamente
          await createUserWithEmailAndPassword(this.auth, uname!, '123@qwe');
        }

        // 🔹 Agora faz login normalmente
        await this.authService.login(uname!, password!, rememberMe!);
        this.router.navigate(['/starter']); // Redireciona após login bem-sucedido
      } else {
        this.errorMessage = 'Usuário não cadastrado. Contate um administrador.';
      }
    } catch (error: any) {
      this.errorMessage =
        error.message || 'Erro ao realizar login. Tente novamente.';
    } finally {
      this.isLoading = false;
    }
  }
}
