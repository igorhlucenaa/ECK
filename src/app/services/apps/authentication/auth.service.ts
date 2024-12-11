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
    const user = this.auth.currentUser;
    if (user) {
      const docRef = doc(this.firestore, `users/${user.uid}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data()['role']; // Retorna o role do usuário
      }
    }
    return null; // Retorna null se o usuário não estiver logado ou não tiver role
  }
}
