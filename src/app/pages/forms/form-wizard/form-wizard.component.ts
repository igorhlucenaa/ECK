import { Component } from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-form-wizard',
  standalone: true,
  imports: [MaterialModule, FormsModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './form-wizard.component.html',
})
export class AppFormWizardComponent {
  firstFormGroup = this._formBuilder.group({
    firstCtrl: ['', Validators.required],
  });
  secondFormGroup = this._formBuilder.group({
    secondCtrl: ['', Validators.required],
  });

  constructor(private _formBuilder: FormBuilder) {}
}
