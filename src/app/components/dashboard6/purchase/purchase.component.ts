import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-purchase',
  standalone: true,
  imports: [MaterialModule, TablerIconsModule],
  templateUrl: './purchase.component.html',
})
export class AppPurchaseComponent {
  constructor() {}
}
