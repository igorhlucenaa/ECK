import {
  Component,
  Output,
  EventEmitter,
  Input,
  ViewEncapsulation,
  OnInit,
} from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { MatDialog } from '@angular/material/dialog';
import { navItems } from '../sidebar/sidebar-data';
import { TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { BrandingComponent } from '../sidebar/branding.component';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

interface notifications {
  id: number;
  icon: string;
  color: string;
  title: string;
  time: string;
  subtitle: string;
}

interface inbox {
  id: number;
  bgcolor: string;
  imagePath: string;
  title: string;
  time: string;
  subtitle: string;
}

interface profiledd {
  id: number;
  title: string;
  link: string;
  new?: boolean;
}

interface apps {
  id: number;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  link: string;
}

interface quicklinks {
  id: number;
  title: string;
  link: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    MaterialModule,
    BrandingComponent,
  ],
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
export class HeaderComponent implements OnInit {
  [x: string]: any;
  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleMobileFilterNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  showFiller = false;

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
  userName: string | null = null;
  userEmail: string | null = null;

  constructor(
    private settings: CoreService,
    private vsidenav: CoreService,
    public dialog: MatDialog,
    private translate: TranslateService,
    private authService: AuthService
  ) {
    translate.setDefaultLang('pt-BR');
  }

  ngOnInit(): void {
    // Sincronizar seleção com idioma atual
    const storedLang = localStorage.getItem('lang');
    const current = storedLang || this.translate.currentLang || 'pt-BR';
    const found = this.languages.find((l) => l.code === current);
    if (found) {
      this.selectedLanguage = found;
      this.translate.use(found.code);
    }
    this.authService.getCurrentUserName().then((name) => {
      this.userName = name;
    });

    this.authService.getCurrentUserEmail().then((email) => {
      this.userEmail = email;
    });
  }
  options = this.settings.getOptions();

  setDark() {
    this.settings.toggleTheme();
  }

  openDialog() {
    const dialogRef = this.dialog.open(AppSearchDialogComponent);

    dialogRef.afterClosed().subscribe((result) => {
          });
  }

  changeLanguage(lang: any): void {
    this.translate.use(lang.code);
    localStorage.setItem('lang', lang.code);
    this.selectedLanguage = lang;
  }

  notifications: notifications[] = [
    {
      id: 1,
      icon: 'solar:widget-3-line-duotone',
      color: 'primary',
      time: '8:30 AM',
      title: 'Launch Admin',
      subtitle: 'Just see the my new admin!',
    },
    {
      id: 2,
      icon: 'solar:calendar-mark-line-duotone',
      color: 'accent',
      time: '8:21 AM',
      title: 'Event today',
      subtitle: 'Just a reminder that you have event',
    },
    {
      id: 3,
      icon: 'solar:settings-minimalistic-line-duotone',
      color: 'warning',
      time: '8:05 AM',
      title: 'Settings',
      subtitle: 'You can customize this template',
    },
    {
      id: 4,
      icon: 'solar:link-circle-line-duotone',
      color: 'success',
      time: '7:30 AM',
      title: 'Launch Templates',
      subtitle: 'Just see the my new admin!',
    },
    {
      id: 5,
      icon: 'solar:checklist-minimalistic-line-duotone',
      color: 'error',
      time: '7:03 AM',
      title: 'Event tomorrow',
      subtitle: 'Just a reminder that you have event',
    },
  ];

  inbox: inbox[] = [
    {
      id: 1,
      bgcolor: 'bg-success',
      imagePath: 'assets/images/profile/user-6.jpg',
      time: 'just now',
      title: 'Michell Flintoff',
      subtitle: 'You: Yesterdy was great...',
    },
    {
      id: 2,
      bgcolor: 'bg-success',
      imagePath: 'assets/images/profile/user-2.jpg',
      time: '5 mins ago',
      title: 'Bianca Anderson',
      subtitle: 'Nice looking dress you...',
    },
    {
      id: 3,
      bgcolor: 'bg-success',
      imagePath: 'assets/images/profile/user-3.jpg',
      time: '10 mins ago',
      title: 'Andrew Johnson',
      subtitle: 'Sent a photo',
    },
    {
      id: 4,
      bgcolor: 'bg-success',
      imagePath: 'assets/images/profile/user-4.jpg',
      time: 'days ago',
      title: 'Marry Strokes',
      subtitle: 'If I don’t like something',
    },
    {
      id: 5,
      bgcolor: 'bg-success',
      imagePath: 'assets/images/profile/user-5.jpg',
      time: 'year ago',
      title: 'Josh Anderson',
      subtitle: '$230 deducted from account',
    },
  ];

  profiledd: profiledd[] = [
    // {
    //   id: 1,
    //   title: 'My Profile',
    //   link: '/',
    // },
    // {
    //   id: 2,
    //   title: 'My Projects',
    //   link: '/',
    // },
    // {
    //   id: 3,
    //   title: 'Inbox',
    //   new: true,
    //   link: '/',
    // },
    // {
    //   id: 4,
    //   title: ' Mode',
    //   link: '/',
    // },
    // {
    //   id: 5,
    //   title: ' Account Settings',
    //   link: '/',
    // },
    {
      id: 6,
      title: 'Sign Out',
      link: '/authentication/login',
    },
  ];

  apps: apps[] = [
    {
      id: 1,
      icon: 'solar:chat-line-line-duotone',
      color: 'primary',
      title: 'Chat Application',
      subtitle: 'Messages & Emails',
      link: '/apps/chat',
    },
    {
      id: 2,
      icon: 'solar:checklist-minimalistic-line-duotone',
      color: 'accent',
      title: 'Todo App',
      subtitle: 'Completed task',
      link: '/apps/todo',
    },
    {
      id: 3,
      icon: 'solar:bill-list-line-duotone',
      color: 'success',
      title: 'Invoice App',
      subtitle: 'Get latest invoice',
      link: '/apps/invoice',
    },
    {
      id: 4,
      icon: 'solar:calendar-line-duotone',
      color: 'error',
      title: 'Calendar App',
      subtitle: 'Get Dates',
      link: '/apps/calendar',
    },
    {
      id: 5,
      icon: 'solar:smartphone-2-line-duotone',
      color: 'warning',
      title: 'Contact Application',
      subtitle: '2 Unsaved Contacts',
      link: '/apps/contacts',
    },
    {
      id: 6,
      icon: 'solar:ticket-line-duotone',
      color: 'primary',
      title: 'Tickets App',
      subtitle: 'Create new ticket',
      link: '/apps/tickets',
    },
    {
      id: 7,
      icon: 'solar:letter-line-duotone',
      color: 'accent',
      title: 'Email App',
      subtitle: 'Get new emails',
      link: '/apps/email/inbox',
    },
    {
      id: 8,
      icon: 'solar:book-2-line-duotone',
      color: 'warning',
      title: 'Courses',
      subtitle: 'Create new course',
      link: '/apps/courses',
    },
  ];
  quicklinks: quicklinks[] = [
    {
      id: 1,
      title: 'Pricing Page',
      link: '/theme-pages/pricing',
    },
    {
      id: 2,
      title: 'Authentication Design',
      link: '/authentication/login',
    },
    {
      id: 3,
      title: 'Register Now',
      link: '/authentication/side-register',
    },
    {
      id: 4,
      title: '404 Error Page',
      link: '/authentication/error',
    },
    {
      id: 5,
      title: 'Notes App',
      link: '/apps/notes',
    },
    {
      id: 6,
      title: 'Employee App',
      link: '/apps/employee',
    },
    {
      id: 7,
      title: 'Todo Application',
      link: '/apps/todo',
    },
  ];
}

@Component({
  selector: 'search-dialog',
  standalone: true,
  imports: [RouterModule, MaterialModule, TablerIconsModule, FormsModule],
  templateUrl: 'search-dialog.component.html',
})
export class AppSearchDialogComponent {
  searchText: string = '';
  navItems = navItems;

  navItemsData = navItems.filter((navitem) => navitem.displayName);
}
