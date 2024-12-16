import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  signOut,
} from '@angular/fire/auth';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private auth: Auth, private firestore: Firestore) {}

  async login(
    email: string,
    password: string,
    rememberMe: boolean
  ): Promise<void> {
    try {
      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;

      await this.auth.setPersistence(persistence).then(async () => {
        await signInWithEmailAndPassword(this.auth, email, password);
      });
    } catch (error) {
      console.error('Erro no login:', error);
      throw new Error('Falha ao realizar login. Verifique suas credenciais.');
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      console.error('Erro ao redefinir senha:', error);
      throw new Error('Erro ao enviar o e-mail de redefinição.');
    }
  }

  async logout(): Promise<void> {
    try {
      await this.auth.setPersistence(browserSessionPersistence); // Redefine persistência
      await signOut(this.auth); // Realiza logout
      console.log('Usuário deslogado com persistência redefinida.');
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  }

  async getCurrentUserRole(): Promise<string | null> {
    try {
      const user = this.auth.currentUser;
      if (user) {
        const docRef = doc(this.firestore, `users/${user.uid}`);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data()['role'] as string) : null;
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter papel do usuário:', error);
      return null;
    }
  }
}
