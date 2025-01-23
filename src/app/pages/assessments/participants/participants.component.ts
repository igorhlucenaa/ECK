import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
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
  name: string;
  email: string;
  clientId: string;
  projectId: string;
}

@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [MaterialModule, CommonModule, ReactiveFormsModule],
  templateUrl: './participants.component.html',
  styleUrls: ['./participants.component.scss'],
})
export class ParticipantsComponent implements OnInit, AfterViewInit {
  evaluatorsDisplayedColumns: string[] = ['name', 'email', 'category'];
  evaluateesDisplayedColumns: string[] = ['name', 'email', 'client', 'project'];

  evaluatorsDataSource = new MatTableDataSource<any>([]);
  evaluateesDataSource = new MatTableDataSource<any>([]);

  @ViewChild('evaluatorsPaginator') evaluatorsPaginator!: MatPaginator;
  @ViewChild('evaluateesPaginator') evaluateesPaginator!: MatPaginator;

  @ViewChild('evaluatorsSort') evaluatorsSort!: MatSort;
  @ViewChild('evaluateesSort') evaluateesSort!: MatSort;
  clients: { id: string; name: string }[] = [];
  projects: { id: string; name: string }[] = [];
  currentUser: any = null;

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
  }

  async loadEvaluators(): Promise<void> {
    const evaluatorsCollection = collection(this.firestore, 'participants');
    const snapshot = await getDocs(evaluatorsCollection);

    const evaluators = snapshot.docs
      .map((doc) => doc.data())
      .filter((participant: any) => participant.type === 'avaliador');

    this.evaluatorsDataSource.data = evaluators;
  }

  async loadEvaluatees(): Promise<void> {
    const evaluateesCollection = collection(this.firestore, 'participants');
    const snapshot = await getDocs(evaluateesCollection);

    const evaluatees = snapshot.docs
      .map((doc) => doc.data() as any)
      .filter((participant) => participant.type === 'avaliado');

    // Carregar nomes de clientes e projetos
    for (const evaluatee of evaluatees) {
      const clientDoc = await getDocs(collection(this.firestore, 'clients'));
      const projectDoc = await getDocs(collection(this.firestore, 'projects'));

      const client = clientDoc.docs.find(
        (doc) => doc.id === evaluatee.clientId
      );
      const project = projectDoc.docs.find(
        (doc) => doc.id === evaluatee.projectId
      );

      evaluatee['clientName'] =
        client?.data()['companyName'] || 'Cliente Não Encontrado';
      evaluatee['projectName'] =
        project?.data()['name'] || 'Projeto Não Encontrado';
    }

    this.evaluateesDataSource.data = evaluatees;
  }

  ngAfterViewInit() {
    this.evaluatorsDataSource.paginator = this.evaluatorsPaginator;
    this.evaluatorsDataSource.sort = this.evaluatorsSort;

    this.evaluateesDataSource.paginator = this.evaluateesPaginator;
    this.evaluateesDataSource.sort = this.evaluateesSort;
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

      // Filtra os dados a partir da linha 31 (índice 30 no array)
      const dataRows = jsonData.slice(30); // Dados começam na linha 31
      const participants = dataRows
        .filter((row) => row && row[1] && row[2] && row[3]) // Filtra linhas válidas
        .map((row) => {
          const type =
            row[2]?.toLowerCase().includes('gestor') ||
            row[2]?.toLowerCase().includes('par') ||
            row[2]?.toLowerCase().includes('subordinado')
              ? 'avaliador'
              : 'avaliado';

          return {
            name: row[1]?.toString().trim() || '', // Coluna B (Nome)
            category: row[2]?.toString().trim() || '', // Coluna C (Categoria)
            email: row[3]?.toString().trim() || '', // Coluna D (Email)
            type, // Define o tipo com base na categoria
          };
        });

      // Exibe os participantes no modal para confirmação
      const dialogRef = this.dialog.open(
        ParticipantsConfirmationDialogComponent,
        {
          width: '800px',
          data: {
            participants,
            clients: this.clients, // Lista de clientes carregada anteriormente
            loadProjects: (clientId: string) => this.loadProjects(clientId), // Passa a função para o modal
          },
        }
      );

      // Aguarda a confirmação do usuário
      dialogRef.afterClosed().subscribe(async (result) => {
        if (result) {
          const { client, project } = result;

          // Salva os participantes no Firebase com cliente e projeto
          for (const participant of participants) {
            try {
              const participantsCollection = collection(
                this.firestore,
                'participants'
              );
              await addDoc(participantsCollection, {
                ...participant,
                clientId: client, // ID do cliente selecionado
                projectId: project, // ID do projeto selecionado
                createdAt: new Date(),
              });

              // Atualiza a tabela localmente
              this.updateTable({
                ...participant,
                clientId: client,
                projectId: project,
                clientName:
                  this.clients.find((c) => c.id === client)?.name ||
                  'Cliente Não Encontrado',
                projectName:
                  this.projects.find((p) => p.id === project)?.name ||
                  'Projeto Não Encontrado',
              });
            } catch (error) {
              console.error('Erro ao salvar participante:', participant, error);
            }
          }

          this.snackBar.open('Upload e salvamento concluídos!', 'Fechar', {
            duration: 3000,
          });
        } else {
          console.log('Upload cancelado pelo usuário.');
        }
      });
    };

    reader.readAsArrayBuffer(file);
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
}
