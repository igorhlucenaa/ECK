import {
  Component,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { navItems } from './sidebar-data';
import { NavItem } from '../../vertical/sidebar/nav-item/nav-item';
import { Router } from '@angular/router';
import { NavService } from '../../../../services/nav.service';
import { MediaMatcher } from '@angular/cdk/layout';
import { AppHorizontalNavItemComponent } from './nav-item/nav-item.component';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { AuthService } from '../../../../services/apps/authentication/auth.service';

@Component({
  selector: 'app-horizontal-sidebar',
  standalone: true,
  imports: [AppHorizontalNavItemComponent, NgIf, NgForOf, CommonModule],
  templateUrl: './sidebar.component.html',
})
export class AppHorizontalSidebarComponent implements OnInit {
  navItems: NavItem[] = [];
  parentActive = '';

  mobileQuery: MediaQueryList;
  private _mobileQueryListener: () => void;

  constructor(
    public navService: NavService,
    public router: Router,
    media: MediaMatcher,
    changeDetectorRef: ChangeDetectorRef,
    private authService: AuthService,
  ) {
    this.mobileQuery = media.matchMedia('(min-width: 1100px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
  }

  async ngOnInit(): Promise<void> {
    const role = await this.authService.getCurrentUserRole();
    this.navItems = this.filterNavItemsByRole(navItems, role);
  }

  private filterNavItemsByRole(items: NavItem[], role: string | null): NavItem[] {
    return items
      .filter(item => {
        if (!item.role) return true;
        const roles = Array.isArray(item.role) ? item.role : [item.role];
        return role && roles.includes(role);
      })
      .map(item => ({
        ...item,
        children: item.children ? this.filterNavItemsByRole(item.children, role) : undefined,
      }));
  }
}
