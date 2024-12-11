import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [RouterModule, MatButtonModule],
  templateUrl: './error.component.html',
})
export class AppErrorComponent {}
