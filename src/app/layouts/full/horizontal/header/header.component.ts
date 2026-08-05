import {
  Component,
  Output,
  EventEmitter,
  Input,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { MatDialog } from '@angular/material/dialog';
import { navItems } from '../../vertical/sidebar/sidebar-data';
import { navItems as hNavItems } from '../sidebar/sidebar-data';
import { AppHorizontalNavItemComponent } from '../sidebar/nav-item/nav-item.component';
import { TranslateService } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { BrandingComponent } from '../../vertical/sidebar/branding.component';
import { NgFor, NgForOf, CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { TourService } from 'src/app/services/tour/tour.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogRef } from '@angular/material/dialog';
import {
  Auth,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from '@angular/fire/auth';

interface notifications {
  id: number;
  img: string;
  title: string;
  subtitle: string;
}

interface msgs {
  id: number;
  img: string;
  title: string;
  subtitle: string;
}

interface profiledd {
  id: number;
  img: string;
  title: string;
  subtitle: string;
  link: string;
}

@Component({
  selector: 'app-horizontal-header',
  standalone: true,
  imports: [RouterModule, TablerIconsModule, MaterialModule, NgFor, AppHorizontalNavItemComponent, CommonModule],
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .lang-pill {
      display: flex;
      align-items: center;
      gap: 7px;
      height: 36px;
      padding: 0 12px 0 8px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.1);
      min-width: unset;
      transition: background 0.15s;
    }
    .lang-pill:hover { background: rgba(255,255,255,0.2); }
    .lang-pill__inner {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 6px;
    }
    .lang-flag-img {
      width: 24px;
      height: 16px;
      border-radius: 3px;
      object-fit: cover;
      display: block;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }
    .lang-pill__code {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.6px;
      color: inherit;
      line-height: 1;
    }
    .lang-pill__arrow {
      font-size: 16px;
      width: 16px;
      height: 16px;
      line-height: 16px;
      opacity: 0.6;
    }
    .lang-menu-item.mat-mdc-menu-item {
      min-height: 48px;
    }
    .lang-menu-item .mdc-list-item__primary-text {
      display: flex;
      align-items: center;
      width: 100%;
      gap: 10px;
    }
    .lang-flag-menu {
      width: 26px;
      height: 18px;
      border-radius: 3px;
      object-fit: cover;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .lang-code-tag {
      font-size: 10px;
      font-weight: 700;
      color: #1B84FF;
      background: #e8f1ff;
      border-radius: 5px;
      padding: 2px 7px;
      margin-left: auto;
      letter-spacing: 0.5px;
    }
  `],
})
export class AppHorizontalHeaderComponent implements OnInit {
  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleMobileFilterNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  showFiller = false;
  userName = '';
  userEmail = '';
  horizontalNavItems: any[] = [];

  public selectedLanguage: any = {
    language: 'Português',
    code: 'pt-BR',
    type: 'PT',
    icon: '/assets/images/flag/icon-flag-pt-br.svg',
  };

  public languages: any[] = [
    {
      language: 'Português',
      code: 'pt-BR',
      type: 'PT',
      icon: '/assets/images/flag/icon-flag-pt-br.svg',
    },
    {
      language: 'Español',
      code: 'es',
      type: 'ES',
      icon: '/assets/images/flag/icon-flag-es.svg',
    },
    {
      language: 'English',
      code: 'en',
      type: 'EN',
      icon: '/assets/images/flag/icon-flag-en.svg',
    },
  ];

  constructor(
    private vsidenav: CoreService,
    public dialog: MatDialog,
    private translate: TranslateService,
    private authService: AuthService,
    public tourService: TourService,
    private snackBar: MatSnackBar,
    private firebaseAuth: Auth,
  ) {
    translate.setDefaultLang('pt-BR');
    const storedLang = localStorage.getItem('lang');
    const current = storedLang || this.translate.currentLang || 'pt-BR';
    const found = this.languages.find((l) => l.code === current);
    if (found) {
      this.selectedLanguage = found;
      this.translate.use(found.code);
    }
  }

  async ngOnInit(): Promise<void> {
    this.userName = (await this.authService.getCurrentUserName()) ?? '';
    this.userEmail = (await this.authService.getCurrentUserEmail()) ?? '';
    const role = await this.authService.getCurrentUserRole();
    this.horizontalNavItems = this.filterNavItemsByRole(hNavItems, role);
  }

  private filterNavItemsByRole(items: any[], role: string | null): any[] {
    return items
      .filter(item => {
        if (!item.displayName) return false;
        if (!item.role) return true;
        const roles = Array.isArray(item.role) ? item.role : [item.role];
        return role && roles.includes(role);
      })
      .map(item => ({
        ...item,
        children: item.children ? this.filterChildrenByRole(item.children, role) : undefined,
      }));
  }

  private filterChildrenByRole(items: any[], role: string | null): any[] {
    return items.filter(item => {
      if (!item.role) return true;
      const roles = Array.isArray(item.role) ? item.role : [item.role];
      return role && roles.includes(role);
    });
  }

  openChangePasswordDialog(): void {
    const dialogRef = this.dialog.open(AppChangePasswordDialogComponent, {
      width: '400px',
    });
    dialogRef.afterClosed().subscribe((success) => {
      if (success) {
        this.snackBar.open('Senha alterada com sucesso!', 'Fechar', { duration: 3000 });
      }
    });
  }

  logout() {
    this.authService.logout().then(() => {
      console.log("logout success")
    })
  }
  openDialog() {
    const dialogRef = this.dialog.open(AppHorizontalSearchDialogComponent);

    dialogRef.afterClosed().subscribe((result) => {
    });
  }

  changeLanguage(lang: any): void {
    this.translate.use(lang.code);
    localStorage.setItem('lang', lang.code);
    this.selectedLanguage = lang;
  }

  startPageTour(): void {
    this.tourService.replayTour();
  }

  notifications: notifications[] = [
    {
      id: 1,
      img: '/assets/images/profile/user-1.jpg',
      title: 'Roman Joined the Team!',
      subtitle: 'Congratulate him',
    },
    {
      id: 2,
      img: '/assets/images/profile/user-2.jpg',
      title: 'New message received',
      subtitle: 'Salma sent you new message',
    },
    {
      id: 3,
      img: '/assets/images/profile/user-3.jpg',
      title: 'New Payment received',
      subtitle: 'Check your earnings',
    },
    {
      id: 4,
      img: '/assets/images/profile/user-4.jpg',
      title: 'Jolly completed tasks',
      subtitle: 'Assign her new tasks',
    },
    {
      id: 5,
      img: '/assets/images/profile/user-5.jpg',
      title: 'Roman Joined the Team!',
      subtitle: 'Congratulate him',
    },
  ];

  msgs: msgs[] = [
    {
      id: 1,
      img: '/assets/images/profile/user-1.jpg',
      title: 'Andrew McDownland',
      subtitle: 'Message blocked. Try Again',
    },
    {
      id: 2,
      img: '/assets/images/profile/user-2.jpg',
      title: 'Christopher Jamil',
      subtitle: 'This message cannot be sent',
    },
    {
      id: 3,
      img: '/assets/images/profile/user-3.jpg',
      title: 'Julia Roberts',
      subtitle: 'You are trying to reach location.',
    },
    {
      id: 4,
      img: '/assets/images/profile/user-4.jpg',
      title: 'James Johnson',
      subtitle: 'Assign her new tasks',
    },
    {
      id: 5,
      img: '/assets/images/profile/user-5.jpg',
      title: 'Maria Rodriguez',
      subtitle: 'Congrats for your success',
    },
  ];

  profiledd: profiledd[] = [
    {
      id: 1,
      img: '/assets/images/svgs/icon-account.svg',
      title: 'My Profile',
      subtitle: 'Account Settings',
      link: '/',
    },
    {
      id: 2,
      img: '/assets/images/svgs/icon-inbox.svg',
      title: 'My Inbox',
      subtitle: 'Messages & Email',
      link: '/apps/email/inbox',
    },
    {
      id: 3,
      img: '/assets/images/svgs/icon-tasks.svg',
      title: 'My Tasks',
      subtitle: 'To-do and Daily Tasks',
      link: '/apps/taskboard',
    },
  ];

}

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule],
  template: `
    <h2 mat-dialog-title>Alterar Senha</h2>
    <mat-dialog-content style="min-width: 320px; padding-top: 8px;">
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="w-100" style="margin-bottom: 8px;">
          <mat-label>Senha atual</mat-label>
          <input matInput [type]="hideCurrentPwd ? 'password' : 'text'" formControlName="currentPassword" />
          <button mat-icon-button matSuffix (click)="hideCurrentPwd = !hideCurrentPwd" type="button">
            <mat-icon>{{ hideCurrentPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100" style="margin-bottom: 8px;">
          <mat-label>Nova senha</mat-label>
          <input matInput [type]="hideNewPwd ? 'password' : 'text'" formControlName="newPassword" />
          <button mat-icon-button matSuffix (click)="hideNewPwd = !hideNewPwd" type="button">
            <mat-icon>{{ hideNewPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-error *ngIf="form.get('newPassword')?.hasError('minlength')">Mínimo 6 caracteres</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Confirmar nova senha</mat-label>
          <input matInput [type]="hideConfirmPwd ? 'password' : 'text'" formControlName="confirmPassword" />
          <button mat-icon-button matSuffix (click)="hideConfirmPwd = !hideConfirmPwd" type="button">
            <mat-icon>{{ hideConfirmPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-error *ngIf="form.hasError('passwordMismatch') && form.get('confirmPassword')?.touched">
            Senhas não coincidem
          </mat-error>
        </mat-form-field>
        <div *ngIf="errorMessage" style="color: #f44336; font-size: 13px; margin-top: 4px;">
          {{ errorMessage }}
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end" style="padding: 16px;">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || isLoading" (click)="changePassword()">
        <mat-spinner *ngIf="isLoading" diameter="16" style="display:inline-block; margin-right:6px; vertical-align:middle;"></mat-spinner>
        Salvar
      </button>
    </mat-dialog-actions>
  `,
})
export class AppChangePasswordDialogComponent {
  form: FormGroup;
  isLoading = false;
  errorMessage = '';
  hideCurrentPwd = true;
  hideNewPwd = true;
  hideConfirmPwd = true;

  constructor(
    private fb: FormBuilder,
    private auth: Auth,
    private dialogRef: MatDialogRef<AppChangePasswordDialogComponent>,
  ) {
    this.form = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  passwordMatchValidator(group: FormGroup) {
    const newPass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return newPass === confirm ? null : { passwordMismatch: true };
  }

  async changePassword(): Promise<void> {
    if (this.form.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const user = this.auth.currentUser;
      if (!user || !user.email) throw new Error('Usuário não autenticado');
      const credential = EmailAuthProvider.credential(user.email, this.form.value.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, this.form.value.newPassword);
      this.dialogRef.close(true);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        this.errorMessage = 'Senha atual incorreta.';
      } else {
        this.errorMessage = 'Erro ao alterar senha. Tente novamente.';
      }
    } finally {
      this.isLoading = false;
    }
  }
}

@Component({
  selector: 'app-search-dialog',
  standalone: true,
  imports: [RouterModule, MaterialModule, TablerIconsModule, FormsModule, NgForOf],
  templateUrl: 'search-dialog.component.html',
})
export class AppHorizontalSearchDialogComponent implements OnInit {
  searchText: string = '';
  navItemsData: any[] = [];

  constructor(private authService: AuthService) {}

  async ngOnInit(): Promise<void> {
    const role = await this.authService.getCurrentUserRole();
    this.navItemsData = navItems.filter((item) => {
      if (!item.displayName) return false;
      if (!item.role) return true;
      const roles = Array.isArray(item.role) ? item.role : [item.role];
      return role && roles.includes(role);
    });
  }
}
