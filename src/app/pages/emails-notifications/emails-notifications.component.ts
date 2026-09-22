import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-emails-notifications',
  standalone: true,
  imports: [MatCardModule, TranslateModule],
  templateUrl: './emails-notifications.component.html',
  styleUrl: './emails-notifications.component.scss'
})
export class EmailsNotificationsComponent {

}
