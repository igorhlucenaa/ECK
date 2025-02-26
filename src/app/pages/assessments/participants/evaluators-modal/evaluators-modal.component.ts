import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { TemplateSelectionModalComponent } from './template-selection-modal/template-selection-modal.component';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  getDoc,
} from '@angular/fire/firestore';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';

interface ModalData {
  evaluatee: any;
  assessments: AssessmentDetail[];
  mailTemplates: MailTemplate[];
}

interface AssessmentDetail {
  id: string;
  name: string;
  status: string; // 'Respondido' ou 'Pendente'
  linkSent: boolean; // Se o link foi enviado por e-mail
  isResponded: boolean; // Indica se a avaliação foi respondida
}

interface MailTemplate {
  id: string;
  name: string;
  content: string;
  emailType: string;
  subject: string;
}

@Component({
  selector: 'app-evaluators-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule, ReactiveFormsModule],
  templateUrl: './evaluators-modal.component.html',
  styleUrls: ['./evaluators-modal.component.scss'],
})
export class EvaluatorsModalComponent implements OnInit {
  displayedColumns: string[] = [
    'name',
    'status',
    'linkSent',
    'isResponded',
    'actions',
  ]; // Inclui 'isResponded'
  assessments: any[] = []; // Inicializado vazio para recarregar do Firestore
  addAssessmentForm: FormGroup; // FormGroup para adicionar avaliações
  availableAssessmentsSync: AssessmentDetail[] = []; // Nova propriedade síncrona para o mat-select

  constructor(
    public dialogRef: MatDialogRef<EvaluatorsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalData,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private firestore: Firestore // Injetei Firestore para atualizações
  ) {
    this.addAssessmentForm = this.fb.group({
      newAssessments: [[], Validators.required], // Campo para seleções múltiplas
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadAssessmentsFromFirestore(); // Carrega avaliações atualizadas do Firestore ao abrir o modal
    this.availableAssessmentsSync = await this.getAvailableAssessments(); // Carrega as avaliações disponíveis para o mat-select
  }

  async checkIfAssessmentCompleted(
    assessmentId: string,
    participantId: string
  ): Promise<boolean> {
    try {
      const resultRef = doc(
        this.firestore,
        `assessments/${assessmentId}/results/${participantId}`
      );
      const resultSnap = await getDoc(resultRef);

      if (resultSnap.exists() && resultSnap.data()?.['completedAt']) {
        console.log('Avaliação já foi concluída por este participante.');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao verificar conclusão da avaliação:', error);
      return false; // Assume não concluído em caso de erro
    }
  }

  // async checkIfAssessmentCompleted(
  //   assessmentId: string,
  //   participantId: string
  // ): Promise<boolean> {
  //   try {
  //     const assessmentLinkQuery = query(
  //       collection(this.firestore, 'assessmentLinks'),
  //       where('assessmentId', '==', assessmentId),
  //       where('participantId', '==', participantId)
  //     );
  //     const snapshot = await getDocs(assessmentLinkQuery);
  //     const linkData = snapshot.docs[0]?.data();
  //     return linkData?.['status'] === 'completed'; // Retorna true se o status for 'completed'
  //   } catch (error) {
  //     console.error('Erro ao verificar se a avaliação foi concluída:', error);
  //     return false; // Retorna false em caso de erro
  //   }
  // }

  async loadAssessmentsFromFirestore(): Promise<void> {
    try {
      const evaluateeDoc = doc(
        this.firestore,
        'participants',
        this.data.evaluatee.id
      );
      const snapshot = await getDocs(
        query(
          collection(this.firestore, 'assessmentLinks'),
          where('participantId', '==', this.data.evaluatee.id)
        )
      );
      const linkedAssessments = snapshot.docs.map((doc) => doc.data());

      this.assessments = (this.data.assessments || []).map(
        async (assessment) => {
          const isResponded = await this.checkIfAssessmentCompleted(
            assessment.id,
            this.data.evaluatee.id
          ); // Verifica se foi respondida de forma assíncrona
          const linkData = linkedAssessments.find(
            (link) => link['assessmentId'] === assessment.id
          );
          return {
            ...assessment,
            linkSent: !!linkData?.['sentAt'],
            status: isResponded ? 'Respondido' : 'Pendente', // Atualiza status baseado em isResponded
            isResponded: isResponded, // Define com base na verificação
          };
        }
      );

      // Aguarda todas as promessas serem resolvidas
      this.assessments = await Promise.all(this.assessments);
    } catch (error) {
      console.error('Erro ao carregar avaliações do Firestore:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  addAssessments(): void {
    if (this.addAssessmentForm.valid) {
      const selectedAssessmentIds =
        this.addAssessmentForm.get('newAssessments')?.value;
      if (selectedAssessmentIds && selectedAssessmentIds.length > 0) {
        const newAssessments = selectedAssessmentIds.map((id: string) => {
          const assessment = this.availableAssessmentsSync.find(
            (a) => a.id === id
          );
          return {
            id: id,
            name: assessment?.name || 'Nova Avaliação',
            status: 'Pendente',
            linkSent: false,
            isResponded: false, // Novo campo com valor padrão falso, agora booleano
          };
        });
        this.assessments = [...this.assessments, ...newAssessments];
        this.addAssessmentForm.reset();
        this.updateFirestoreAssessments(); // Atualiza no Firestore
        this.snackBar.open('Avaliações adicionadas com sucesso!', 'Fechar', {
          duration: 3000,
        });
      }
    } else {
      this.snackBar.open(
        'Selecione pelo menos uma avaliação para adicionar.',
        'Fechar',
        { duration: 3000 }
      );
    }
  }

  sendLink(assessmentId: string): void {
    const assessment = this.assessments.find((a) => a.id === assessmentId);
    if (assessment && !assessment.linkSent) {
      const dialogRef = this.dialog.open(TemplateSelectionModalComponent, {
        width: '600px',
        data: {
          mailTemplates: this.data.mailTemplates,
          assessments: [assessmentId],
        },
      });

      dialogRef
        .afterClosed()
        .subscribe(async (result: { selectedTemplate?: string }) => {
          if (result?.selectedTemplate) {
            await this.sendAssessmentLink(
              assessmentId,
              result.selectedTemplate
            );
          }
        });
    } else {
      this.snackBar.open(
        'Esta avaliação já teve o link enviado ou não está disponível para envio.',
        'Fechar',
        { duration: 3000 }
      );
    }
  }

  async sendAssessmentLink(
    assessmentId: string,
    templateId: string
  ): Promise<void> {
    try {
      const template = this.data.mailTemplates.find((t) => t.id === templateId);
      if (!template) {
        this.snackBar.open('Template de e-mail não encontrado.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      const assessment = this.assessments.find((a) => a.id === assessmentId);
      if (assessment) {
        // Verifica se todos os campos necessários estão presentes antes de enviar
        if (
          !this.data.evaluatee.email ||
          !templateId ||
          !this.data.evaluatee.id ||
          !assessmentId
        ) {
          throw new Error(
            'Campos obrigatórios faltando: email, templateId, participantId, ou assessmentId.'
          );
        }

        // Atualiza localmente antes de enviar
        assessment.linkSent = true;
        assessment.status = 'Pendente';
        assessment.isResponded = false; // Mantém como falso até que o usuário responda

        // Monta a requisição para enviar o e-mail, conforme o exemplo curl
        const emailRequest = {
          email: this.data.evaluatee.email,
          templateId: templateId,
          participantId: this.data.evaluatee.id,
          assessmentId: assessmentId,
        };

        console.log('Payload enviado para sendEmail:', emailRequest); // Log para depuração

        // Faz a chamada à função Firebase Cloud Function
        const response = await fetch(
          'https://us-central1-pwa-workana.cloudfunctions.net/sendEmail',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailRequest),
          }
        );

        if (!response.ok) {
          throw new Error('Erro ao enviar e-mail: ' + (await response.text()));
        }

        // Atualiza no Firestore (assessmentLinks)
        const assessmentLinkDoc = doc(
          collection(this.firestore, 'assessmentLinks')
        );
        await setDoc(assessmentLinkDoc, {
          assessmentId: assessmentId,
          participantId: this.data.evaluatee.id,
          sentAt: new Date(),
          status: 'pending',
          emailTemplate: templateId,
          participantEmail: this.data.evaluatee.email,
          isResponded: false, // Novo campo no Firestore
        });

        // Atualiza o status no Firestore para refletir o envio
        await this.updateParticipantAssessmentStatus(assessmentId);

        this.snackBar.open('Link de avaliação enviado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      }
    } catch (error: any) {
      console.error('Erro ao enviar link de avaliação:', error);
      this.snackBar.open(
        `Erro ao enviar link de avaliação: ${error.message}`,
        'Fechar',
        { duration: 3000 }
      );
    }
  }

  async updateParticipantAssessmentStatus(assessmentId: string): Promise<void> {
    try {
      const evaluateeDoc = doc(
        this.firestore,
        'participants',
        this.data.evaluatee.id
      );
      const currentAssessments = this.assessments.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        linkSent: a.linkSent,
        isResponded: a.isResponded, // Inclui o novo campo
      }));
      await updateDoc(evaluateeDoc, { assessments: currentAssessments });
    } catch (error) {
      console.error('Erro ao atualizar status do participante:', error);
      this.snackBar.open(
        'Erro ao atualizar status do participante.',
        'Fechar',
        { duration: 3000 }
      );
    }
  }

  removeAssessment(assessmentId: string): void {
    this.assessments = this.assessments.filter((a) => a.id !== assessmentId);
    this.updateFirestoreAssessments(); // Atualiza no Firestore
    this.snackBar.open('Avaliação removida com sucesso!', 'Fechar', {
      duration: 3000,
    });
  }

  async updateFirestoreAssessments(): Promise<void> {
    try {
      const evaluateeDoc = doc(
        this.firestore,
        'participants',
        this.data.evaluatee.id
      );
      // Filtra e valida os dados para remover valores undefined ou inválidos
      const validAssessments = this.assessments
        .map((a) => ({
          id: a.id || '', // Garante que id não seja undefined
          name: a.name || 'Nova Avaliação', // Garante que name não seja undefined
          status: a.status || 'Pendente', // Garante que status não seja undefined
          linkSent: a.linkSent !== undefined ? a.linkSent : false, // Garante que linkSent não seja undefined
          isResponded: a.isResponded !== undefined ? a.isResponded : false, // Garante que isResponded não seja undefined
        }))
        .filter(
          (a) =>
            a.id &&
            a.name &&
            a.status !== undefined &&
            a.linkSent !== undefined &&
            a.isResponded !== undefined
        ); // Remove qualquer assessment inválido

      console.log(
        'Dados validados para atualização no Firestore:',
        validAssessments
      ); // Log para depuração

      if (validAssessments.length === 0) {
        throw new Error('Nenhuma avaliação válida para atualizar.');
      }

      await updateDoc(evaluateeDoc, {
        assessments: validAssessments,
      });
      this.snackBar.open('Avaliações atualizadas com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar avaliações no Firestore:', error);
      this.snackBar.open(
        `Erro ao atualizar avaliações: ${error.message}`,
        'Fechar',
        { duration: 3000 }
      );
    }
  }

  closeModal(): void {
    this.dialogRef.close({
      updatedAssessments: this.assessments.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        linkSent: a.linkSent,
        isResponded: a.isResponded, // Inclui o novo campo
      })),
    });
  }

  async getAvailableAssessments(): Promise<AssessmentDetail[]> {
    // Busca avaliações diretamente da coleção assessments no Firestore
    try {
      const assessmentsCollection = collection(this.firestore, 'assessments');
      const snapshot = await getDocs(assessmentsCollection);
      const allAssessments: AssessmentDetail[] = [];

      for (const doc of snapshot.docs) {
        const assessmentId = doc.id;
        const assessmentData = doc.data();
        const isResponded = await this.checkIfAssessmentCompleted(
          assessmentId,
          this.data.evaluatee.id
        ); // Verifica se foi respondida de forma assíncrona

        const linkQuery = query(
          collection(this.firestore, 'assessmentLinks'),
          where('assessmentId', '==', assessmentId),
          where('participantId', '==', this.data.evaluatee.id)
        );
        const linkSnapshot = await getDocs(linkQuery);
        const linkData = linkSnapshot.docs[0]?.data();

        allAssessments.push({
          id: assessmentId,
          name: assessmentData['name'] || 'Avaliação Desconhecida',
          status: isResponded ? 'Respondido' : 'Pendente', // Atualiza status baseado em isResponded
          linkSent: !!linkData?.['sentAt'],
          isResponded: isResponded, // Verifica se foi respondida
        });
      }

      const currentIds = new Set(this.assessments.map((a) => a.id));
      return allAssessments.filter((a) => !currentIds.has(a.id));
    } catch (error) {
      console.error(
        'Erro ao carregar avaliações disponíveis do Firestore:',
        error
      );
      this.snackBar.open('Erro ao carregar avaliações disponíveis.', 'Fechar', {
        duration: 3000,
      });
      return [];
    }
  }
}
