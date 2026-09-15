import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

@Injectable({
  providedIn: 'root',
})
export class UserAdminService {
  private readonly app = inject(FirebaseApp);

  async setUserPasswordByMaster(email: string, password: string): Promise<void> {
    const functions = getFunctions(this.app, 'us-central1');
    const callable = httpsCallable<{ email: string; password: string }, { ok: boolean }>(
      functions,
      'setUserPasswordByMaster'
    );
    await callable({ email: email.trim(), password });
  }
}
