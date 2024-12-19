import { Injectable, signal } from '@angular/core';
import { Event, NavigationEnd, Router } from '@angular/router';
import { AuthService } from './apps/authentication/auth.service';

@Injectable({ providedIn: 'root' })
export class NavService {
  showClass: any = false;

  public currentUrl = signal<string | undefined>(undefined);

  constructor(private router: Router, private authService: AuthService) {
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
      }
    });
  }

  async getClientId(): Promise<string | null> {
    try {
      return await this.authService.getCurrentUserClientId();
    } catch (error) {
      console.error('Erro ao obter clientId:', error);
      return null;
    }
  }
}
