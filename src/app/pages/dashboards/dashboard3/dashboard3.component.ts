import { Component } from '@angular/core';
import {
  AppBandwidthUsageComponent,
  AppCurrentVisitsComponent,
  AppDownloadCountComponent,
  AppFavouriteContactsComponent,
  AppFeedsComponent,
  AppNewsletterCampaign2Component,
  AppPieCardsComponent,
  AppProfileCardComponent,
  AppProjectDataComponent,
  AppRecentCommentsComponent,
  AppSalesOverview2Component,
  AppTodoListComponent,
} from 'src/app/components';

@Component({
  selector: 'app-dashboard3',
  standalone: true,
  imports: [
    AppPieCardsComponent,
    AppSalesOverview2Component,
    AppCurrentVisitsComponent,
    AppProjectDataComponent,
    AppProfileCardComponent,
    AppBandwidthUsageComponent,
    AppDownloadCountComponent,
    AppFavouriteContactsComponent,
    AppFeedsComponent,
    AppRecentCommentsComponent,
    AppTodoListComponent,
    AppNewsletterCampaign2Component
  ],
  templateUrl: './dashboard3.component.html',
})
export class AppDashboard3Component {
  constructor() {}
}
