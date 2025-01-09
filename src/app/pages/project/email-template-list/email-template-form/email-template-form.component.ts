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
  isDefaultTemplate = false; // Indica se a rota é para templates padrão

  // AngularEditor configuration
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: '200px',
    minHeight: '0',
    placeholder: 'Digite o conteúdo do e-mail aqui...',
    translate: 'no',
    defaultFontName: 'Arial',
    defaultFontSize: '12',
    toolbarHiddenButtons: [],
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
      emailType: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    const currentPath = this.router.url;

    // Verifica se estamos lidando com um template global (default-template)
    this.isDefaultTemplate = currentPath.includes('default-template');
    console.log('isDefaultTemplate', this.isDefaultTemplate); // Verifique se está correto

    // Não precisamos de projectId para templates globais
    if (!this.isDefaultTemplate) {
      // Para templates específicos de projeto, o projectId é necessário
      this.projectId = this.route.snapshot.paramMap.get('id');
    }

    this.templateId = this.route.snapshot.paramMap.get('templateId'); // Sempre pega o templateId

    console.log('projectId:', this.projectId, 'templateId:', this.templateId); // Verifique os valores

    if (this.templateId) {
      this.isEditMode = true;
      this.loadTemplate(); // Carrega o template com base no templateId
    }
  }

  private async loadTemplate(): Promise<void> {
    if (!this.templateId) return;

    let docRef;
    console.log(this.isDefaultTemplate); // Verifica se é template global

    if (this.isDefaultTemplate) {
      // Para templates globais, busca na coleção 'defaultMailTemplate'
      docRef = doc(this.firestore, `defaultMailTemplate/${this.templateId}`);
    } else {
      // Para templates específicos de projeto, busca na coleção do projeto
      docRef = doc(
        this.firestore,
        `projects/${this.projectId}/templates/${this.templateId}`
      );
    }

    // Carrega o template
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      console.log(snapshot.data()); // Verifique os dados retornados
      this.form.patchValue(snapshot.data());
    } else {
      this.snackBar.open('Template não encontrado!', 'Fechar', {
        duration: 3000,
      });
      // Redireciona de volta para a lista de templates
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

    try {
      if (this.isDefaultTemplate) {
        console.log('Salvando template global');
        const templatesCollection = collection(
          this.firestore,
          'defaultMailTemplate'
        );

        if (this.isEditMode && this.templateId) {
          // Se está no modo de edição, atualiza o template existente
          const docRef = doc(
            this.firestore,
            `defaultMailTemplate/${this.templateId}`
          );
          await setDoc(docRef, this.form.value);
        } else {
          // Se não está no modo de edição, cria um novo template
          await addDoc(templatesCollection, this.form.value);
        }

        this.snackBar.open(
          this.isEditMode
            ? 'Template atualizado com sucesso!'
            : 'Template criado com sucesso!',
          'Fechar',
          { duration: 3000 }
        );
        this.router.navigate(['/mail-templates']); // Redireciona para a lista de templates
      } else {
        const templatesCollection = collection(
          this.firestore,
          `projects/${this.projectId}/templates`
        );

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

        if (this.isDefaultTemplate) {
          this.router.navigate(['/mail-templates']);
        } else {
          this.router.navigate([`/projects/${this.projectId}/templates`]);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      this.snackBar.open('Erro ao salvar template.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  goToTemplates(): void {
    if (this.isDefaultTemplate) {
      this.router.navigate(['/mail-templates']);
    } else if (this.projectId) {
      this.router.navigate(['/projects', this.projectId, 'templates']);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
