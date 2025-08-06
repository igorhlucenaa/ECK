import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ScaleService } from 'src/app/services/scale.service';
import { Scale, ScaleOption } from 'src/app/models/scale.model';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-scale-manager',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './scale-manager.component.html',
  styleUrls: ['./scale-manager.component.scss']
})
export class ScaleManagerComponent implements OnInit {
  scaleForm: FormGroup;
  scales: Scale[] = [];
  isEditing = false;
  currentScaleId: string | null = null;
  displayedColumns: string[] = ['name', 'actions'];

  constructor(
    private fb: FormBuilder,
    private scaleService: ScaleService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ScaleManagerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { clientId: string }
  ) {
    this.scaleForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      options: this.fb.array([], Validators.required)
    });
  }

  ngOnInit(): void {
    this.loadScales();
  }

  get options(): FormArray {
    return this.scaleForm.get('options') as FormArray;
  }

  createOptionGroup(option: ScaleOption = { value: null, text: '' }): FormGroup {
    return this.fb.group({
      value: [option.value, Validators.required],
      text: [option.text, Validators.required]
    });
  }

  addOption(): void {
    this.options.push(this.createOptionGroup());
  }

  removeOption(index: number): void {
    this.options.removeAt(index);
  }

  async loadScales(): Promise<void> {
    if (this.data.clientId) {
      this.scales = await this.scaleService.getScalesByClient(this.data.clientId);
    }
  }

  editScale(scale: Scale): void {
    this.isEditing = true;
    this.currentScaleId = scale.id || null;
    this.scaleForm.patchValue({
      name: scale.name,
      description: scale.description
    });
    this.options.clear();
    scale.options.forEach(opt => this.options.push(this.createOptionGroup(opt)));
  }

  async saveScale(): Promise<void> {
    if (this.scaleForm.invalid) {
      return;
    }

    const scaleData: Scale = {
      ...this.scaleForm.value,
      clientId: this.data.clientId,
      isDefault: false // Apenas escalas criadas pela ECK podem ser default
    };

    try {
      if (this.isEditing && this.currentScaleId) {
        await this.scaleService.updateScale(this.currentScaleId, scaleData);
        this.snackBar.open('Escala atualizada com sucesso!', 'Fechar', { duration: 3000 });
      } else {
        await this.scaleService.addScale(scaleData);
        this.snackBar.open('Escala salva com sucesso!', 'Fechar', { duration: 3000 });
      }
      this.resetForm();
      this.loadScales();
    } catch (error) {
      console.error('Erro ao salvar escala:', error);
      this.snackBar.open('Erro ao salvar escala.', 'Fechar', { duration: 3000 });
    }
  }

  async deleteScale(id: string | undefined): Promise<void> {
    if (!id) return;
    try {
      await this.scaleService.deleteScale(id);
      this.snackBar.open('Escala excluída com sucesso!', 'Fechar', { duration: 3000 });
      this.loadScales();
    } catch (error) {
      console.error('Erro ao excluir escala:', error);
      this.snackBar.open('Erro ao excluir escala.', 'Fechar', { duration: 3000 });
    }
  }

  resetForm(): void {
    this.isEditing = false;
    this.currentScaleId = null;
    this.scaleForm.reset();
    this.options.clear();
  }
}
