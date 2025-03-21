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
  selectedParticipants = new Set<string>(); // Agora armazena identificadores únicos
  isLoading = signal(false);
  searchValue = signal('');

  displayedColumns: string[] = [
    'select',
    'name',
    'email',
    'category',
    'status',
    // 'deliveryStatus',
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

    const participants = await Promise.all(
      snapshot.docs.map(async (participantDoc) => {
        const participantId = participantDoc.id;
        const participantData: any = participantDoc.data();
        const projectId = participantData['projectId'];
        const assessments = participantData['assessments'] || [];

        let sentAt: Date | undefined;
        let completedAt: Date | undefined;
        let status: string = 'Não Enviado';
        let deliveryStatus: string = 'pending';
        let isLinkExpired: boolean = false;
        let linkValidityDate: string | null = null;

        // Buscar o deadline do projeto
        let projectDeadline: Date | undefined;
        if (projectId) {
          const projectRef = doc(this.firestore, 'projects', projectId);
          const projectDoc = await getDoc(projectRef);
          if (projectDoc.exists()) {
            const projectData = projectDoc.data();
            if (projectData['deadline'] instanceof Timestamp) {
              projectDeadline = projectData['deadline'].toDate();
            } else if (projectData['deadline'] instanceof Date) {
              projectDeadline = projectData['deadline'];
            } else if (typeof projectData['deadline'] === 'string') {
              projectDeadline = new Date(projectData['deadline']);
            }

            if (projectDeadline) {
              isLinkExpired = projectDeadline < currentDate;
              linkValidityDate = this.formatDate(projectDeadline);
            }
          }
        }

        // Se houver um assessmentId selecionado, buscar os assessmentLinks correspondentes
        const selectedAssessmentId = this.selectedAssessmentId;
        let assessmentIdsToQuery: string[] = [];

        if (selectedAssessmentId) {
          assessmentIdsToQuery = [selectedAssessmentId];
        } else if (assessments.length > 0) {
          assessmentIdsToQuery = assessments;
        }

        if (assessmentIdsToQuery.length > 0) {
          const batchSize = 10;
          for (let i = 0; i < assessmentIdsToQuery.length; i += batchSize) {
            const batch = assessmentIdsToQuery.slice(i, i + batchSize);
            const assessmentLinksQuery = query(
              collection(this.firestore, 'assessmentLinks'),
              where('participantId', '==', participantId),
              where('assessmentId', 'in', batch)
            );
            const linksSnapshot = await getDocs(assessmentLinksQuery);

            linksSnapshot.docs.forEach((linkDoc) => {
              const linkData = linkDoc.data();
              if (linkData['sentAt']) {
                const linkSentAt = (linkData['sentAt'] as Timestamp).toDate();
                if (!sentAt || linkSentAt > sentAt) {
                  sentAt = linkSentAt;
                }
              }
              if (
                linkData['status'] === 'completed' &&
                linkData['completedAt']
              ) {
                const linkCompletedAt = (
                  linkData['completedAt'] as Timestamp
                ).toDate();
                if (!completedAt || linkCompletedAt > completedAt) {
                  completedAt = linkCompletedAt;
                }
              }
              if (linkData['deliveryStatus']) {
                deliveryStatus = linkData['deliveryStatus'];
              }
            });
          }

          status = this.determineStatus(sentAt, completedAt);
        }

        return {
          id: participantId,
          name: participantData['name'] || 'Desconhecido',
          email: participantData['email'] || 'Sem e-mail',
          category: participantData['category'] || 'outros',
          projectId: projectId, // Adicionando projectId ao objeto
          status: status,
          deliveryStatus: deliveryStatus,
          isLinkExpired: isLinkExpired,
          linkValidityDate: linkValidityDate,
          selected: false,
        };
      })
    );

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

  // Função para gerar um identificador único para cada participante
  getParticipantKey(participant: any): string {
    return `${participant.email}|${participant.category}|${participant.projectId}`;
  }

  // Verificar se o participante está selecionado
  isSelected(participant: any): boolean {
    return this.selectedParticipants.has(this.getParticipantKey(participant));
  }

  determineStatus(sentAt?: Date, completedAt?: Date): string {
    if (completedAt) {
      console.log('Status: Respondido (completedAt presente)');
      return 'Respondido';
    }
    if (sentAt) {
      console.log('Status: Enviado (Pendente) (sentAt presente)');
      return 'Enviado (Pendente)';
    }
    console.log('Status: Não Enviado (nenhum sentAt ou completedAt)');
    return 'Não Enviado';
  }

  formatDeliveryStatus(deliveryStatus: string): string {
    switch (deliveryStatus) {
      case 'pending':
        return 'Não Enviado';
      case 'sent':
        return 'Enviado';
      case 'failed':
        return 'Não Entregue';
      default:
        return deliveryStatus;
    }
  }

  formatCategory(category: string): string {
    switch (category.toLowerCase()) {
      case 'gestor':
        return 'Gestor';
      case 'par':
        return 'Par';
      case 'subordinado':
        return 'Subordinado';
      case 'avaliado':
        return 'Avaliado';
      case 'outros':
        return 'Outros';
      default:
        return category;
    }
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
    const formattedDeliveryStatus = this.formatDeliveryStatus(
      data.deliveryStatus
    ).toLowerCase();
    return (
      data.name.toLowerCase().includes(searchStr) ||
      data.email.toLowerCase().includes(searchStr) ||
      data.category.toLowerCase().includes(searchStr) ||
      (data.relationshipContentType
        ? data.relationshipContentType.toLowerCase().includes(searchStr)
        : false) ||
      data.status.toLowerCase().includes(searchStr) ||
      formattedDeliveryStatus.includes(searchStr) ||
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
        (p) => p.status === status
      );
    }
  }

  filterByDeliveryStatus(deliveryStatus: string) {
    if (!deliveryStatus) {
      this.dataSource.data = [...this.originalData];
      this.dataSource.filter = '';
    } else {
      this.dataSource.data = this.originalData.filter((p) => {
        const formattedDeliveryStatus = this.formatDeliveryStatus(
          p.deliveryStatus
        );
        return formattedDeliveryStatus === deliveryStatus;
      });
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
    const key = this.getParticipantKey(participant);
    if (this.selectedParticipants.has(key)) {
      this.selectedParticipants.delete(key);
    } else {
      this.selectedParticipants.add(key);
    }
  }

  selectAll(event: any) {
    if (event.checked) {
      this.selectedParticipants = new Set(
        this.dataSource.data.map((p) => this.getParticipantKey(p))
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
      const originalContent = templateContent;
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

      // Enviar e-mails para cada participante selecionado
      for (const key of this.selectedParticipants) {
        const participant = this.dataSource.data.find(
          (p) => this.getParticipantKey(p) === key
        );
        if (participant) {
          let participantContent = JSON.parse(JSON.stringify(contentObj));

          participantContent = this.replaceDeadlineInContent(
            participantContent,
            formattedDeadline
          );

          participantContent = this.replaceUserNameInContent(
            participantContent,
            participant.name
          );

          const finalContent = JSON.stringify(participantContent);

          await updateDoc(templateRef, { content: finalContent });

          await this.emailService
            .sendEmail(
              participant.email,
              this.data.templateId,
              participant.id,
              this.selectedAssessmentId
            )
            .toPromise();

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
                  console.log(
                    'Texto antes da substituição:',
                    content.values.text
                  );
                  content.values.text = content.values.text.replace(
                    /\*\$%DATA DE EXPIRAÇÃO DO PROJETO\$%\*/g,
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
