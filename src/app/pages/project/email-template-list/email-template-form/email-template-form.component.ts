import { Component, OnInit, ViewChild } from '@angular/core';
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
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { EmailEditorModule, EmailEditorComponent } from 'angular-email-editor';

@Component({
  selector: 'app-email-template-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    MatSnackBarModule,
    RouterModule,
    EmailEditorModule, // Importa o módulo do Angular Email Editor
  ],
  templateUrl: './email-template-form.component.html',
  styleUrls: ['./email-template-form.component.scss'],
})
export class EmailTemplateFormComponent implements OnInit {
  @ViewChild(EmailEditorComponent) emailEditor: EmailEditorComponent;
  form: FormGroup;
  projectId: string | null = null;
  templateId: string | null = null;
  isEditMode = false;
  isDefaultTemplate = false;

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

  editorReady: boolean = false;

  ngOnInit(): void {
    // Verificar se a URL contém "default-template"
    const currentUrl = this.route.snapshot.url
      .map((segment) => segment.path)
      .join('/');
    console.log('URL atual:', currentUrl);

    if (currentUrl.includes('default-template')) {
      this.isDefaultTemplate = true;
    }

    this.templateId = this.route.snapshot.paramMap.get('templateId');
    this.isEditMode = !!this.templateId;

    // Carregar template no modo de edição quando o editor estiver pronto
    if (this.isEditMode) {
      this.loadTemplate().then((content) => {
        try {
          const design = content
            ? JSON.parse(content)
            : this.getDefaultTemplate();
          console.log('Design carregado:', design);

          // Aguarde o editor estar pronto para carregar o design
          const interval = setInterval(() => {
            if (this.editorReady) {
              this.emailEditor.editor.loadDesign(design);
              clearInterval(interval);
            }
          }, 100);
        } catch (error) {
          console.error('Erro ao carregar template salvo:', error);
          this.emailEditor.editor.loadDesign(this.getDefaultTemplate());
        }
      });
    }
  }

  onEditorReady(): void {
    console.log('Editor está pronto!');
    this.editorReady = true; // Sinaliza que o editor está pronto
  }

  // Método chamado quando o editor é carregado
  editorLoaded(): void {
    console.log('Editor carregado:', this.emailEditor);
    try {
      if (!this.isEditMode) {
        this.emailEditor.editor.loadDesign({}); // Design vazio
      }
    } catch (error) {
      console.error('Erro ao carregar o design:', error);
    }
  }

  // Retorna o design padrão do editor
  private getDefaultTemplate(): object {
    return {
      body: {
        rows: [
          {
            columns: [
              {
                contents: [
                  {
                    type: 'text',
                    values: {
                      text: '<h1>Bem-vindo!</h1>',
                    },
                  },
                  {
                    type: 'text',
                    values: {
                      text: '<p>Este é um modelo inicial.</p>',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };
  }

  private async loadTemplate(): Promise<string> {
    if (!this.templateId) return JSON.stringify(this.getDefaultTemplate());

    const docRef = this.isDefaultTemplate
      ? doc(this.firestore, `defaultMailTemplate/${this.templateId}`)
      : doc(
          this.firestore,
          `projects/${this.projectId}/templates/${this.templateId}`
        );

    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const content = snapshot.data()?.['content'] || '';
      console.log('Conteúdo do template carregado:', content);
      return content;
    }

    console.log('Template não encontrado, carregando design padrão.');
    return JSON.stringify(this.getDefaultTemplate());
  }

  async saveTemplate(): Promise<void> {
    console.log(this.form.value); // Debug: verificar o estado do formulário antes de salvar

    // Exportar o design do editor
    this.emailEditor.editor.exportHtml((data: any) => {
      console.log('Exportando design e HTML:', data); // Verificar o conteúdo retornado

      const design = JSON.stringify(data.design); // Design JSON
      console.log('Design exportado:', design);

      if (!design) {
        this.snackBar.open('Erro ao exportar o design do editor.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      // Atualizar o campo "content" no formulário
      this.form.get('content')?.setValue(design);

      // Agora verificamos se o formulário está válido
      if (this.form.invalid) {
        this.snackBar.open('Preencha todos os campos obrigatórios!', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      // Continuar com o salvamento no banco de dados
      this.saveToDatabase();
    });
  }

  private async saveToDatabase(): Promise<void> {
    try {
      if (this.isDefaultTemplate) {
        const templatesCollection = collection(
          this.firestore,
          'defaultMailTemplate'
        );

        if (this.isEditMode && this.templateId) {
          const docRef = doc(
            this.firestore,
            `defaultMailTemplate/${this.templateId}`
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

        // Redirecionar para "/mail-templates" se for um template padrão
        this.router.navigate(['/mail-templates']);
        return;
      }

      // Caso não seja um template padrão
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

      // Redirecionar para a URL correta do projeto
      this.router.navigate([`/projects/${this.projectId}/templates`]);
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      this.snackBar.open('Erro ao salvar template.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  goBack(): void {
    this.location.back();
  }
}
