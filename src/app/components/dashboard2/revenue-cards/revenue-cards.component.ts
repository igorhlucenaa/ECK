import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

interface topcards {
  id: number;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-revenue-cards',
  standalone: true,
  imports: [MaterialModule, TablerIconsModule],
  templateUrl: './revenue-cards.component.html',
})
export class AppRevenueCardsComponent {
  topcards: topcards[] = [
    {
      id: 1,
      color: 'primary',
      icon: 'activity',
      title: '3,249',
      subtitle: 'Total Revenue',
    },
    {
      id: 2,
      color: 'warning',
      icon: 'device-desktop',
      title: '2,376',
      subtitle: 'Online Revenue',
    },
    {
      id: 3,
      color: 'accent',
      icon: 'shopping-cart',
      title: '1,795',
      subtitle: 'Offline Revenue',
    },
    {
      id: 4,
      color: 'error',
      icon: 'anchor',
      title: '687',
      subtitle: 'Ad. Expense',
    },
  ];

  constructor() {}
}
