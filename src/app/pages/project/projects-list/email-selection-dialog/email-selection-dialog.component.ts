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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatTableDataSource } from '@angular/material/table';
import { EmailService } from './email.service';
import { FormsModule } from '@angular/forms';
import { serverTimestamp, Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-email-selection-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, TranslateModule],
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
    private translate: TranslateService,
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
          type: (participantData['type'] || 'avaliado') as 'avaliado' | 'avaliador',
          avaliadoId: participantData['avaliadoId'] || undefined,
          projectId: projectId,
          status: status,
          deliveryStatus: deliveryStatus,
          isLinkExpired: isLinkExpired,
          linkValidityDate: linkValidityDate,
          selected: false,
        };
      })
    );

    this.originalData = participants;
    this.dataSource.data = participants.filter((p) => this.matchesTemplateAudience(p));
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
        return this.translate.instant('Não Enviado');
      case 'sent':
        return this.translate.instant('Enviado');
      case 'failed':
        return this.translate.instant('Não Entregue');
      default:
        return deliveryStatus;
    }
  }

  formatCategory(category: string): string {
    switch (category.toLowerCase()) {
      case 'gestor':
        return this.translate.instant('Gestor');
      case 'par':
        return this.translate.instant('Par');
      case 'subordinado':
        return this.translate.instant('Subordinado');
      case 'avaliado':
        return this.translate.instant('Avaliado');
      case 'outros':
        return this.translate.instant('Outros');
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

  /** Filtra participantes conforme o tipo de template (avaliado vs avaliador) */
  matchesTemplateAudience(participant: any): boolean {
    const emailType = this.data.emailType || this.emailType;
    if (!emailType || emailType === 'cadastro') return true;
    if (['conviteAvaliador', 'lembreteAvaliador'].includes(emailType)) {
      return participant.type === 'avaliador';
    }
    if (['conviteRespondente', 'lembreteRespondente', 'convite', 'lembrete'].includes(emailType)) {
      return participant.type === 'avaliado';
    }
    return true;
  }

  toggleSelection(participant: any) {
    if (!this.matchesTemplateAudience(participant)) return;
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
        this.dataSource.data
          .filter((p) => this.matchesTemplateAudience(p))
          .map((p) => this.getParticipantKey(p))
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
      this.snackBar.open(this.translate.instant('Selecione ao menos um destinatário.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
      return;
    }

    if (!this.selectedProjectId) {
      this.snackBar.open(this.translate.instant('Selecione um projeto.'), this.translate.instant('Fechar'), { duration: 3000 });
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
      this.snackBar.open(this.translate.instant('Por favor, selecione uma avaliação.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
      return;
    }

    this.isLoading.set(true);

    try {
      const templateDoc = await getDoc(doc(this.firestore, 'mailTemplates', this.data.templateId));
      if (!templateDoc.exists()) {
        throw new Error('Template nao encontrado.');
      }

      // Enviar e-mails para cada participante selecionado
      for (const key of this.selectedParticipants) {
        const participant = this.dataSource.data.find(
          (p) => this.getParticipantKey(p) === key
        );
        if (participant && !this.matchesTemplateAudience(participant)) {
          continue;
        }
        if (participant) {
          const avaliadoId = participant['avaliadoId'];

          await this.emailService
            .sendEmail(
              participant.email,
              this.data.templateId,
              participant.id,
              this.selectedAssessmentId,
              avaliadoId || undefined
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

          const msg = this.translate.instant('E-mail enviado para {{name}}', { name: participant.name });
          this.snackBar.open(msg, this.translate.instant('Fechar'), { duration: 3000 });
        }
      }

      this.dialogRef.close();
    } catch (error) {
      console.error('Erro ao enviar e-mails ou atualizar documentos:', error);
      this.snackBar.open(this.translate.instant('Erro ao enviar e-mails ou atualizar documentos.'), this.translate.instant('Fechar'), { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Substitui todas as variáveis dinâmicas (nova sintaxe {{...}} + legado $%...$%) */
  private replaceAllVariables(contentObj: any, vars: Record<string, string>): any {
    const replaceInText = (text: string): string => {
      // Nova sintaxe {{...}}
      text = text.replace(/\{\{nome_participante\}\}/g, vars['nome_participante'] || '');
      text = text.replace(/\{\{nome_avaliado\}\}/g, vars['nome_avaliado'] || '');
      text = text.replace(/\{\{categoria\}\}/g, vars['categoria'] || '');
      text = text.replace(/\{\{data_expiracao\}\}/g, vars['data_expiracao'] || '');
      text = text.replace(/\{\{nome_projeto\}\}/g, vars['nome_projeto'] || '');
      text = text.replace(/\{\{nome_cliente\}\}/g, vars['nome_cliente'] || '');
      // Sintaxe legada (compatibilidade com templates antigos)
      text = text.replace(/\$%Nome do usuário preenchido dinâmicamente\$%/g, vars['nome_participante'] || '');
      text = text.replace(/\$%NOME_DO_AVALIADO\$%/g, vars['nome_avaliado'] || '');
      text = text.replace(/\*?\$%DATA DE EXPIRAÇÃO DO PROJETO\$%\*?/g, vars['data_expiracao'] || '');
      return text;
    };

    if (contentObj.body?.rows) {
      contentObj.body.rows.forEach((row: any) => {
        row.columns?.forEach((column: any) => {
          column.contents?.forEach((content: any) => {
            if (content.values?.text) {
              content.values.text = replaceInText(content.values.text);
            }
          });
        });
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
    if (!date) return this.translate.instant('Não definida');
    const lang = this.translate.currentLang || 'pt-BR';
    const locale = lang.startsWith('en') ? 'en-US' : (lang.startsWith('es') ? 'es-ES' : 'pt-BR');
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
