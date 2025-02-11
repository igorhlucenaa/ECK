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

interface Evaluator {
  name: string;
  email: string;
  category: string;
}

interface Evaluatee {
  id: string;
  name: string;
  email: string;
  clientId: string;
  projectId: string;
  assessments?: string[];
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
    'name',
    'email',
    'category',
    'assessments',
    'actions',
  ];
  evaluateesDisplayedColumns: string[] = [
    'name',
    'email',
    'client',
    'project',
    'assessments', // Avaliações que o avaliado responderá
    'evaluators', // 🔹 Nova coluna mostrando os avaliadores
    'actions',
  ];

  evaluatorsDataSource = new MatTableDataSource<any>([]);
  evaluateesDataSource = new MatTableDataSource<any>([]);

  @ViewChild('evaluatorsPaginator') evaluatorsPaginator!: MatPaginator;
  @ViewChild('evaluateesPaginator') evaluateesPaginator!: MatPaginator;

  @ViewChild('evaluatorsSort') evaluatorsSort!: MatSort;
  @ViewChild('evaluateesSort') evaluateesSort!: MatSort;
  clients: { id: string; name: string }[] = [];
  projects: { id: string; name: string }[] = [];
  currentUser: any = null;
  availableAssessments: { id: string; name: string }[] = [];
  availableEvaluators: { id: string; name: string }[] = [];

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
    await this.loadEvaluatorsList(); // 🔹 Carregar avaliadores ao iniciar

    console.log('Avaliadores carregados:', this.availableEvaluators); // Debugging
  }

  async loadEvaluatorsList(): Promise<void> {
    try {
      const evaluatorsCollection = collection(this.firestore, 'participants');
      const snapshot = await getDocs(evaluatorsCollection);

      const allParticipants: any = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()?.['name'] || 'Nome Desconhecido', // 🔹 Garante que sempre tenha um nome
        type: doc.data()?.['type'] || '',
      }));

      console.log('Todos os participantes carregados:', allParticipants); // 🛠 Verificar os dados carregados

      this.availableEvaluators = allParticipants.filter((participant: any) => {
        return participant.type.toLowerCase() === 'avaliador';
      });

      console.log('Avaliadores filtrados:', this.availableEvaluators); // 🛠 Verificar os avaliadores filtrados
    } catch (error) {
      console.error('Erro ao carregar avaliadores:', error);
      this.snackBar.open('Erro ao carregar avaliadores.', 'Fechar', {
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
        name: doc.data()['name'],
      }));
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadEvaluators(): Promise<void> {
    const evaluatorsCollection = collection(this.firestore, 'participants');
    const snapshot = await getDocs(evaluatorsCollection);

    const evaluators = snapshot.docs
      .map((doc) => ({
        id: doc.id, // 🔹 Adiciona o ID do documento
        ...doc.data(),
      }))
      .filter((participant: any) => participant.type === 'avaliador');

    this.evaluatorsDataSource.data = evaluators;
  }

  editEvaluateeAssessments(evaluatee: any): void {
    evaluatee.isEditing = true;
  }

  cancelEvaluateeEdit(evaluatee: any): void {
    evaluatee.isEditing = false;
  }

  async saveEvaluateeAssessments(evaluatee: any): Promise<void> {
    if (!evaluatee.id) {
      console.error('Erro: O ID do avaliado está indefinido!');
      this.snackBar.open(
        'Erro ao atualizar avaliações: ID não encontrado.',
        'Fechar',
        { duration: 3000 }
      );
      return;
    }

    try {
      const evaluateeDoc = doc(this.firestore, 'participants', evaluatee.id);
      await updateDoc(evaluateeDoc, {
        assessments: evaluatee.assessments || [],
      });

      evaluatee.isEditing = false;
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

  editEvaluateeEvaluators(evaluatee: any): void {
    evaluatee.isEditingEvaluators = true;
  }

  cancelEvaluateeEvaluatorsEdit(evaluatee: any): void {
    evaluatee.isEditingEvaluators = false;
  }

  async saveEvaluateeEvaluators(evaluatee: any): Promise<void> {
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

      evaluatee.isEditingEvaluators = false;
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

  getEvaluatorNames(evaluatorIds: string[]): string {
    if (!this.availableEvaluators || this.availableEvaluators.length === 0) {
      return 'Carregando avaliadores...';
    }

    return (
      this.availableEvaluators
        .filter((e) => evaluatorIds?.includes(e.id))
        .map((e) => e.name)
        .join(', ') || 'Nenhum avaliador'
    );
  }

  async loadEvaluatees(): Promise<void> {
    const evaluateesCollection = collection(this.firestore, 'participants');
    const evaluatorsCollection = collection(this.firestore, 'participants');
    const snapshot = await getDocs(evaluateesCollection);
    const evaluatorsSnapshot = await getDocs(evaluatorsCollection);

    // Carregar todos os avaliadores
    const allEvaluators = evaluatorsSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((participant: any) => participant.type === 'avaliador');

    const evaluatees: any = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          evaluators: [], // Inicializa a lista de avaliadores
        };
      })
      .filter((participant: any) => participant.type === 'avaliado');

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
      const projectDoc = await getDocs(collection(this.firestore, 'projects'));

      const client = clientDoc.docs.find(
        (doc) => doc.id === evaluatee.clientId
      );
      const project = projectDoc.docs.find(
        (doc) => doc.id === evaluatee.projectId
      );

      evaluatee['clientName'] =
        client?.data()?.['companyName'] || 'Cliente Não Encontrado';
      evaluatee['projectName'] =
        project?.data()?.['name'] || 'Projeto Não Encontrado';

      // 🔹 Encontrar avaliadores que compartilham as mesmas avaliações
      if (evaluatee.assessments && evaluatee.assessments.length > 0) {
        evaluatee.evaluators = allEvaluators
          .filter((evaluator: any) =>
            evaluator.assessments?.some((assessment: string) =>
              evaluatee.assessments.includes(assessment)
            )
          )
          .map((e) => e.id); // Armazena apenas os IDs dos avaliadores
      }
    }

    this.evaluateesDataSource.data = evaluatees;
  }

  ngAfterViewInit() {
    this.evaluatorsDataSource.paginator = this.evaluatorsPaginator;
    this.evaluatorsDataSource.sort = this.evaluatorsSort;

    this.evaluateesDataSource.paginator = this.evaluateesPaginator;
    this.evaluateesDataSource.sort = this.evaluateesSort;
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
      await updateDoc(participantDoc, { assessments: evaluator.assessments });

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

  getAssessmentNames(assessmentIds: string[]): string {
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

  async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients'); // Nome da coleção 'clients'
      const snapshot = await getDocs(clientsCollection);

      // Mapeia os documentos da coleção para o array de clientes
      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id, // ID do documento no Firestore
        name: doc.data()['companyName'] || 'Cliente Sem Nome', // Campo 'companyName' na coleção
      }));

      console.log('Clientes carregados:', this.clients); // Verifique os dados carregados
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

      // Filtrar projetos pelo clientId
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

      // Seleciona a primeira aba da planilha
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Converte a planilha para um array de arrays
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Lê como array
      });

      const dataRows = jsonData.slice(30);
      const participants = dataRows
        .filter((row) => row && row[1] && row[2] && row[3])
        .map((row) => ({
          name: row[1]?.toString().trim() || '',
          category: row[2]?.toString().trim() || '',
          email: row[3]?.toString().trim() || '',
          type: 'avaliado',
        }));

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
          for (const participant of participants) {
            try {
              await addDoc(collection(this.firestore, 'participants'), {
                ...participant,
                clientId: result.client,
                projectId: result.project,
                evaluations: result.evaluations, // 🔹 Salvar avaliações selecionadas
                createdAt: new Date(),
              });

              this.updateTable(participant);
            } catch (error) {
              console.error('Erro ao salvar participante:', error);
            }
          }

          this.snackBar.open('Upload e salvamento concluídos!', 'Fechar', {
            duration: 3000,
          });
        }
      });
    };

    reader.readAsArrayBuffer(file);
  }

  async loadEvaluations(
    clientId: string
  ): Promise<{ id: string; name: string }[]> {
    if (!clientId) return [];

    try {
      const assessmentsCollection = collection(this.firestore, 'assessments'); // Collection correta
      const snapshot = await getDocs(assessmentsCollection);

      // Filtrar avaliações pelo clientId
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

  updateTable(participant: any): void {
    if (participant.type === 'avaliador') {
      // Atualiza a tabela de Avaliadores
      const currentData = this.evaluatorsDataSource.data;
      this.evaluatorsDataSource.data = [...currentData, participant];
    } else if (participant.type === 'avaliado') {
      // Atualiza a tabela de Avaliados
      const currentData = this.evaluateesDataSource.data;
      this.evaluateesDataSource.data = [...currentData, participant];
    }
  }

  downloadTemplate(): void {
    const link = document.createElement('a');
    link.href = 'assets/templates/Modelo_Avaliacao_360.xlsx'; // Caminho para o arquivo no diretório assets
    link.download = 'Modelo_Avaliacao_360.xlsx'; // Nome do arquivo baixado
    link.click();
  }

  async deleteEvaluator(evaluator: Evaluator): Promise<void> {
    try {
      const evaluatorsCollection = collection(this.firestore, 'participants');
      const snapshot = await getDocs(evaluatorsCollection);

      // Localiza o documento correspondente no Firestore
      const docToDelete = snapshot.docs.find(
        (doc) => doc.data()['email'] === evaluator.email
      );

      if (docToDelete) {
        await deleteDoc(docToDelete.ref);
        this.snackBar.open('Avaliador excluído com sucesso!', 'Fechar', {
          duration: 3000,
        });

        // Atualiza a tabela localmente
        this.evaluatorsDataSource.data = this.evaluatorsDataSource.data.filter(
          (e) => e.email !== evaluator.email
        );
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

      // Localiza o documento correspondente no Firestore
      const docToDelete = snapshot.docs.find(
        (doc) => doc.data()['email'] === evaluatee.email
      );

      if (docToDelete) {
        await deleteDoc(docToDelete.ref);
        this.snackBar.open('Avaliado excluído com sucesso!', 'Fechar', {
          duration: 3000,
        });

        // Atualiza a tabela localmente
        this.evaluateesDataSource.data = this.evaluateesDataSource.data.filter(
          (e) => e.email !== evaluatee.email
        );
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
