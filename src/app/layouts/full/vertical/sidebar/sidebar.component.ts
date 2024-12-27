import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  userRole: string | null = null;
  userName: string | null = null;
  logo: string | null = null;

  constructor(private authService: AuthService, private firestore: Firestore) {}

  @Input() showToggle = true;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  ngOnInit(): void {
    // Obter o nome do usuário logado
    this.authService.getCurrentUserName().then((name) => {
      this.userName = name;
    });

    // Obter a logo do cliente
    this.authService.getCurrentUserClientId().then((clientId) => {
      if (clientId) {
        this.loadClientLogo(clientId);
      }
    });
  }

  private async loadClientLogo(clientId: string): Promise<void> {
    try {
      const clientDoc = doc(this.firestore, `clients/${clientId}`);
      const clientSnap = await getDoc(clientDoc);

      if (clientSnap.exists()) {
        this.logo = clientSnap.data()['logo'] || null;
        console.log('Logo carregada:', this.logo);
      }
    } catch (error) {
      console.error('Erro ao carregar a logo do cliente:', error);
    }
  }
}
