import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  signOut,
  reload,
  User,
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
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  }

  async getCurrentUserRole(): Promise<string | null> {
    try {
      let user: User | null = this.auth.currentUser;

      // Recarrega o usuário autenticado se for nulo
      if (!user) {
        console.warn(
          'Nenhum usuário autenticado encontrado. Tentando reload...'
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Espera pequena para garantir sincronização
        user = this.auth.currentUser;

        if (user) {
          await reload(user); // Usa o método reload no objeto do tipo User
        } else {
          console.warn(
            'Usuário ainda não autenticado após tentativa de reload.'
          );
          return null;
        }
      }

      const docRef = doc(this.firestore, `users/${user.uid}`);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.error(
          `Documento do usuário com UID ${user.uid} não encontrado.`
        );
        return null;
      }

      const data = docSnap.data();

      if (data && data['role']) {
        return data['role'] as string;
      } else {
        console.warn(`Campo "role" ausente no documento do usuário.`);
        return null;
      }
    } catch (error) {
      console.error('Erro ao obter papel do usuário:', error);
      return null;
    }
  }

  async getCurrentUserClientId(): Promise<string | null> {
    try {
      const user = this.auth.currentUser;
      if (user) {
        const docRef = doc(this.firestore, `users/${user.uid}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          return docSnap.data()['clientId'] || null;
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter clientId do usuário:', error);
      return null;
    }
  }

  async getCurrentUserName(): Promise<string | null> {
    try {
      const user = this.auth.currentUser;
      if (user) {
        const docRef = doc(this.firestore, `users/${user.uid}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          return docSnap.data()['name'] || null;
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter nome do usuário:', error);
      return null;
    }
  }

  async getCurrentUserEmail(): Promise<string | null> {
    try {
      const user = this.auth.currentUser;
      if (user) {
        return user.email;
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter o e-mail do usuário:', error);
      return null;
    }
  }
}
