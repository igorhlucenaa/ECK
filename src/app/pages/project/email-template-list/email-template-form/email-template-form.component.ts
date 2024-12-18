import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
} from '@angular/fire/firestore';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  AngularEditorConfig,
  AngularEditorModule,
} from '@kolkov/angular-editor';
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-email-template-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    MatSnackBarModule,
    RouterModule,
    AngularEditorModule,
  ],
  templateUrl: './email-template-form.component.html',
  styleUrls: ['./email-template-form.component.scss'],
})
export class EmailTemplateFormComponent implements OnInit {
  form: FormGroup;
  projectId: string | null = null;
  templateId: string | null = null;
  isEditMode = false;

  // AngularEditor configuration
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: '200px',
    minHeight: '0',
    placeholder: 'Digite o conteúdo do e-mail aqui...',
    translate: 'no',
    defaultFontName: 'Arial',
    defaultFontSize: '14',
    toolbarHiddenButtons: [['italic'], ['fontSize']],
  };

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private location: Location
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      subject: ['', Validators.required],
      content: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    this.templateId = this.route.snapshot.paramMap.get('templateId');

    if (this.projectId && this.templateId) {
      this.isEditMode = true;
      this.loadTemplate();
    }
  }

  private async loadTemplate(): Promise<void> {
    if (!this.projectId || !this.templateId) return;

    const docRef = doc(
      this.firestore,
      `projects/${this.projectId}/templates/${this.templateId}`
    );

    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      this.form.patchValue(snapshot.data());
    } else {
      this.snackBar.open('Template não encontrado!', 'Fechar', {
        duration: 3000,
      });
      this.router.navigate([`/projects/${this.projectId}/templates`]);
    }
  }

  async saveTemplate(): Promise<void> {
    if (this.form.invalid) {
      this.snackBar.open('Preencha todos os campos obrigatórios!', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    const templatesCollection = collection(
      this.firestore,
      `projects/${this.projectId}/templates`
    );

    try {
      if (this.isEditMode && this.templateId) {
        const docRef = doc(
          this.firestore,
          `projects/${this.projectId}/templates/${this.templateId}`
        );
        await setDoc(docRef, this.form.value);
      } else {
        await addDoc(templatesCollection, this.form.value);
      }

      this.snackBar.open(
        this.isEditMode
          ? 'Template atualizado com sucesso!'
          : 'Template criado com sucesso!',
        'Fechar',
        { duration: 3000 }
      );
      this.router.navigate([`/projects/${this.projectId}/templates`]);
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      this.snackBar.open('Erro ao salvar template.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  goToTemplates(): void {
    if (this.projectId) {
      this.router.navigate(['/projects', this.projectId, 'templates']);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
