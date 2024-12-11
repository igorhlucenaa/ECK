import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-welcome-card',
  standalone: true,
  imports:[TablerIconsModule, MaterialModule],
  templateUrl: './welcome-card.component.html',
})
export class AppWelcomeCardComponent {
  constructor() {}
}
