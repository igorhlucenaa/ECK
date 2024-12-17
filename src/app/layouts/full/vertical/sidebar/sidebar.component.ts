import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { BrandingComponent } from './branding.component';
import { NgIf } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    BrandingComponent,
    NgIf,
    TablerIconsModule,
    MaterialModule,
    RouterModule,
    MatButtonModule,
  ],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  userRole: string | null = null;
  userName: string | null = null;

  constructor(private authService: AuthService) {}
  @Input() showToggle = true;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  ngOnInit(): void {
    // Obter o nome do usuário logado
    this.authService.getCurrentUserName().then((name) => {
      this.userName = name;
      console.log('Nome do usuário:', name);
    });
  }
}
