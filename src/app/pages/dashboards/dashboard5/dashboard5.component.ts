import { Component } from '@angular/core';
import {
  AppBlogCardComponent,
  AppEarningsComponent,
  AppMedicalproBrandingComponent,
  AppProductPerformanceComponent,
  AppProductSalesComponent,
  AppRecentTransactionsComponent,
  AppSalesCardsComponent,
  AppWeeklyStatsComponent,
  AppYearlySalesComponent,
} from 'src/app/components';

@Component({
  selector: 'app-dashboard5',
  standalone: true,
  imports: [
    AppSalesCardsComponent,
    AppProductPerformanceComponent,
    AppEarningsComponent,
    AppYearlySalesComponent,
    AppRecentTransactionsComponent,
    AppProductSalesComponent,
    AppBlogCardComponent,
    AppWeeklyStatsComponent,
    AppMedicalproBrandingComponent,
  ],
  templateUrl: './dashboard5.component.html',
})
export class AppDashboard5Component {
  constructor() {}
}
