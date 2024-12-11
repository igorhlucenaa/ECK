import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

interface stats {
  id: number;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  percent: number;
}

@Component({
  selector: 'app-recent-transactions',
  standalone: true,
  imports: [MaterialModule, TablerIconsModule],
  templateUrl: './recent-transactions.component.html',
})
export class AppRecentTransactionsComponent {
  constructor() {}

  stats: stats[] = [
    {
      id: 1,
      color: 'primary',
      icon: 'currency-dollar',
      title: 'PayPal Transfer',
      subtitle: 'Money Added',
      percent: 68,
    },
    {
      id: 2,
      color: 'success',
      icon: 'shield',
      title: 'Wallet',
      subtitle: 'Bill Payment',
      percent: 45,
    },
    {
      id: 3,
      color: 'error',
      icon: 'credit-card',
      title: 'Credit Card',
      subtitle: 'Money reversed',
      percent: 10,
    },
    {
      id: 4,
      color: 'warning',
      icon: 'check',
      title: 'Bank Transfer',
      subtitle: 'Money added',
      percent: 100,
    },
    {
      id: 5,
      color: 'primary',
      icon: 'currency-dollar',
      title: 'Refund',
      subtitle: 'Payment Sent',
      percent: 100,
    },
  ];
}
