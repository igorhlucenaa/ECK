import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-weather-card',
  standalone: true,
  imports:[TablerIconsModule, MaterialModule],
  templateUrl: './weather-card.component.html',
})
export class AppWeatherCardComponent {
  constructor() {}
}
