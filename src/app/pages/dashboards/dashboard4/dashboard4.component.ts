import { Component } from '@angular/core';
import {
  AppBlogCardComponent,
  AppBrowserStatsComponent,
  AppCountryVisitsComponent,
  AppMedicalproBrandingComponent,
  AppSalesDifferenceComponent,
  AppSalesPredictionComponent,
  AppSparklineCardsComponent,
  AppTotalRevenueComponent,
  AppWeeklyStatsComponent,
} from 'src/app/components';

@Component({
  selector: 'app-dashboard4',
  standalone: true,
  imports: [
    AppSparklineCardsComponent,
    AppCountryVisitsComponent,
    AppBrowserStatsComponent,
    AppTotalRevenueComponent,
    AppSalesPredictionComponent,
    AppSalesDifferenceComponent,
    AppBlogCardComponent,
    AppWeeklyStatsComponent,
    AppMedicalproBrandingComponent,
  ],
  templateUrl: './dashboard4.component.html',
})
export class AppDashboard4Component {
  constructor() {}
}
