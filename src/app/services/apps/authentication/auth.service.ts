import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from '@angular/fire/auth';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private auth: Auth, private firestore: Firestore) {}

  // Login
  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  // Registro
  register(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  // Recuperar Senha
  resetPassword(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }

  // Logout
  logout() {
    return signOut(this.auth);
  }

  // Role
  async getCurrentUserRole(): Promise<string | null> {
    try {
      const user = this.auth.currentUser;
      // console.log('Usuário atual:', user);
  
      if (user) {
        const docRef = doc(this.firestore, `users/${user.uid}`);
        // console.log('Referência do documento:', docRef);
  
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          // console.log('Dados do Firestore:', data);
  
          if (data['role']) {
            return data['role']; // Retorna o papel do usuário
          } else {
            console.warn('Campo "role" não encontrado no documento.');
            return null;
          }
        } else {
          console.warn('Documento do usuário não encontrado no Firestore.');
          return null;
        }
      } else {
        console.warn('Usuário não autenticado.');
        return null;
      }
    } catch (error) {
      console.error('Erro ao obter papel do usuário:', error);
      return null;
    }
  }
  
}
