import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root',
})
export class UserAdminService {
  private readonly functions = inject(Functions);

  async setUserPasswordByMaster(email: string, password: string): Promise<void> {
    const callable = httpsCallable<{ email: string; password: string }, { ok: boolean }>(
      this.functions,
      'setUserPasswordByMaster'
    );
    await callable({ email: email.trim(), password });
  }

  /** E-mail de reset com layout ECK (Cloud Function). */
  async sendBrandedPasswordResetEmail(
    email: string,
    continueUrl?: string
  ): Promise<void> {
    const callable = httpsCallable<
      { email: string; continueUrl?: string },
      { ok: boolean }
    >(this.functions, 'sendBrandedPasswordResetEmail');
    const loginUrl =
      continueUrl ||
      `${typeof window !== 'undefined' ? window.location.origin : ''}/authentication/login`;
    await callable({ email: email.trim(), continueUrl: loginUrl });
  }
}
