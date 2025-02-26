import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  setDoc,
} from '@angular/fire/firestore';
import * as Papa from 'papaparse';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { ParticipantsConfirmationDialogComponent } from './participants-confirmation-dialog/participants-confirmation-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { EvaluatorsModalComponent } from './evaluators-modal/evaluators-modal.component';

interface Evaluator {
  name: string;
  email: string;
  category: string;
  assessments?: string[];
  selected?: boolean;
}

interface Evaluatee {
  id: string;
  name: string;
  email: string;
  clientId: string;
  projectId: string;
  assessments?: string[];
  clientName?: string;
  projectName?: string;
  evaluators?: string[];
  selected?: boolean;
  [key: string]: any;
}

interface AssessmentDetail {
  id: string;
  name: string;
  status: string; // 'Respondido' ou 'Pendente'
  linkSent: boolean; // Se o link foi enviado por e-mail
}

interface MailTemplate {
  id: string;
  name: string;
  content: string;
  emailType: string;
  subject: string;
}

@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [MaterialModule, CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './participants.component.html',
  styleUrls: ['./participants.component.scss'],
})
export class ParticipantsComponent implements OnInit, AfterViewInit {
  evaluatorsDisplayedColumns: string[] = [
    // 'select',
    'name',
    'email',
    'category',
    'assessments',
    'actions',
  ];
  evaluateesDisplayedColumns: string[] = [
    // 'select',
    'name',
    'email',
    'client',
    'project',
    'assessments',
    'evaluators',
    'actions',
  ];

  evaluatorsDataSource = new MatTableDataSource<any>([]);
  evaluateesDataSource = new MatTableDataSource<any>([]);

  @ViewChild('evaluatorsPaginator') evaluatorsPaginator!: MatPaginator;
  @ViewChild('evaluateesPaginator') evaluateesPaginator!: MatPaginator;

  @ViewChild('evaluatorsSort', { static: false }) evaluatorsSort!: MatSort;
  @ViewChild('evaluateesSort', { static: false }) evaluateesSort!: MatSort;

  clients: { id: string; name: string }[] = [];
  projects: { id: string; name: string }[] = [];
  currentUser: any = null;
  availableAssessments: { id: string; name: string }[] = [];
  availableEvaluators: { id: string; name: string }[] = [];
  mailTemplates: MailTemplate[] = []; // Novo array para templates de e-mail
  selectedEvaluations: string[] = [];

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadClients();
    await this.loadEvaluators();
    await this.loadEvaluatees();
    await this.loadAssessments();
    await this.loadEvaluatorsList();
    await this.loadMailTemplates(); // Carrega templates de e-mail

    console.log('Avaliadores carregados:', this.evaluatorsDataSource.data);
    console.log('Avaliados carregados:', this.evaluateesDataSource.data);
  }

  async loadEvaluatorsList(): Promise<void> {
    try {
      const evaluatorsQuery = query(
        collection(this.firestore, 'participants'),
        where('type', '==', 'avaliador')
      );
      const snapshot = await getDocs(evaluatorsQuery);

      this.availableEvaluators = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Nome Desconhecido',
        email: doc.data()['email'] || 'Sem e-mail',
        category: doc.data()['category'] || 'Não informado',
        type: doc.data()['type'] || '',
      }));

      console.log('Avaliadores carregados (lista):', this.availableEvaluators);
    } catch (error) {
      console.error('Erro ao carregar avaliadores (lista):', error);
      this.snackBar.open('Erro ao carregar lista de avaliadores.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadAssessments(): Promise<void> {
    try {
      const assessmentsCollection = collection(this.firestore, 'assessments');
      const snapshot = await getDocs(assessmentsCollection);

      this.availableAssessments = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Avaliação Desconhecida',
        status: 'Pendente', // Valor padrão
        linkSent: false, // Valor padrão
      }));
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadEvaluators(): Promise<void> {
    try {
      const evaluatorsQuery = query(
        collection(this.firestore, 'participants'),
        where('type', '==', 'avaliador')
      );
      const snapshot = await getDocs(evaluatorsQuery);

      const evaluators = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'],
        email: doc.data()['email'],
        category: doc.data()['category'] || 'Não informado',
        assessments: doc.data()['assessments'] ?? [],
        selected: false,
      }));

      console.log('Avaliadores recuperados do Firestore:', evaluators);
      this.evaluatorsDataSource.data = evaluators;
      this.evaluatorsDataSource._updateChangeSubscription();
      console.log(
        'Avaliadores carregados para tabela:',
        this.evaluatorsDataSource.data
      );
    } catch (error) {
      console.error('Erro ao carregar avaliadores:', error);
      this.snackBar.open(
        'Erro ao carregar avaliadores para tabela.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    }
  }

  async loadEvaluatees(): Promise<void> {
    try {
      const evaluateesQuery = query(
        collection(this.firestore, 'participants'),
        where('type', '==', 'avaliado')
      );
      const evaluatorsQuery = query(
        collection(this.firestore, 'participants'),
        where('type', '==', 'avaliador')
      );
      const snapshot = await getDocs(evaluateesQuery);
      const evaluatorsSnapshot = await getDocs(evaluatorsQuery);

      const allEvaluators = evaluatorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'],
        email: doc.data()['email'],
        category: doc.data()['category'] || 'Não informado',
      }));

      const evaluatees = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data['name'],
          email: data['email'],
          clientId: data['clientId'] || 'Desconhecido',
          projectId: data['projectId'] || 'Desconhecido',
          assessments: data['assessments']?.map((a: any) => a.id) ?? [], // Ajuste para mapear apenas IDs
          evaluators: [],
          selected: false,
        } as Evaluatee;
      });

      for (const evaluatee of evaluatees) {
        if (!evaluatee.clientId) {
          console.error(
            `Erro: O avaliado ${evaluatee.name} não tem um clientId!`
          );
          evaluatee.clientId = 'Desconhecido';
        }
        if (!evaluatee.projectId) {
          console.error(
            `Erro: O avaliado ${evaluatee.name} não tem um projectId!`
          );
          evaluatee.projectId = 'Desconhecido';
        }

        const clientDoc = await getDocs(collection(this.firestore, 'clients'));
        const projectDoc = await getDocs(
          collection(this.firestore, 'projects')
        );

        const client = clientDoc.docs.find(
          (doc) => doc.id === evaluatee.clientId
        );
        const project = projectDoc.docs.find(
          (doc) => doc.id === evaluatee.projectId
        );

        evaluatee.clientName =
          client?.data()['companyName'] || 'Cliente Não Encontrado';
        evaluatee.projectName =
          project?.data()['name'] || 'Projeto Não Encontrado';

        const assessments = evaluatee.assessments ?? [];
        if (assessments.length > 0) {
          evaluatee.evaluators = allEvaluators
            .filter((evaluator: any) =>
              (evaluator.assessments ?? []).some((assessment: string) =>
                assessments.includes(assessment)
              )
            )
            .map((e) => e.id);
        }
      }

      console.log('Avaliados recuperados do Firestore:', evaluatees);
      this.evaluateesDataSource.data = evaluatees;
      this.evaluateesDataSource._updateChangeSubscription();
      console.log(
        'Avaliados carregados para tabela:',
        this.evaluateesDataSource.data
      );
    } catch (error) {
      console.error('Erro ao carregar avaliados:', error);
      this.snackBar.open('Erro ao carregar avaliados para tabela.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadMailTemplates(): Promise<void> {
    try {
      const templatesCollection = collection(this.firestore, 'mailTemplates');
      const snapshot = await getDocs(templatesCollection);

      this.mailTemplates = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'],
        content: doc.data()['content'],
        emailType: doc.data()['emailType'],
        subject: doc.data()['subject'],
      }));

      console.log('Templates de e-mail carregados:', this.mailTemplates);
    } catch (error) {
      console.error('Erro ao carregar templates de e-mail:', error);
      this.snackBar.open('Erro ao carregar templates de e-mail.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  ngAfterViewInit() {
    console.log('Inicializando paginadores e ordenação...');
    this.evaluatorsDataSource.paginator = this.evaluatorsPaginator;
    this.evaluatorsDataSource.sort = this.evaluatorsSort;
    console.log(
      'DataSource de avaliadores após inicialização:',
      this.evaluatorsDataSource.data
    );

    this.evaluateesDataSource.paginator = this.evaluateesPaginator;
    this.evaluateesDataSource.sort = this.evaluateesSort;
    console.log(
      'DataSource de avaliados após inicialização:',
      this.evaluateesDataSource.data
    );
  }

  editAssessments(evaluator: any): void {
    evaluator.isEditing = true;
  }

  cancelEdit(evaluator: any): void {
    evaluator.isEditing = false;
  }

  async saveAssessments(evaluator: any): Promise<void> {
    try {
      const participantDoc = doc(this.firestore, 'participants', evaluator.id);
      await updateDoc(participantDoc, {
        assessments: evaluator.assessments || [],
      });

      evaluator.isEditing = false;
      this.snackBar.open('Avaliações atualizadas com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao atualizar avaliações:', error);
      this.snackBar.open('Erro ao salvar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async showAssessmentsModal(evaluatee: Evaluatee): Promise<void> {
    const assessmentsDetails = await this.getUpdatedAssessmentsDetails(
      evaluatee.assessments ?? []
    );
    const dialogRef = this.dialog.open(EvaluatorsModalComponent, {
      width: '800px',
      data: {
        evaluatee,
        assessments: assessmentsDetails,
        mailTemplates: this.mailTemplates,
      },
    });

    dialogRef.afterClosed().subscribe(
      async (result: {
        updatedAssessments?: {
          id: string;
          name: string;
          status: string;
          linkSent: boolean;
        }[];
      }) => {
        if (result?.updatedAssessments) {
          // await this.updateParticipantAssessments(
          //   evaluatee,
          //   result.updatedAssessments.map((a) => a.id)
          // );
          // Atualiza o dataSource para refletir as mudanças na tabela de avaliados
          const index = this.evaluateesDataSource.data.findIndex(
            (e) => e.id === evaluatee.id
          );
          if (index !== -1) {
            this.evaluateesDataSource.data[index].assessments =
              result.updatedAssessments.map((a) => a.id);
            this.evaluateesDataSource._updateChangeSubscription();
          }
        }
      }
    );
  }

  async getUpdatedAssessmentsDetails(
    assessmentIds: string[]
  ): Promise<AssessmentDetail[]> {
    try {
      const assessments: AssessmentDetail[] = [];
      for (const id of assessmentIds) {
        console.log('Carregando dados para assessmentId:', id); // Log para depuração
        const assessmentData = await this.getAssessmentDataFromFirestore(id);
        const assessment = this.availableAssessments.find((a) => a.id === id);
        assessments.push({
          id: id,
          name: (assessment && assessment.name) || 'Avaliação Desconhecida',
          status:
            assessmentData?.status === 'completed' ? 'Respondido' : 'Pendente',
          linkSent: assessmentData?.linkSent || false,
        });
      }
      return assessments;
    } catch (error) {
      console.error('Erro ao carregar detalhes das avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
      return [];
    }
  }

  private getAssessmentsDetails(assessmentIds: string[]): AssessmentDetail[] {
    return assessmentIds.map((id) => {
      const assessment = this.availableAssessments.find((a) => a.id === id);
      const assessmentData: any = this.getAssessmentDataFromFirestore(id);
      return {
        id: id,
        name: assessment?.name || 'Avaliação Desconhecida',
        status:
          assessmentData?.status === 'completed' ? 'Respondido' : 'Pendente',
        linkSent: assessmentData?.linkSent || false,
      };
    });
  }

  private async getAssessmentDataFromFirestore(
    assessmentId: string
  ): Promise<any> {
    try {
      // Verifica se assessmentId é uma string válida
      if (!assessmentId || typeof assessmentId !== 'string') {
        console.error('assessmentId inválido:', assessmentId);
        return { status: 'pending', linkSent: false };
      }

      const assessmentDoc = doc(this.firestore, 'assessments', assessmentId);
      const snapshot = await getDocs(
        query(
          collection(this.firestore, 'assessmentLinks'),
          where('assessmentId', '==', assessmentId)
        )
      );
      const linkData = snapshot.docs[0]?.data();
      return {
        status: linkData?.['status'] || 'pending',
        linkSent: !!linkData?.['sentAt'], // Assume que 'sentAt' indica envio
      };
    } catch (error) {
      console.error('Erro ao carregar dados da avaliação:', error);
      this.snackBar.open('Erro ao carregar dados da avaliação.', 'Fechar', {
        duration: 3000,
      });
      return { status: 'pending', linkSent: false };
    }
  }

  async updateParticipantAssessments(
    evaluatee: Evaluatee,
    newAssessments: string[]
  ): Promise<void> {
    try {
      const evaluateeDoc = doc(this.firestore, 'participants', evaluatee.id);
      const updatedAssessments = newAssessments.map((id) => {
        const assessment = this.availableAssessments.find((a) => a.id === id);
        return {
          id: id,
          name: assessment?.name || 'Avaliação Desconhecida',
          status: 'Pendente',
          linkSent: false,
        };
      });
      await updateDoc(evaluateeDoc, {
        assessments: updatedAssessments,
      });

      this.snackBar.open('Avaliações atualizadas com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao atualizar avaliações do participante:', error);
      this.snackBar.open('Erro ao salvar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async sendAssessmentLink(
    evaluatee: Evaluatee,
    assessmentId: string,
    templateId: string
  ): Promise<void> {
    try {
      const template = this.mailTemplates.find((t) => t.id === templateId);
      if (!template) {
        this.snackBar.open('Template de e-mail não encontrado.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      const assessmentData = await this.getAssessmentDataFromFirestore(
        assessmentId
      );
      if (assessmentData.linkSent) {
        this.snackBar.open(
          'O link já foi enviado para esta avaliação.',
          'Fechar',
          { duration: 3000 }
        );
        return;
      }

      // Simula o envio do e-mail (substitua por integração real com serviço de e-mail, como Firebase Functions)
      const assessmentLinkDoc = doc(
        collection(this.firestore, 'assessmentLinks')
      );
      await setDoc(assessmentLinkDoc, {
        assessmentId: assessmentId,
        participantId: evaluatee.id,
        sentAt: new Date(),
        status: 'pending',
        emailTemplate: templateId,
        participantEmail: evaluatee.email,
      });

      // Atualiza o status no dataSource
      const index = this.evaluateesDataSource.data.findIndex(
        (e) => e.id === evaluatee.id
      );
      if (index !== -1) {
        const updatedAssessments =
          this.evaluateesDataSource.data[index].assessments?.map((id: any) => {
            if (id === assessmentId) {
              return id; // O status será atualizado via Firestore listener ou nova chamada
            }
            return id;
          }) || [];
        this.evaluateesDataSource.data[index].assessments = updatedAssessments;
        this.evaluateesDataSource.data[index].assessmentStatus =
          this.updateAssessmentStatus(updatedAssessments); // Atualiza o status, se necessário
        this.evaluateesDataSource._updateChangeSubscription();
      }

      this.snackBar.open('Link de avaliação enviado com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao enviar link de avaliação:', error);
      this.snackBar.open('Erro ao enviar link de avaliação.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  private updateAssessmentStatus(assessments: string[]): string {
    // Simula a atualização do status com base nos assessments
    const allCompleted = assessments.every((id) => {
      const data: any = this.getAssessmentDataFromFirestore(id);
      return data?.status === 'completed';
    });
    return allCompleted ? 'Concluído' : 'Pendente';
  }

  editEvaluateeEvaluators(evaluatee: Evaluatee): void {
    evaluatee['isEditingEvaluators'] = true;
  }

  cancelEvaluateeEvaluatorsEdit(evaluatee: Evaluatee): void {
    evaluatee['isEditingEvaluators'] = false;
  }

  async saveEvaluateeEvaluators(evaluatee: Evaluatee): Promise<void> {
    if (!evaluatee.id) {
      console.error('Erro: O ID do avaliado está indefinido!');
      this.snackBar.open(
        'Erro ao atualizar avaliadores: ID não encontrado.',
        'Fechar',
        { duration: 3000 }
      );
      return;
    }

    try {
      const evaluateeDoc = doc(this.firestore, 'participants', evaluatee.id);
      await updateDoc(evaluateeDoc, { evaluators: evaluatee.evaluators || [] });

      evaluatee['isEditingEvaluators'] = false;
      this.snackBar.open('Avaliadores atualizados com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao atualizar avaliadores:', error);
      this.snackBar.open('Erro ao salvar avaliadores.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  getEvaluatorNames(evaluatorIds: string[] | undefined): string {
    if (!this.availableEvaluators || this.availableEvaluators.length === 0) {
      return 'Carregando avaliadores...';
    }

    return (
      (evaluatorIds ?? [])
        .map(
          (id) =>
            this.availableEvaluators.find((e) => e.id === id)?.name ||
            'Não encontrado'
        )
        .join(', ') || 'Nenhum avaliador'
    );
  }

  getAssessmentNames(assessmentIds: string[] | undefined): string {
    if (!assessmentIds || assessmentIds.length === 0) {
      return 'Sem avaliações';
    }
    return this.availableAssessments
      .filter((a) => assessmentIds.includes(a.id))
      .map((a) => a.name)
      .join(', ');
  }

  applyFilter(event: Event, type: 'evaluators' | 'evaluatees'): void {
    const filterValue = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();
    if (type === 'evaluators') {
      this.evaluatorsDataSource.filter = filterValue;
    } else {
      this.evaluateesDataSource.filter = filterValue;
    }
  }

  filterTable(type: 'evaluators' | 'evaluatees', filters: any): void {
    const dataSource =
      type === 'evaluators'
        ? this.evaluatorsDataSource
        : this.evaluateesDataSource;
    let filteredData = [...dataSource.data];

    if (filters.category) {
      filteredData = filteredData.filter(
        (p) => p.category?.toLowerCase() === filters.category.toLowerCase()
      );
    }
    if (filters.status) {
      filteredData = filteredData.filter(
        (p) => p.status?.toLowerCase() === filters.status.toLowerCase()
      );
    }
    if (filters.clientId) {
      filteredData = filteredData.filter(
        (p) => p.clientId?.toLowerCase() === filters.clientId.toLowerCase()
      );
    }
    if (filters.projectId) {
      filteredData = filteredData.filter(
        (p) => p.projectId?.toLowerCase() === filters.projectId.toLowerCase()
      );
    }

    dataSource.data = filteredData;
    dataSource._updateChangeSubscription();
  }

  selectAll(type: 'evaluators' | 'evaluatees', event: any): void {
    const dataSource =
      type === 'evaluators'
        ? this.evaluatorsDataSource
        : this.evaluateesDataSource;
    dataSource.data.forEach((p) => (p.selected = event.checked));
    dataSource._updateChangeSubscription();
  }

  toggleSelection(type: 'evaluators' | 'evaluatees', participant: any): void {
    const dataSource =
      type === 'evaluators'
        ? this.evaluatorsDataSource
        : this.evaluateesDataSource;
    participant.selected = !participant.selected;
    dataSource._updateChangeSubscription();
  }

  async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);

      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'] || 'Cliente Sem Nome',
      }));

      console.log('Clientes carregados:', this.clients);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadProjects(
    clientId: string
  ): Promise<{ id: string; name: string }[]> {
    if (!clientId) return [];

    try {
      const projectsCollection = collection(this.firestore, 'projects');
      const snapshot = await getDocs(projectsCollection);

      return snapshot.docs
        .filter((doc) => doc.data()['clientId'] === clientId)
        .map((doc) => ({
          id: doc.id,
          name: doc.data()['name'] || 'Projeto Sem Nome',
        }));
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open('Erro ao carregar projetos.', 'Fechar', {
        duration: 3000,
      });
      return [];
    }
  }

  async uploadExcel(event: any): Promise<void> {
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

      console.log('Planilha carregada:', jsonData);

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
        ) {
          continue;
        }

        const category = row[3]?.toString().trim() || '';
        const type = ['Gestor', 'Par', 'Subordinado', 'Outros'].includes(
          category
        )
          ? 'avaliador'
          : 'avaliado';

        participants.push({
          name: row[1]?.toString().trim() || '',
          email: row[2]?.toString().trim() || '',
          category,
          type,
        });
      }

      console.log('Participantes processados:', participants);

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
            clients: this.clients,
            loadProjects: (clientId: string) => this.loadProjects(clientId),
            loadEvaluations: (clientId: string) =>
              this.loadEvaluations(clientId),
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
                  assessments: result.evaluations ?? [],
                  createdAt: new Date(),
                }
              );

              savedParticipants.push({
                ...participant,
                id: docRef.id,
                assessments: result.evaluations ?? [],
              });
            } catch (error) {
              console.error('Erro ao salvar participante:', error);
            }
          }

          this.updateTable(savedParticipants);
          await this.updateEvaluateesTable();

          this.snackBar.open('Upload e salvamento concluídos!', 'Fechar', {
            duration: 3000,
          });
        }
      });
    };

    reader.readAsArrayBuffer(file);
  }

  async updateEvaluateesTable(): Promise<void> {
    try {
      const evaluateesQuery = query(
        collection(this.firestore, 'participants'),
        where('type', '==', 'avaliado')
      );
      const evaluatorsQuery = query(
        collection(this.firestore, 'participants'),
        where('type', '==', 'avaliador')
      );
      const evaluateesSnapshot = await getDocs(evaluateesQuery);
      const evaluatorsSnapshot = await getDocs(evaluatorsQuery);

      const allEvaluators = evaluatorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const evaluatees = evaluateesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          evaluators: [],
        } as any;
      });

      for (const evaluatee of evaluatees) {
        const assessments = evaluatee.assessments ?? [];
        const evaluatorsForThisEvaluatee = allEvaluators
          .filter((evaluator: any) =>
            (evaluator.assessments ?? []).some((assessment: string) =>
              assessments.includes(assessment)
            )
          )
          .map((e) => e.id);

        evaluatee.evaluators = evaluatorsForThisEvaluatee;
      }

      this.evaluateesDataSource.data = evaluatees;
      this.evaluateesDataSource._updateChangeSubscription();
    } catch (error) {
      console.error('Erro ao atualizar tabela de avaliados:', error);
    }
  }

  openEvaluatorsModal(evaluatee: Evaluatee): void {
    const evaluators = this.availableEvaluators
      .filter((evaluator: any) =>
        (evaluatee.evaluators ?? []).includes(evaluator.id)
      )
      .map((evaluator: any) => ({
        name: evaluator.name,
        email: evaluator.email || 'Sem e-mail',
        category: evaluator.category || 'Não informado',
      }));

    this.dialog.open(EvaluatorsModalComponent, {
      width: '600px',
      data: { evaluatee, evaluators },
    });
  }

  async loadEvaluations(
    clientId: string
  ): Promise<{ id: string; name: string }[]> {
    if (!clientId) return [];

    try {
      const assessmentsCollection = collection(this.firestore, 'assessments');
      const snapshot = await getDocs(assessmentsCollection);

      return snapshot.docs
        .filter((doc) => doc.data()['clientId'] === clientId)
        .map((doc) => ({
          id: doc.id,
          name: doc.data()['name'] || 'Avaliação Sem Nome',
        }));
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
      return [];
    }
  }

  updateTable(newParticipants: any[]): void {
    if (!newParticipants || newParticipants.length === 0) return;

    const evaluators = newParticipants.filter((p) => p.type === 'avaliador');
    const evaluatees = newParticipants.filter((p) => p.type === 'avaliado');

    if (evaluators.length > 0) {
      this.evaluatorsDataSource.data = [
        ...this.evaluatorsDataSource.data,
        ...evaluators.map((p) => ({ ...p, selected: false })),
      ];
      this.evaluatorsDataSource._updateChangeSubscription();
    }

    if (evaluatees.length > 0) {
      evaluatees.forEach((evaluatee) => {
        const evaluatorsEmails = evaluatee.evaluators || [];
        evaluatee.evaluators = this.availableEvaluators
          .filter((ev: any) => evaluatorsEmails.includes(ev.email))
          .map((ev) => ev.name);
      });

      this.evaluateesDataSource.data = [
        ...this.evaluateesDataSource.data,
        ...evaluatees.map((p) => ({ ...p, selected: false })),
      ];
      this.evaluateesDataSource._updateChangeSubscription();
    }
  }

  downloadTemplate(): void {
    const link = document.createElement('a');
    link.href = 'assets/templates/Modelo_Avaliacao_360.xlsx';
    link.download = 'Modelo_Avaliacao_360.xlsx';
    link.click();
  }

  async deleteEvaluator(evaluator: Evaluator): Promise<void> {
    try {
      const evaluatorsCollection = collection(this.firestore, 'participants');
      const snapshot = await getDocs(evaluatorsCollection);

      const docToDelete = snapshot.docs.find(
        (doc) => doc.data()['email'] === evaluator.email
      );

      if (docToDelete) {
        await deleteDoc(docToDelete.ref);
        this.snackBar.open('Avaliador excluído com sucesso!', 'Fechar', {
          duration: 3000,
        });

        this.evaluatorsDataSource.data = this.evaluatorsDataSource.data.filter(
          (e) => e.email !== evaluator.email
        );
        this.evaluatorsDataSource._updateChangeSubscription();
      } else {
        this.snackBar.open('Avaliador não encontrado.', 'Fechar', {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Erro ao excluir avaliador:', error);
      this.snackBar.open('Erro ao excluir avaliador.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async deleteEvaluatee(evaluatee: Evaluatee): Promise<void> {
    try {
      const evaluateesCollection = collection(this.firestore, 'participants');
      const snapshot = await getDocs(evaluateesCollection);

      const docToDelete = snapshot.docs.find(
        (doc) => doc.data()['email'] === evaluatee.email
      );

      if (docToDelete) {
        await deleteDoc(docToDelete.ref);
        this.snackBar.open('Avaliado excluído com sucesso!', 'Fechar', {
          duration: 3000,
        });

        this.evaluateesDataSource.data = this.evaluateesDataSource.data.filter(
          (e) => e.email !== evaluatee.email
        );
        this.evaluateesDataSource._updateChangeSubscription();
      } else {
        this.snackBar.open('Avaliado não encontrado.', 'Fechar', {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Erro ao excluir avaliado:', error);
      this.snackBar.open('Erro ao excluir avaliado.', 'Fechar', {
        duration: 3000,
      });
    }
  }
}
