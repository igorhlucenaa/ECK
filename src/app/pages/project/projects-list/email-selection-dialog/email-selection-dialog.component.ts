import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  arrayUnion,
  getDoc,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { MatTableDataSource } from '@angular/material/table';
import { EmailService } from './email.service';
import { FormsModule } from '@angular/forms';
import { serverTimestamp, Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-email-selection-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './email-selection-dialog.component.html',
  styleUrls: ['./email-selection-dialog.component.scss'],
})
export class EmailSelectionDialogComponent implements OnInit {
  emailType: string = '';
  selectedAssessmentId: any = null;
  selectedProjectId: string | null = null;
  assessments: any[] = [];
  projects: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  selectedParticipants = new Set<string>();
  isLoading = signal(false);
  searchValue = signal('');

  displayedColumns: string[] = [
    'select',
    'name',
    'email',
    'category',
    'status',
    'deliveryStatus',
    'isLinkExpired',
    'linkValidityDate',
  ];

  private originalData: any[] = [];

  constructor(
    private dialogRef: MatDialogRef<EmailSelectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { clientId: string; templateId: string; emailType: string },
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private emailService: EmailService
  ) {}

  ngOnInit(): void {
    this.emailType = this.data.emailType || '';
    Promise.all([
      this.loadProjects(),
      this.loadAssessments(),
      this.loadParticipants(),
    ]).then(() => {
      console.log('emailType inicial:', this.emailType);
    });
  }

  async loadProjects() {
    const projectsCollection = collection(this.firestore, 'projects');
    let q: any = projectsCollection;

    if (this.data.clientId) {
      q = query(
        projectsCollection,
        where('clientId', '==', this.data.clientId)
      );
    }

    const snapshot = await getDocs(q);
    this.projects = snapshot.docs.map((doc) => {
      const data: any = doc.data();
      let deadline: Date | undefined;

      if (data['deadline'] instanceof Timestamp) {
        deadline = data['deadline'].toDate();
      } else if (data['deadline'] instanceof Date) {
        deadline = data['deadline'];
      } else if (typeof data['deadline'] === 'string') {
        deadline = new Date(data['deadline']);
      }

      return {
        id: doc.id,
        name: data['name'] || 'Sem Nome',
        deadline: deadline,
      };
    });
    console.log('Projetos carregados:', this.projects);
  }

  async loadAssessments() {
    const assessmentsCollection = collection(this.firestore, 'assessments');
    let q: any = assessmentsCollection;

    if (this.data.clientId) {
      q = query(
        assessmentsCollection,
        where('clientId', '==', this.data.clientId)
      );
    }

    const snapshot = await getDocs(q);
    this.assessments = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      name: doc.data()['name'] || 'Sem Nome',
    }));
    console.log('Assessments carregados:', this.assessments);
  }

  async loadParticipants() {
    this.isLoading.set(true);
    this.dataSource.data = [];

    const participantsCollection = collection(this.firestore, 'participants');
    let q: any = participantsCollection;

    // Filtrar por projectId se selecionado
    if (this.selectedProjectId) {
      q = query(
        participantsCollection,
        where('projectId', '==', this.selectedProjectId)
      );
    }

    const snapshot = await getDocs(q);
    const currentDate = new Date('2025-02-20');

    const participants = snapshot.docs.map((doc) => {
      const data: any = doc.data();
      const assessmentLink = this.selectedAssessmentId
        ? data['assessmentLinks']?.find(
            (link: any) => link.assessmentId === this.selectedAssessmentId
          )
        : null;
      const isExpired = assessmentLink?.validityDate
        ? new Date(assessmentLink.validityDate.seconds * 1000) < currentDate
        : false;
      const deliveryStatus = assessmentLink?.deliveryStatus || 'pending';

      return {
        id: doc.id,
        name: data['name'],
        email: data['email'],
        category: data['category'] || 'outros',
        status:
          this.getAssessmentStatus(
            data['assessments'],
            this.selectedAssessmentId
          ) || 'pending',
        deliveryStatus: deliveryStatus,
        isLinkExpired: isExpired,
        linkValidityDate: assessmentLink?.validityDate
          ? new Date(
              assessmentLink.validityDate.seconds * 1000
            ).toLocaleDateString()
          : null,
        selected: false,
      };
    });

    this.originalData = participants;
    this.dataSource.data = participants;
    this.dataSource.filterPredicate = this.customFilterPredicate.bind(this);
    this.isLoading.set(false);
    console.log(
      'Participants carregados, selectedAssessmentId:',
      this.selectedAssessmentId,
      'selectedProjectId:',
      this.selectedProjectId
    );
  }

  onEmailTypeChange(event: any) {
    this.emailType = event.value;
    console.log('emailType alterado para:', this.emailType);
    if (
      [
        'conviteAvaliador',
        'conviteRespondente',
        'lembreteAvaliador',
        'lembreteRespondente',
      ].includes(this.emailType)
    ) {
      this.selectedAssessmentId = null;
      this.loadParticipants();
    }
  }

  async onProjectChange() {
    console.log('Projeto selecionado alterado para:', this.selectedProjectId);
    await this.loadParticipants();
  }

  async onAssessmentChange() {
    console.log(
      'Avaliação selecionada alterada para:',
      this.selectedAssessmentId
    );
    if (this.selectedAssessmentId) {
      await this.loadParticipants();
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();
    this.searchValue.set(filterValue);
    this.dataSource.filter = filterValue;
  }

  customFilterPredicate(data: any, filter: string): boolean {
    const searchStr = (filter || '').toLowerCase();
    return (
      data.name.toLowerCase().includes(searchStr) ||
      data.email.toLowerCase().includes(searchStr) ||
      data.category.toLowerCase().includes(searchStr) ||
      (data.relationshipContentType
        ? data.relationshipContentType.toLowerCase().includes(searchStr)
        : false) ||
      data.status.toLowerCase().includes(searchStr) ||
      data.deliveryStatus.toLowerCase().includes(searchStr) ||
      (data.isLinkExpired ? 'sim' : 'não').toLowerCase().includes(searchStr) ||
      (data.linkValidityDate
        ? data.linkValidityDate.toLowerCase().includes(searchStr)
        : false)
    );
  }

  filterByCategory(category: string) {
    if (!category) {
      this.dataSource.data = [...this.originalData];
      this.dataSource.filter = '';
    } else {
      this.dataSource.data = this.originalData.filter(
        (p) => p.category.toLowerCase() === category.toLowerCase()
      );
    }
  }

  filterByStatus(status: string) {
    if (!status) {
      this.dataSource.data = [...this.originalData];
      this.dataSource.filter = '';
    } else {
      this.dataSource.data = this.originalData.filter(
        (p) => p.status.toLowerCase() === status.toLowerCase()
      );
    }
  }

  filterByDeliveryStatus(status: string) {
    if (!status) {
      this.dataSource.data = [...this.originalData];
      this.dataSource.filter = '';
    } else {
      this.dataSource.data = this.originalData.filter(
        (p) => p.deliveryStatus.toLowerCase() === status.toLowerCase()
      );
    }
  }

  filterByLinkExpired(expired: string) {
    if (!expired) {
      this.dataSource.data = [...this.originalData];
      this.dataSource.filter = '';
    } else {
      const isExpired = expired.toLowerCase() === 'true';
      this.dataSource.data = this.originalData.filter(
        (p) => p.isLinkExpired === isExpired
      );
    }
  }

  toggleSelection(participant: any) {
    if (this.selectedParticipants.has(participant.email)) {
      this.selectedParticipants.delete(participant.email);
    } else {
      this.selectedParticipants.add(participant.email);
    }
  }

  selectAll(event: any) {
    if (event.checked) {
      this.selectedParticipants = new Set(
        this.dataSource.data.map((p) => p.email)
      );
    } else {
      this.selectedParticipants.clear();
    }
  }

  areAllSelected(): boolean {
    return (
      this.dataSource.data.length > 0 &&
      this.selectedParticipants.size === this.dataSource.data.length
    );
  }

  async sendEmails() {
    if (this.selectedParticipants.size === 0) {
      this.snackBar.open('Selecione ao menos um destinatário.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    if (!this.selectedProjectId) {
      this.snackBar.open('Selecione um projeto.', 'Fechar', { duration: 3000 });
      return;
    }

    if (
      [
        'conviteAvaliador',
        'conviteRespondente',
        'lembreteAvaliador',
        'lembreteRespondente',
      ].includes(this.emailType) &&
      !this.selectedAssessmentId
    ) {
      this.snackBar.open('Selecione uma avaliação.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    this.isLoading.set(true);

    try {
      // Carregar o template
      const templateRef = doc(
        this.firestore,
        'mailTemplates',
        this.data.templateId
      );
      const templateDoc = await getDoc(templateRef);
      if (!templateDoc.exists()) {
        throw new Error('Template não encontrado.');
      }

      let templateContent = templateDoc.data()['content'] || '';
      const originalContent = templateContent; // Guardar o conteúdo original com placeholders
      let contentObj = JSON.parse(templateContent);

      // Obter a data de expiração do projeto
      const projectRef = doc(
        this.firestore,
        'projects',
        this.selectedProjectId
      );
      const projectDoc = await getDoc(projectRef);
      if (!projectDoc.exists()) {
        throw new Error('Projeto não encontrado.');
      }
      let projectDeadline: Date | undefined;
      if (projectDoc.data()['deadline'] instanceof Timestamp) {
        projectDeadline = projectDoc.data()['deadline'].toDate();
      } else if (projectDoc.data()['deadline'] instanceof Date) {
        projectDeadline = projectDoc.data()['deadline'];
      }
      const formattedDeadline = this.formatDate(projectDeadline);

      // Enviar e-mails para cada participante
      for (const email of this.selectedParticipants) {
        const participant = this.dataSource.data.find((p) => p.email === email);
        if (participant) {
          // Criar uma cópia do conteúdo para cada participante
          let participantContent = JSON.parse(JSON.stringify(contentObj));

          // Substituir a data
          participantContent = this.replaceDeadlineInContent(
            participantContent,
            formattedDeadline
          );

          // Substituir o nome do usuário
          participantContent = this.replaceUserNameInContent(
            participantContent,
            participant.name
          );

          // Converter o conteúdo final para string
          const finalContent = JSON.stringify(participantContent);

          // Atualizar o template no Firestore com o conteúdo finalizado temporariamente
          await updateDoc(templateRef, { content: finalContent });

          // Enviar o e-mail
          await this.emailService
            .sendEmail(
              participant.email,
              this.data.templateId,
              participant.id,
              this.selectedAssessmentId
            )
            .toPromise();

          // Atualizar o participante no Firestore
          const participantRef = doc(
            this.firestore,
            'participants',
            participant.id
          );
          await updateDoc(participantRef, {
            assessments: arrayUnion(this.selectedAssessmentId),
            status: 'pending',
            lastEmailSentAt: serverTimestamp(),
          });

          this.snackBar.open(
            `E-mail enviado para ${participant.name}`,
            'Fechar',
            { duration: 3000 }
          );
        }
      }

      // Restaurar o conteúdo original com os placeholders
      await updateDoc(templateRef, { content: originalContent });
      this.dialogRef.close();
    } catch (error) {
      console.error('Erro ao enviar e-mails ou atualizar documentos:', error);
      this.snackBar.open(
        'Erro ao enviar e-mails ou atualizar documentos.',
        'Fechar',
        { duration: 3000 }
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  // Nova função para substituir o nome do usuário
  private replaceUserNameInContent(contentObj: any, userName: string): any {
    if (contentObj.body && contentObj.body.rows) {
      contentObj.body.rows.forEach((row: any) => {
        if (row.columns) {
          row.columns.forEach((column: any) => {
            if (column.contents) {
              column.contents.forEach((content: any) => {
                if (content.values && content.values.text) {
                  content.values.text = content.values.text.replace(
                    /\$%Nome do usuário preenchido dinâmicamente\$%/g,
                    userName
                  );
                }
              });
            }
          });
        }
      });
    }
    return contentObj;
  }

  // Função ajustada para substituir a data
  // private replaceDeadlineInContent(
  //   contentObj: any,
  //   formattedDeadline: string
  // ): any {
  //   if (contentObj.body && contentObj.body.rows) {
  //     contentObj.body.rows.forEach((row: any) => {
  //       if (row.columns) {
  //         row.columns.forEach((column: any) => {
  //           if (column.contents) {
  //             column.contents.forEach((content: any) => {
  //               if (content.values && content.values.text) {
  //                 content.values.text = content.values.text.replace(
  //                   /\*\$%DATA DE EXPIRAÇÃO DO PROJETO\$%\*/g,
  //                   formattedDeadline
  //                 );
  //               }
  //             });
  //           }
  //         });
  //       }
  //     });
  //   }
  //   return contentObj;
  // }

  // Função para substituir o placeholder no objeto JSON
  private replaceDeadlineInContent(
    contentObj: any,
    formattedDeadline: string
  ): any {
    if (contentObj.body && contentObj.body.rows) {
      contentObj.body.rows.forEach((row: any) => {
        if (row.columns) {
          row.columns.forEach((column: any) => {
            if (column.contents) {
              column.contents.forEach((content: any) => {
                if (content.values && content.values.text) {
                  // Log para depuração
                  console.log(
                    'Texto antes da substituição:',
                    content.values.text
                  );
                  content.values.text = content.values.text.replace(
                    /\*\$%DATA DE EXPIRA&Ccedil;&Atilde;O DO PROJETO\$%\*/g, // Corrigido para escapar corretamente
                    formattedDeadline
                  );
                  console.log(
                    'Texto após a substituição:',
                    content.values.text
                  );
                }
              });
            }
          });
        }
      });
    }
    return contentObj;
  }

  close() {
    this.dialogRef.close();
  }

  private getAssessmentStatus(
    assessments: any[],
    assessmentId: string | null
  ): string | null {
    if (!assessments || !assessmentId) return null;
    const assessment = assessments.find((a) => a.assessmentId === assessmentId);
    return assessment?.status || 'pending';
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Não definida';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
