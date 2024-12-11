import { Component } from '@angular/core';
import { AppBandwidthUsageComponent, AppBlogCardComponent, AppCurrentVisitsComponent, AppDownloadCountComponent, AppNewsletterCampaignComponent, AppProfileCardComponent, AppProjectDataComponent, AppRecentCommentsComponent, AppRevenueCardsComponent, AppTodoListComponent, AppVisitorsComponent } from 'src/app/components';

@Component({
  selector: 'app-dashboard2',
  standalone: true,
  imports:[AppRevenueCardsComponent, AppBandwidthUsageComponent, AppDownloadCountComponent, AppVisitorsComponent, AppCurrentVisitsComponent, AppBlogCardComponent, AppNewsletterCampaignComponent, AppProjectDataComponent, AppProjectDataComponent, AppProfileCardComponent, AppRecentCommentsComponent, AppTodoListComponent],
  templateUrl: './dashboard2.component.html',
})
export class AppDashboard2Component {
  constructor() {}
}
