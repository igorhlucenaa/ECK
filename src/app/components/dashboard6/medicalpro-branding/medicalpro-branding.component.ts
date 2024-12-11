import { Component } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-medicalpro-branding',
  standalone: true,
  imports:[MaterialModule],
  templateUrl: './medicalpro-branding.component.html',
})
export class AppMedicalproBrandingComponent {
  constructor() {}
}
