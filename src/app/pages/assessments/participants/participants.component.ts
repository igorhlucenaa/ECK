import {
  Component,
  OnInit,
  ViewChild,
  Inject,
  Optional,
  AfterViewInit,
} from '@angular/core';
import {
  Firestore,
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  where,
  addDoc,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import {
  MatDialog,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { FormBuilder, Validators } from '@angular/forms';
import { ParticipantsConfirmationDialogComponent } from './participants-confirmation-dialog/participants-confirmation-dialog.component';
import { AddParticipantModalComponent } from '../../project/add-participant-modal/add-participant-modal.component';

interface ModalData {
  projectId?: string;
  clientId?: string;
  templateId?: string;
  emailType?: string;
}

interface UnifiedParticipant {
  id: string;
  name: string;
  email: string;
  assessmentId?: string;
  sentAt?: Date;
  completedAt?: Date;
  status?: string;
  category: string;
  type: 'avaliado' | 'avaliador';
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  selected?: boolean;
}

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
}

interface MailTemplate {
  id: string;
  name: string;
  content: string;
  emailType: string;
  subject: string;
  clientId: string;
}

interface Assessment {
  id: string;
  name: string;
}

@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './participants.component.html',
  styleUrls: ['./participants.component.scss'],
})
export class ParticipantsComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'select',
    'name',
    'email',
    'type',
    'category',
    'projectName',
    'status',
    'sentAt',
    'completedAt',
  ];

  dataSource = new MatTableDataSource<UnifiedParticipant>([]);
  searchValue: string = '';
  filterType: string = '';
  filterCategory: string = '';
  filterStatus: string = '';
  filterClient: string = '';
  filterProject: string = '';
  clients: Client[] = [];
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  mailTemplates: MailTemplate[] = [];
  assessments: Assessment[] = [];
  selectedParticipants: UnifiedParticipant[] = [];
  isLoading: boolean = false;
  isTableLoading: boolean = false;
  templateFormControl = this.fb.control('', Validators.required);
  assessmentFormControl = this.fb.control('', Validators.required);
  selectedTemplate: MailTemplate | any = null;
  isClientDisabled: boolean = false;
  isProjectDisabled: boolean = false;
  isEmailSendingMode: boolean = false;
  emailType: string | undefined;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private fb: FormBuilder,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: ModalData | null,
    @Optional() public dialogRef: MatDialogRef<ParticipantsComponent>
  ) {}

  async ngOnInit(): Promise<void> {
    this.isTableLoading = true;

    this.isEmailSendingMode =
      !!this.data && !!this.data.templateId && !!this.data.emailType;
    this.emailType = this.data?.emailType;

    await Promise.all([
      this.loadClients(),
      this.loadProjects(),
      this.loadParticipants(),
    ]);

    this.isTableLoading = false;

    this.configureDataSource();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  configureDataSource(): void {
    this.dataSource.filterPredicate = (
      data: UnifiedParticipant,
      filter: string
    ) => {
      const searchStr =
        `${data.name} ${data.email} ${data.projectName} ${data.clientName}`.toLowerCase();
      const typeMatch = !this.filterType || data.type === this.filterType;
      const categoryMatch =
        !this.filterCategory || data.category === this.filterCategory;
      const statusMatch =
        !this.filterStatus || data.status === this.filterStatus;
      const clientMatch =
        !this.filterClient || data.clientId === this.filterClient;
      const projectMatch =
        !this.filterProject || data.projectId === this.filterProject;
      const emailTypeMatch = this.applyEmailTypeFilter(data);
      return (
        searchStr.includes(this.searchValue.trim().toLowerCase()) &&
        typeMatch &&
        categoryMatch &&
        statusMatch &&
        clientMatch &&
        projectMatch &&
        emailTypeMatch
      );
    };

    this.dataSource.sortData = (data: any[], sort: MatSort) => {
      const active = sort.active;
      const direction = sort.direction;
      if (!active || direction === '') return data;

      return data.sort((a, b) => {
        const isAsc = direction === 'asc';
        switch (active) {
          case 'name':
            return this.compare(a.name, b.name, isAsc);
          case 'email':
            return this.compare(a.email, b.email, isAsc);
          case 'type':
            return this.compare(a.type, b.type, isAsc);
          case 'category':
            return this.compare(a.category, b.category, isAsc);
          case 'projectName':
            return this.compare(a.projectName, b.projectName, isAsc);
          case 'status':
            return this.compare(a.status, b.status, isAsc);
          case 'sentAt':
            return this.compareDates(a.sentAt, b.sentAt, isAsc);
          case 'completedAt':
            return this.compareDates(a.completedAt, b.completedAt, isAsc);
          default:
            return 0;
        }
      });
    };

    if (this.paginator && this.sort) {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    }

    if (this.isEmailSendingMode) {
      this.filterClient = this.data!.clientId!;
      this.isClientDisabled = true;
      this.filterProject = this.data!.projectId || '';
      this.isProjectDisabled = true;

      this.loadTemplate(this.data!.templateId!).then(() => {
        this.loadAssessments().then(() => {
          this.filteredProjects = this.projects.filter(
            (project) => project.clientId === this.filterClient
          );

          if (
            ['conviteAvaliador', 'lembreteAvaliador'].includes(
              this.data!.emailType!
            )
          ) {
            this.filterType = 'avaliador';
          } else if (
            [
              'conviteRespondente',
              'lembreteRespondente',
              'convite',
              'lembrete',
            ].includes(this.data!.emailType!)
          ) {
            this.filterType = 'avaliado';
          }

          this.applyFilter();
        });
      });
    } else if (this.data && this.data.clientId && this.data.projectId) {
      this.filterClient = this.data.clientId;
      this.filterProject = this.data.projectId;
      this.isClientDisabled = true;
      this.isProjectDisabled = true;

      Promise.all([this.loadMailTemplates(), this.loadAssessments()]).then(
        () => {
          this.filteredProjects = this.projects.filter(
            (project) => project.clientId === this.filterClient
          );
          this.applyFilter();
        }
      );
    } else {
      Promise.all([this.loadMailTemplates(), this.loadAssessments()]).then(
        () => {
          this.filteredProjects = [...this.projects];
          this.applyFilter();
        }
      );
    }
  }

  async loadTemplate(templateId: string): Promise<void> {
    const templateRef = doc(this.firestore, 'mailTemplates', templateId);
    const templateDoc = await getDoc(templateRef);
    if (templateDoc.exists()) {
      const templateData = templateDoc.data();
      this.selectedTemplate = {
        id: templateDoc.id,
        name: templateData['name'] || 'Sem Nome',
        content: templateData['content'] || '',
        emailType: this.data!.emailType!,
        subject: templateData['subject'] || '',
        clientId: this.data!.clientId!,
      };
      this.mailTemplates = [this.selectedTemplate];
      this.templateFormControl.setValue(this.selectedTemplate.id);
      this.templateFormControl.disable();
    } else {
      this.snackBar.open('Template não encontrado.', 'Fechar', {
        duration: 3000,
      });
      this.dialogRef.close();
    }
  }

  applyEmailTypeFilter(data: UnifiedParticipant): boolean {
    if (!this.selectedTemplate && !this.isEmailSendingMode) return true;

    const emailType = this.isEmailSendingMode
      ? this.emailType
      : this.selectedTemplate?.emailType;
    if (!emailType) return true;

    if (emailType === 'cadastro') return true;
    if (['conviteAvaliador', 'lembreteAvaliador'].includes(emailType)) {
      return data.type === 'avaliador';
    }
    if (
      [
        'conviteRespondente',
        'lembreteRespondente',
        'convite',
        'lembrete',
      ].includes(emailType)
    ) {
      return data.type === 'avaliado';
    }
    return true;
  }

  async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);
      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'] || 'Cliente Sem Nome',
      }));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadProjects(): Promise<void> {
    try {
      const projectsCollection = collection(this.firestore, 'projects');
      const snapshot = await getDocs(projectsCollection);
      this.projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Projeto Sem Nome',
        clientId: doc.data()['clientId'] || '',
      }));
      this.filteredProjects = [...this.projects];
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open('Erro ao carregar projetos.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadParticipants(): Promise<void> {
    this.isTableLoading = true;
    try {
      const participantsCollection = collection(this.firestore, 'participants');
      const participantsSnapshot = await getDocs(participantsCollection);

      if (participantsSnapshot.empty) {
        this.dataSource.data = [];
        return;
      }

      const projectIds = new Set<string>();
      participantsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data['projectId']) projectIds.add(data['projectId']);
      });

      const projectsMap: { [key: string]: { name: string; clientId: string } } =
        {};
      if (projectIds.size > 0) {
        const projectsPromises = Array.from(projectIds).map(
          async (projectId) => {
            const projectDoc = doc(this.firestore, 'projects', projectId);
            const projectSnapshot = await getDoc(projectDoc);
            if (projectSnapshot.exists()) {
              projectsMap[projectId] = {
                name: projectSnapshot.data()['name'] || 'Projeto Sem Nome',
                clientId: projectSnapshot.data()['clientId'] || '',
              };
            } else {
              projectsMap[projectId] = { name: 'N/A', clientId: '' };
            }
          }
        );
        await Promise.all(projectsPromises);
      }

      const clientIds = new Set<string>();
      participantsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data['clientId']) clientIds.add(data['clientId']);
      });
      Object.values(projectsMap).forEach((project) => {
        if (project.clientId) clientIds.add(project.clientId);
      });

      const clientsMap: { [key: string]: string } = {};
      if (clientIds.size > 0) {
        const clientsPromises = Array.from(clientIds).map(async (clientId) => {
          const clientDoc = doc(this.firestore, 'clients', clientId);
          const clientSnapshot = await getDoc(clientDoc);
          if (clientSnapshot.exists()) {
            clientsMap[clientId] =
              clientSnapshot.data()['companyName'] || 'Cliente Sem Nome';
          } else {
            clientsMap[clientId] = 'N/A';
          }
        });
        await Promise.all(clientsPromises);
      }

      const participants: UnifiedParticipant[] = [];
      for (const doc of participantsSnapshot.docs) {
        const participantId = doc.id;
        const participantData = doc.data();
        const projectId = participantData['projectId'] || '';
        let clientId = participantData['clientId'] || '';

        if (!clientId && projectId && projectsMap[projectId]) {
          clientId = projectsMap[projectId].clientId;
        }

        const email = participantData['email'] || 'Sem e-mail';
        const type = participantData['type'] as 'avaliado' | 'avaliador';
        const category = participantData['category'] || 'N/A';
        const assessments = participantData['assessments'] || [];

        let sentAt: Date | undefined;
        let completedAt: Date | undefined;
        let status: string = 'Não Enviado';

        const selectedAssessmentId = this.assessmentFormControl.value;
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
                if (!sentAt || linkSentAt > sentAt) sentAt = linkSentAt;
              }
              if (
                linkData['status'] === 'completed' &&
                linkData['completedAt']
              ) {
                const linkCompletedAt = (
                  linkData['completedAt'] as Timestamp
                ).toDate();
                if (!completedAt || linkCompletedAt > completedAt)
                  completedAt = linkCompletedAt;
              }
            });
          }
          status = this.determineStatus(sentAt, completedAt);
        }

        if (clientId) {
          participants.push({
            id: participantId,
            name: participantData['name'] || 'Desconhecido',
            email: email,
            assessmentId: assessments.length > 0 ? assessments[0] : undefined,
            sentAt: sentAt,
            completedAt: completedAt,
            status: status,
            category: category,
            type: type,
            projectId: projectId,
            projectName: projectsMap[projectId]?.name || 'N/A',
            clientId: clientId,
            clientName: clientsMap[clientId] || 'N/A',
            selected: false,
          });
        }
      }

      this.dataSource.data = participants;
      this.applyFilter();
    } catch (error) {
      console.error('Erro ao carregar participantes:', error);
      this.snackBar.open('Erro ao carregar participantes.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isTableLoading = false;
      if (this.paginator && this.sort) {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      }
    }
  }

  async loadMailTemplates(): Promise<void> {
    try {
      if (!this.filterClient) {
        this.mailTemplates = [];
        this.templateFormControl.setValue('');
        return;
      }

      const templatesCollection = collection(this.firestore, 'mailTemplates');
      const templatesQuery = query(
        templatesCollection,
        where('clientId', '==', this.filterClient)
      );
      const snapshot = await getDocs(templatesQuery);

      this.mailTemplates = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
        content: doc.data()['content'] || '',
        emailType: doc.data()['emailType'] || '',
        subject: doc.data()['subject'] || '',
        clientId: doc.data()['clientId'] || '',
      }));

      if (this.mailTemplates.length === 0) {
        this.snackBar.open(
          'Nenhum template encontrado para este cliente.',
          'Fechar',
          {
            duration: 3000,
          }
        );
      }
    } catch (error) {
      console.error('Erro ao carregar Modelos de e-mail:', error);
      this.snackBar.open('Erro ao carregar Modelos de e-mail.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadAssessments(): Promise<void> {
    try {
      if (!this.filterClient) {
        this.assessments = [];
        this.assessmentFormControl.setValue('');
        return;
      }

      const assessmentsCollection = collection(this.firestore, 'assessments');
      const assessmentsQuery = query(
        assessmentsCollection,
        where('clientId', '==', this.filterClient)
      );
      const snapshot = await getDocs(assessmentsQuery);

      this.assessments = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Avaliação Sem Nome',
      }));

      if (this.assessments.length === 0) {
        this.snackBar.open(
          'Nenhuma avaliação encontrada para este cliente.',
          'Fechar',
          {
            duration: 3000,
          }
        );
      }
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  determineStatus(sentAt?: Date, completedAt?: Date): string {
    if (completedAt) return 'Respondido';
    if (sentAt) return 'Enviado (Pendente)';
    return 'Não Enviado';
  }

  onClientChange(): void {
    this.filterProject = '';
    this.templateFormControl.setValue('');
    this.assessmentFormControl.setValue('');
    this.mailTemplates = [];
    this.assessments = [];
    if (this.filterClient) {
      this.filteredProjects = this.projects.filter(
        (project) => project.clientId === this.filterClient
      );
      if (!this.isEmailSendingMode) this.loadMailTemplates();
      this.loadAssessments();
    } else {
      this.filteredProjects = [...this.projects];
    }
    this.applyFilter();
  }

  onProjectChange(): void {
    this.applyFilter();
  }

  onTemplateChange(): void {
    this.selectedTemplate =
      this.mailTemplates.find((t) => t.id === this.templateFormControl.value) ||
      null;
    this.applyFilter();
    this.updateSelection();
  }

  applyFilter(): void {
    this.dataSource.filter = 'trigger'; // Valor arbitrário para acionar o filtro
    this.updateSelection();
    if (this.paginator) {
      this.dataSource.paginator = this.paginator; // Reaplicar paginator após filtro
      this.dataSource.paginator.firstPage(); // Resetar para a primeira página
    }
    if (this.sort) {
      this.dataSource.sort = this.sort; // Reaplicar sort após filtro
    }
  }

  toggleAll(checked: boolean): void {
    this.dataSource.filteredData.forEach((participant) => {
      if (!participant.completedAt && this.applyEmailTypeFilter(participant)) {
        participant.selected = checked;
      }
    });
    this.updateSelection();
  }

  updateSelection(): void {
    this.selectedParticipants = this.dataSource.filteredData.filter(
      (p) => p.selected && this.applyEmailTypeFilter(p) && !p.completedAt
    );
  }

  allSelected(): boolean {
    const eligibleParticipants = this.dataSource.filteredData.filter(
      (p) => this.applyEmailTypeFilter(p) && !p.completedAt
    );
    return (
      eligibleParticipants.length > 0 &&
      eligibleParticipants.every((p) => p.selected)
    );
  }

  someSelected(): boolean {
    const eligibleParticipants = this.dataSource.filteredData.filter(
      (p) => this.applyEmailTypeFilter(p) && !p.completedAt
    );
    return eligibleParticipants.some((p) => p.selected) && !this.allSelected();
  }

  async resendLinks(): Promise<void> {
    this.isLoading = true;
    this.isTableLoading = true;
    try {
      let selectedTemplateId: any;
      if (this.isEmailSendingMode) {
        selectedTemplateId = this.data!.templateId!;
      } else {
        selectedTemplateId = this.templateFormControl.value;
        if (!selectedTemplateId) {
          this.snackBar.open(
            'Por favor, selecione um template antes de enviar.',
            'Fechar',
            {
              duration: 3000,
            }
          );
          return;
        }
      }

      const selectedAssessmentId = this.assessmentFormControl.value;
      if (
        (this.isEmailSendingMode &&
          this.emailType &&
          [
            'conviteAvaliador',
            'conviteRespondente',
            'lembreteAvaliador',
            'lembreteRespondente',
            'convite',
            'lembrete',
          ].includes(this.emailType) &&
          !selectedAssessmentId) ||
        (!this.isEmailSendingMode && !selectedAssessmentId)
      ) {
        this.snackBar.open(
          'Por favor, selecione uma avaliação antes de enviar.',
          'Fechar',
          {
            duration: 3000,
          }
        );
        return;
      }

      const templateRef = doc(
        this.firestore,
        'mailTemplates',
        selectedTemplateId
      );
      const templateDoc = await getDoc(templateRef);
      if (!templateDoc.exists()) {
        throw new Error('Template não encontrado.');
      }

      let templateContent = templateDoc.data()['content'] || '';
      const originalContent = templateContent;

      let contentObj;
      try {
        contentObj = JSON.parse(templateContent);
      } catch (error) {
        throw new Error('Erro ao parsear o conteúdo do template: ' + error);
      }

      let projectIdForDeadline = this.filterProject;
      if (!projectIdForDeadline && this.selectedParticipants.length > 0) {
        projectIdForDeadline = this.selectedParticipants[0].projectId;
      }

      if (!projectIdForDeadline) {
        this.snackBar.open(
          'Por favor, selecione um projeto antes de enviar.',
          'Fechar',
          {
            duration: 3000,
          }
        );
        return;
      }

      let projectDeadline: Date | undefined;
      if (projectIdForDeadline) {
        const projectRef = doc(
          this.firestore,
          'projects',
          projectIdForDeadline
        );
        const projectDoc = await getDoc(projectRef);
        if (projectDoc.exists()) {
          if (projectDoc.data()['deadline'] instanceof Timestamp) {
            projectDeadline = projectDoc.data()['deadline'].toDate();
          } else if (projectDoc.data()['deadline'] instanceof Date) {
            projectDeadline = projectDoc.data()['deadline'];
          }
        }
      }
      const formattedDeadline = this.formatDate(projectDeadline);

      contentObj = this.replaceDeadlineInContent(contentObj, formattedDeadline);
      const updatedContent = JSON.stringify(contentObj);

      await updateDoc(templateRef, { content: updatedContent });

      const updatePromises = this.selectedParticipants.map(
        async (participant) => {
          const emailRequest = {
            email: participant.email,
            templateId: selectedTemplateId,
            participantId: participant.id,
            assessmentId: selectedAssessmentId,
          };

          const response = await fetch(
            'https://us-central1-pwa-workana.cloudfunctions.net/sendEmail',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(emailRequest),
            }
          );

          if (!response.ok) {
            throw new Error(
              `Erro ao enviar e-mail para ${
                participant.email
              }: ${await response.text()}`
            );
          }

          const assessmentLinkQuery = query(
            collection(this.firestore, 'assessmentLinks'),
            where('participantId', '==', participant.id),
            where('assessmentId', '==', selectedAssessmentId)
          );
          const existingLinksSnapshot = await getDocs(assessmentLinkQuery);

          if (existingLinksSnapshot.empty) {
            const assessmentLinkDoc = doc(
              collection(this.firestore, 'assessmentLinks')
            );
            await setDoc(assessmentLinkDoc, {
              assessmentId: selectedAssessmentId,
              participantId: participant.id,
              sentAt: new Date(),
              status: 'pending',
              emailTemplate: selectedTemplateId,
              participantEmail: participant.email,
            });
          } else {
            const existingLinkDoc = existingLinksSnapshot.docs[0];
            await updateDoc(
              doc(this.firestore, 'assessmentLinks', existingLinkDoc.id),
              {
                sentAt: new Date(),
                emailTemplate: selectedTemplateId,
                status:
                  existingLinkDoc.data()['status'] === 'completed'
                    ? 'completed'
                    : 'pending',
              }
            );
          }

          const participantRef = doc(
            this.firestore,
            'participants',
            participant.id
          );
          const participantDoc = await getDoc(participantRef);
          if (participantDoc.exists()) {
            const currentAssessments =
              participantDoc.data()['assessments'] || [];
            if (!currentAssessments.includes(selectedAssessmentId)) {
              currentAssessments.push(selectedAssessmentId);
              await updateDoc(participantRef, {
                assessments: currentAssessments,
              });
            }
          }
        }
      );

      await Promise.all(updatePromises);
      await updateDoc(templateRef, { content: originalContent });

      this.snackBar.open(
        `E-mails enviados para ${this.selectedParticipants.length} participantes!`,
        'Fechar',
        { duration: 3000 }
      );

      if (this.isEmailSendingMode) {
        this.dialogRef.close(true);
      } else {
        await this.loadParticipants();
      }
    } catch (error) {
      console.error('Erro ao enviar e-mails:', error);
      this.snackBar.open('Erro ao enviar e-mails.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
      this.isTableLoading = false;
    }
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
                  content.values.text = content.values.text.replace(
                    /\*\$\%DATA DE EXPIRAÇÃO DO PROJETO\$\%/g,
                    formattedDeadline
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

  formatDate(date: Date | undefined): string {
    if (!date) return 'Não definida';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  downloadTemplate(): void {
    const link = document.createElement('a');
    link.href = 'assets/templates/Modelo_Avaliacao_360.xlsx';
    link.download = 'Modelo_Avaliacao_360.xlsx';
    link.click();
  }

  async uploadExcel(event: any): Promise<void> {
    if (!this.filterClient || !this.filterProject) {
      this.snackBar.open(
        'Por favor, selecione um cliente e um projeto antes de fazer o upload.',
        'Fechar',
        { duration: 3000 }
      );
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      });

      const startRowIndex = 19;
      const participants: any[] = [];

      for (let i = startRowIndex; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (
          !Array.isArray(row) ||
          row.length < 4 ||
          !row[1] ||
          !row[2] ||
          !row[3]
        )
          continue;

        const category = row[3]?.toString().trim() || '';
        const type = category === 'Avaliado' ? 'avaliado' : 'avaliador';
        participants.push({
          name: row[1]?.toString().trim() || '',
          email: row[2]?.toString().trim() || '',
          category,
          type,
        });
      }

      if (participants.length === 0) {
        this.snackBar.open('Nenhum participante válido encontrado.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      const dialogRef = this.dialog.open(
        ParticipantsConfirmationDialogComponent,
        {
          width: '800px',
          data: {
            participants,
            clientId: this.filterClient,
            clientName:
              this.clients.find((c) => c.id === this.filterClient)?.name ||
              'Cliente Desconhecido',
            projectId: this.filterProject,
            projectName:
              this.projects.find((p) => p.id === this.filterProject)?.name ||
              'Projeto Desconhecido',
            loadEvaluation: (projectId: string) =>
              this.loadEvaluation(projectId),
          },
        }
      );

      dialogRef.afterClosed().subscribe(async (result) => {
        if (result) {
          const savedParticipants = [];
          for (const participant of participants) {
            try {
              const docRef = await addDoc(
                collection(this.firestore, 'participants'),
                {
                  ...participant,
                  clientId: result.client,
                  projectId: result.project,
                  assessments: result.evaluation ? [result.evaluation] : [],
                  createdAt: new Date(),
                }
              );
              savedParticipants.push({
                ...participant,
                id: docRef.id,
                assessments: result.evaluation ? [result.evaluation] : [],
              });
            } catch (error) {
              console.error('Erro ao salvar participante:', error);
            }
          }
          this.snackBar.open('Upload e salvamento concluídos!', 'Fechar', {
            duration: 3000,
          });
          await this.loadParticipants();
        }
      });
    };

    reader.readAsArrayBuffer(file);
  }

  async loadEvaluation(
    projectId: string
  ): Promise<{ id: string; name: string } | null> {
    if (!projectId) return null;

    try {
      const projectDoc = doc(this.firestore, 'projects', projectId);
      const projectSnapshot = await getDoc(projectDoc);
      if (!projectSnapshot.exists()) throw new Error('Projeto não encontrado');

      const projectData = projectSnapshot.data();
      const assessmentId = projectData['assessmentId'];

      if (!assessmentId) {
        this.snackBar.open(
          'Nenhuma avaliação associada a este projeto.',
          'Fechar',
          { duration: 3000 }
        );
        return null;
      }

      const assessmentDoc = doc(this.firestore, 'assessments', assessmentId);
      const assessmentSnapshot = await getDoc(assessmentDoc);
      if (!assessmentSnapshot.exists())
        throw new Error('Avaliação não encontrada');

      const assessmentData = assessmentSnapshot.data();
      return {
        id: assessmentId,
        name: assessmentData['name'] || 'Avaliação Sem Nome',
      };
    } catch (error) {
      console.error('Erro ao carregar avaliação:', error);
      this.snackBar.open('Erro ao carregar avaliação.', 'Fechar', {
        duration: 3000,
      });
      return null;
    }
  }

  openAddParticipantModal(): void {
    const dialogRef = this.dialog.open(AddParticipantModalComponent, {
      width: '500px',
      data: {
        clientId: this.filterClient || undefined,
        projectId: this.filterProject || undefined,
        clients: this.clients,
        projects: this.projects,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.loadParticipants();
    });
  }

  getFriendlyEmailType(emailType: string): string {
    switch (emailType) {
      case 'conviteAvaliador':
        return 'Convite Avaliador';
      case 'conviteRespondente':
        return 'Convite Avaliado';
      case 'lembreteAvaliador':
        return 'Lembrete Avaliador';
      case 'lembreteRespondente':
        return 'Lembrete Avaliado';
      case 'lembrete':
        return 'Lembrete Avaliado';
      case 'convite':
        return 'Convite Avaliado';
      case 'cadastro':
        return 'Cadastro';
      default:
        return emailType || 'Tipo Desconhecido';
    }
  }

  private compare(a: string, b: string, isAsc: boolean): number {
    return (a < b ? -1 : a > b ? 1 : 0) * (isAsc ? 1 : -1);
  }

  private compareDates(
    a: Date | undefined,
    b: Date | undefined,
    isAsc: boolean
  ): number {
    const dateA = a ? a.getTime() : 0;
    const dateB = b ? b.getTime() : 0;
    return (dateA - dateB) * (isAsc ? 1 : -1);
  }
}
