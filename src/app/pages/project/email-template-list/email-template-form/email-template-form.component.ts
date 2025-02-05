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
  getDocs,
} from '@angular/fire/firestore';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { EmailEditorModule, EmailEditorComponent } from 'angular-email-editor';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

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
  @ViewChild(EmailEditorComponent) emailEditor!: EmailEditorComponent;
  form: FormGroup;
  templateId: string | null = null;
  isEditMode = false;
  isDefaultTemplate = false;
  userRole: string = '';
  userClientId: string | null = null;
  editorReady: boolean = false;
  clients: any[] = []; // 🔹 Agora a lista de clientes existe!

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private location: Location,
    private authService: AuthService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      subject: ['', Validators.required],
      content: ['', Validators.required],
      emailType: ['', Validators.required],
      clientId: [''], // O clientId será preenchido dinamicamente
    });
  }

  async ngOnInit(): Promise<void> {
    const user = await this.authService.getCurrentUser();

    if (!user) {
      this.snackBar.open('Erro ao obter informações do usuário.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    this.userRole = user.role;
    this.userClientId = user.clientId;

    this.isDefaultTemplate = this.route.snapshot.url
      .map((segment) => segment.path)
      .includes('default-template');

    this.templateId = this.route.snapshot.paramMap.get('templateId');
    this.isEditMode = !!this.templateId;

    if (this.userRole === 'admin_master') {
      await this.loadClients(); // 🔹 Admin Master precisa carregar a lista de clientes
    }

    if (this.isEditMode) {
      this.loadTemplate().then((content) => {
        try {
          const design = content
            ? JSON.parse(content)
            : this.getDefaultTemplate();
          console.log('Design carregado:', design);

          // Esperar o editor estar pronto antes de carregar o template
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

    if (this.userRole === 'admin_client') {
      this.form.patchValue({ clientId: this.userClientId });
    }
  }

  private async loadClients(): Promise<void> {
    console.log('Carregando lista de clientes...');
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);
      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'],
      }));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }

  onEditorReady(): void {
    console.log('Editor está pronto!');
    this.editorReady = true;
  }
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

    const docRef = doc(this.firestore, `mailTemplates/${this.templateId}`);
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      this.form.patchValue({
        name: data?.['name'] ?? '', // Se não existir, preenche com string vazia
        subject: data?.['subject'] ?? '',
        emailType: data?.['emailType'] ?? '',
        content: data?.['content'] ?? '',
        clientId: data?.['clientId'] ?? '',
      });

      const content = data?.['content'] || '';

      if (!content) {
        console.warn(
          'O template carregado não tem conteúdo. Usando o template padrão.'
        );
        return JSON.stringify(this.getDefaultTemplate());
      }

      console.log('Conteúdo do template carregado:', content);
      return content;
    }

    console.warn('Template não encontrado, carregando design padrão.');
    return JSON.stringify(this.getDefaultTemplate());
  }

  async saveTemplate(): Promise<void> {
    this.emailEditor.editor.exportHtml((data: any) => {
      console.log('Exportando design e HTML:', data);

      const design = JSON.stringify(data.design);
      console.log('Design exportado:', design);

      if (!design) {
        this.snackBar.open('Erro ao exportar o design do editor.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      this.form.get('content')?.setValue(design);

      if (this.form.invalid) {
        this.snackBar.open('Preencha todos os campos obrigatórios!', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      this.saveToDatabase();
    });
  }

  private async saveToDatabase(): Promise<void> {
    try {
      const templatesCollection = collection(this.firestore, 'mailTemplates');

      if (this.isEditMode && this.templateId) {
        const docRef = doc(this.firestore, `mailTemplates/${this.templateId}`);
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

      this.router.navigate(['/mail-templates']);
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      this.snackBar.open('Erro ao salvar template.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  // editorLoaded(): void {
  //   console.log('Editor carregado:', this.emailEditor);
  //   this.editorReady = true; // Marcamos que o editor está pronto

  //   // Se não estamos editando, carregar template vazio
  //   if (!this.isEditMode) {
  //     this.emailEditor.editor.loadDesign(this.getDefaultTemplate());
  //   }
  // }

  goBack(): void {
    this.location.back();
  }
}
