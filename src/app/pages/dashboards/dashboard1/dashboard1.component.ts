import { Component } from '@angular/core';
import {
  AppActivityTimelineComponent,
  AppBandwidthUsageComponent,
  AppBlogCardComponent,
  AppDownloadCountComponent,
  AppMyContactsComponent,
  AppNewsletterCampaignComponent,
  AppProfileCardComponent,
  AppSalesOurVisitorsComponent,
  AppSalesOverviewComponent,
  AppWeatherCardComponent,
  AppTopCardsComponent
} from 'src/app/components';

@Component({
  selector: 'app-dashboard1',
  standalone: true,
  imports: [
    AppTopCardsComponent,
    AppSalesOverviewComponent,
    AppSalesOurVisitorsComponent,
    AppBlogCardComponent,
    AppNewsletterCampaignComponent,
    AppBandwidthUsageComponent,
    AppDownloadCountComponent,
    AppWeatherCardComponent,
    AppProfileCardComponent,
    AppMyContactsComponent,
    AppActivityTimelineComponent,
  ],
  templateUrl: './dashboard1.component.html',
})
export class AppDashboard1Component {
  constructor() {}
}
