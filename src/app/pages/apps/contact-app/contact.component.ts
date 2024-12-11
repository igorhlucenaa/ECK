import { Component } from '@angular/core';
import { ListeningComponent } from 'src/app/pages/apps/contact-app/listening/listening.component';
import { MaterialModule } from 'src/app/material.module';
import { DetailComponent } from 'src/app/pages/apps/contact-app/detail/detail.component';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ListeningComponent,TablerIconsModule, MaterialModule, DetailComponent],
  templateUrl: './contact.component.html',
})
export class ContactComponent {}
