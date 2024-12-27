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
  user,
} from '@angular/fire/auth';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

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

  getCurrentUserClientIdSync(): string | null {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.clientId || null;
  }

  async applyUserTheme(): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }

      const userDocRef = doc(this.firestore, `users/${user.uid}`);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const clientId = userDocSnap.data()['clientId'];
        if (clientId) {
          const clientDocRef = doc(this.firestore, `clients/${clientId}`);
          const clientDocSnap = await getDoc(clientDocRef);

          if (clientDocSnap.exists()) {
            const themeColor = clientDocSnap.data()['themeColor'] || '#000000';

            // Aplica as cores ao tema dinâmico
            document.documentElement.style.setProperty(
              '--primary-color',
              themeColor
            );
            document.documentElement.style.setProperty(
              '--primary-color-light',
              this.lightenColor(themeColor, 40)
            );
            document.documentElement.style.setProperty(
              '--primary-color-dark',
              this.darkenColor(themeColor, 20)
            );
          }
        }
      }
    } catch (error) {
      console.error('Erro ao aplicar tema do usuário:', error);
    }
  }

  // Adicione as funções auxiliares de manipulação de cor:
  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return `#${(
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)}`;
  }

  private darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return `#${(
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)}`;
  }

  async getCurrentUser(): Promise<{ name: string; email: string } | null> {
    const firebaseUser = await firstValueFrom(user(this.auth));
    if (firebaseUser) {
      const userDocRef = doc(this.firestore, `users/${firebaseUser.uid}`);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          name: userData['name'] || 'Usuário Desconhecido',
          email: userData['email'] || 'Email não informado',
        };
      }
    }
    return null;
  }
}
