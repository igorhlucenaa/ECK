/**
 * ATENÇÃO: Este arquivo não está sendo usado na aplicação atual.
 * Esta aplicação está utilizando componentes standalone e bootstrapApplication.
 * A configuração atual está em src/app/app.config.ts e a inicialização em src/main.ts.
 *
 * Este arquivo é mantido apenas para referência ou compatibilidade com versões anteriores.
 */

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getStorage, provideStorage } from '@angular/fire/storage';

import { AppComponent } from './app.component';
import { AuthService } from './pages/auth/services/auth.service';
import { routes } from './app.routes';

// Configuração do Firebase (substitua pelos valores reais do seu projeto)
const firebaseConfig = {
  apiKey: "sua-api-key",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "seu-messaging-sender-id",
  appId: "seu-app-id"
};

// Este módulo não é usado na aplicação atual, que utiliza a abordagem standalone do Angular 18
@NgModule({
  declarations: [],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    RouterModule.forRoot(routes),
  ],
  providers: [
    AuthService,
  ],
  bootstrap: []
})
export class AppModule { }
