import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-upload-list',
  standalone: true,
  imports: [MatCardModule, TranslateModule],
  templateUrl: './upload-list.component.html',
  styleUrl: './upload-list.component.scss'
})
export class UploadListComponent {

}
