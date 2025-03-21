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
  query,
  where,
  Timestamp,
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
    EmailEditorModule,
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
  clients: { id: string; name: string }[] = [];
  projectIdFromRoute: string | null = null; // Removido uso, mantido por compatibilidade
  clientIdFromRoute: string | null = null; // Novo campo para clientId da rota
  clientNameFromRoute: string | null = null; // Nome do cliente da rota

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
      clientId: [''],
      projectId: [''],
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

    this.templateId = this.route.snapshot.paramMap.get('templateId');
    this.isEditMode = !!this.templateId;

    // Pegar clientId da rota
    this.clientIdFromRoute = this.route.snapshot.paramMap.get('id');
    if (this.clientIdFromRoute) {
      this.form.get('clientId')?.setValue(this.clientIdFromRoute);
      this.form.get('clientId')?.disable(); // Desabilitar edição do clientId
      await this.loadClientName(this.clientIdFromRoute); // Carregar nome do cliente
    } else {
      if (this.userRole === 'admin_master') {
        await this.loadClients();
      }
      if (this.userRole === 'admin_client' && this.userClientId) {
        this.form.get('clientId')?.setValue(this.userClientId);
        this.form.get('clientId')?.disable(); // Desabilitar edição para admin_client
      }
    }

    this.form.get('clientId')?.valueChanges.subscribe((clientId) => {
      if (clientId && !this.clientIdFromRoute) {
        this.loadClientName(clientId); // Atualizar nome do cliente
      }
    });

    if (this.isEditMode) {
      this.loadTemplate().then(async (content) => {
        try {
          const design = content
            ? JSON.parse(content)
            : await this.getDefaultTemplateWithLink(
                this.form.get('emailType')?.value
              );

          const interval = setInterval(() => {
            if (this.editorReady) {
              this.emailEditor.editor.loadDesign(design);
              clearInterval(interval);
            }
          }, 100);
        } catch (error) {
          console.error('Erro ao carregar template salvo:', error);
          const defaultDesign = await this.getDefaultTemplateWithLink(
            this.form.get('emailType')?.value
          );
          const interval = setInterval(() => {
            if (this.editorReady) {
              this.emailEditor.editor.loadDesign(defaultDesign);
              clearInterval(interval);
            }
          }, 100);
        }
      });
    } else {
      const emailType = this.form.get('emailType')?.value;
      if (
        emailType === 'conviteAvaliador' ||
        emailType === 'conviteRespondente' ||
        emailType === 'lembreteAvaliador' ||
        emailType === 'lembreteRespondente' ||
        emailType === 'relatorioFinalizado' // Adicionado relatório finalizado
      ) {
        this.getDefaultTemplateWithLink(emailType).then((design) => {
          if (this.editorReady) {
            this.emailEditor.editor.loadDesign(design);
          }
        });
      }
    }

    this.form.get('emailType')?.valueChanges.subscribe(async (newValue) => {
      if (
        newValue === 'conviteAvaliador' ||
        newValue === 'conviteRespondente' ||
        newValue === 'lembreteAvaliador' ||
        newValue === 'lembreteRespondente' ||
        newValue === 'relatorioFinalizado' // Adicionado relatório finalizado
      ) {
        const design = await this.getDefaultTemplateWithLink(newValue);
        if (this.editorReady) {
          this.emailEditor.editor.loadDesign(design);
        }
      }
    });
  }

  private async loadClients(): Promise<void> {
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

  private async loadClientName(clientId: string): Promise<void> {
    try {
      const clientDoc = await getDoc(doc(this.firestore, 'clients', clientId));
      if (clientDoc.exists()) {
        this.clientNameFromRoute =
          clientDoc.data()['companyName'] || 'Não identificado';
      } else {
        this.clientNameFromRoute = 'Não identificado';
      }
    } catch (error) {
      console.error('Erro ao carregar nome do cliente:', error);
      this.clientNameFromRoute = 'Não identificado';
    }
  }

  private async getDefaultTemplateWithLink(emailType: string): Promise<object> {
    let message = '';

    if (
      emailType === 'conviteAvaliador' ||
      emailType === 'conviteRespondente'
    ) {
      message = `<p>Aqui está o link da sua avaliação.\n\n\n Por favor, preencha até <strong>*$%DATA DE EXPIRAÇÃO DO PROJETO$%*:</strong></p>`;
    } else if (
      emailType === 'lembreteAvaliador' ||
      emailType === 'lembreteRespondente'
    ) {
      message = `<p>Este é um lembrete da sua avaliação.\n\n\n Não se esqueça de preenchê-la até <strong>*$%DATA DE EXPIRAÇÃO DO PROJETO$%*!</strong></p>`;
    } else if (emailType === 'relatorioFinalizado') {
      message = `<p>Seu relatório foi finalizado!\n\n\n Acesse o relatório clicando no link abaixo:</p>`;
    }

    return {
      counters: {
        u_row: 1,
        u_column: 1,
        u_content_text: 1,
      },
      body: {
        id: 'email-template',
        rows: [
          {
            id: 'row-1',
            cells: [1],
            columns: [
              {
                id: 'col-1',
                contents: [
                  {
                    id: 'text-1',
                    type: 'text',
                    values: {
                      containerPadding: '10px',
                      anchor: '',
                      fontSize: '17px',
                      textAlign: 'center',
                      lineHeight: '140%',
                      hideDesktop: false,
                      text: `Olá, <strong>$%Nome do usuário preenchido dinâmicamente$%</strong>\n\n\n
                      ${message}<p><a href="${
                        emailType === 'relatorioFinalizado'
                          ? '[LINK_RELATORIO]'
                          : '[LINK_AVALIACAO]'
                      }">Clique aqui!</a></p>`,
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

  addLinkToEmailEditor(): void {
    if (!this.emailEditor || !this.editorReady) return;

    const emailType = this.form.get('emailType')?.value;
    const linkPlaceholder =
      emailType === 'relatorioFinalizado'
        ? '<p><a href="[LINK_RELATORIO]">Clique aqui para acessar o relatório!</a></p>'
        : '<p><a href="[LINK_AVALIACAO]">Clique aqui!</a></p>';

    this.emailEditor.editor.exportHtml((data: any) => {
      if (
        !data ||
        !data.design ||
        !data.design.body ||
        !Array.isArray(data.design.body.rows)
      ) {
        console.error(
          'Erro: O design exportado não está no formato esperado',
          data
        );
        return;
      }

      let design = data.design;

      const linkIdentifier =
        emailType === 'relatorioFinalizado'
          ? '[LINK_RELATORIO]'
          : '[LINK_AVALIACAO]';
      const linkExists = JSON.stringify(design).includes(linkIdentifier);

      if (!linkExists) {
        design.body.rows.push({
          columns: [
            {
              contents: [
                {
                  type: 'text',
                  values: {
                    text:
                      emailType === 'relatorioFinalizado'
                        ? 'Acesse seu relatório aqui: ' + linkPlaceholder
                        : 'Acesse sua avaliação aqui: ' + linkPlaceholder,
                  },
                },
              ],
            },
          ],
        });

        this.emailEditor.editor.loadDesign(design);
      }
    });
  }

  onEditorReady(): void {
    this.editorReady = true;
  }

  editorLoaded(): void {
    this.editorReady = true;

    if (!this.isEditMode) {
      const emailType = this.form.value.emailType;
      if (
        emailType === 'conviteAvaliador' ||
        emailType === 'conviteRespondente' ||
        emailType === 'lembreteAvaliador' ||
        emailType === 'lembreteRespondente' ||
        emailType === 'relatorioFinalizado' // Adicionado relatório finalizado
      ) {
        this.getDefaultTemplateWithLink(emailType).then((design) => {
          if (this.editorReady) {
            this.emailEditor.editor.loadDesign(design);
          }
        });
      }
    }
  }

  removeLinkFromEmailEditor(): void {
    if (!this.emailEditor || !this.editorReady) return;

    const emailType = this.form.get('emailType')?.value;
    const linkIdentifier =
      emailType === 'relatorioFinalizado'
        ? '[LINK_RELATORIO]'
        : '[LINK_AVALIACAO]';

    this.emailEditor.editor.exportHtml((data: any) => {
      if (
        !data ||
        !data.design ||
        !data.design.body ||
        !Array.isArray(data.design.body.rows)
      ) {
        console.error(
          'Erro: O design exportado não está no formato esperado',
          data
        );
        return;
      }

      let design = data.design;

      design.body.rows = design.body.rows.filter((row: any) => {
        return !JSON.stringify(row).includes(linkIdentifier);
      });

      this.emailEditor.editor.loadDesign(design);
    });
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
        name: data?.['name'] ?? '',
        subject: data?.['subject'] ?? '',
        emailType: data?.['emailType'] ?? '',
        content: data?.['content'] ?? '',
        clientId: data?.['clientId'] ?? '',
        projectId: data?.['projectId'] ?? '',
      });

      if (data?.['clientId'] && !this.clientIdFromRoute) {
        await this.loadClientName(data['clientId']);
      }

      const content = data?.['content'] || '';

      if (!content) {
        console.warn(
          'O template carregado não tem conteúdo. Usando o template padrão.'
        );
        return JSON.stringify(this.getDefaultTemplate());
      }

      return content;
    }

    console.warn('Template não encontrado, carregando design padrão.');
    return JSON.stringify(this.getDefaultTemplate());
  }

  async saveTemplate(): Promise<void> {
    this.emailEditor.editor.exportHtml((data: any) => {
      let design = JSON.stringify(data.design);

      const emailType = this.form.value.emailType;
      const linkIdentifier =
        emailType === 'relatorioFinalizado'
          ? '[LINK_RELATORIO]'
          : '[LINK_AVALIACAO]';

      if (
        (emailType === 'conviteAvaliador' ||
          emailType === 'conviteRespondente' ||
          emailType === 'lembreteAvaliador' ||
          emailType === 'lembreteRespondente' ||
          emailType === 'relatorioFinalizado') &&
        !design.includes(linkIdentifier)
      ) {
        design = design.replace(
          '</body>',
          `<p>Acesse ${
            emailType === 'relatorioFinalizado'
              ? 'seu relatório'
              : 'sua avaliação'
          } clicando aqui: <a href="${linkIdentifier}">${linkIdentifier}</a></p></body>`
        );
      }

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

      // Usar getRawValue() para incluir campos desabilitados (como clientId)
      const formData = this.form.getRawValue();

      if (this.isEditMode && this.templateId) {
        const docRef = doc(this.firestore, `mailTemplates/${this.templateId}`);
        await setDoc(docRef, formData);
      } else {
        await addDoc(templatesCollection, formData);
      }

      this.snackBar.open(
        this.isEditMode
          ? 'Template atualizado com sucesso!'
          : 'Template criado com sucesso!',
        'Fechar',
        { duration: 3000 }
      );

      this.location.back();
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

  getFriendlyEmailType(emailType: string): string {
    switch (emailType) {
      case 'cadastro':
        return 'Cadastro do Usuário';
      case 'convite':
        return 'Convite';
      case 'conviteAvaliador':
        return 'Convite - Avaliador';
      case 'conviteRespondente':
        return 'Convite - Avaliado';
      case 'lembrete':
        return 'Lembrete';
      case 'lembreteAvaliador':
        return 'Lembrete - Avaliador';
      case 'lembreteRespondente':
        return 'Lembrete - Avaliado';
      case 'relatorioFinalizado':
        return 'Relatório Finalizado';
      default:
        return emailType;
    }
  }
}
