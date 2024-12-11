import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-total-earnings',
  standalone: true,
  imports: [MaterialModule, TablerIconsModule],
  templateUrl: './total-earnings.component.html',
})
export class AppTotalEarningsComponent {
  constructor() {}
}
