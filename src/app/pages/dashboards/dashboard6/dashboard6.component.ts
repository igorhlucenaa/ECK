import { Component } from '@angular/core';
import {
  AppActivityTimelineComponent,
  AppBlogCardComponent,
  AppCustomersComponent,
  AppMedicalproBrandingComponent,
  AppMonthlyEarningsComponent,
  AppMyContactsComponent,
  AppProductPerformance2Component,
  AppProfileCardComponent,
  AppPurchaseComponent,
  AppRevenueUpdatesComponent,
  AppTotalEarningsComponent,
  AppTotalSalesComponent,
  AppWeeklyStatsComponent,
  AppWelcomeCardComponent,
} from 'src/app/components';

@Component({
  selector: 'app-dashboard6',
  standalone: true,
  imports: [
    AppWelcomeCardComponent,
    AppPurchaseComponent,
    AppTotalEarningsComponent,
    AppRevenueUpdatesComponent,
    AppMonthlyEarningsComponent,
    AppCustomersComponent,
    AppTotalSalesComponent,
    AppProductPerformance2Component,
    AppProfileCardComponent,
    AppMyContactsComponent,
    AppActivityTimelineComponent,
    AppBlogCardComponent,
    AppWeeklyStatsComponent,
    AppMedicalproBrandingComponent,
  ],
  templateUrl: './dashboard6.component.html',
})
export class AppDashboard6Component {
  constructor() {}
}
