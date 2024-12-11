import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-overview-sales',
  standalone: true,
  imports:[MaterialModule, TablerIconsModule],
  templateUrl: './overview-sales.component.html',
})
export class AppOverviewSalesComponent {
  constructor() {}
}
