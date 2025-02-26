import { Component, Inject } from '@angular/core';
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
export class EvaluatorsModalComponent {
  displayedColumns: string[] = ['name', 'status', 'linkSent', 'actions']; // Mantive sem 'id'
  assessments: AssessmentDetail[] = [...this.data.assessments]; // Copia as avaliações para manipulação
  addAssessmentForm: FormGroup; // FormGroup para adicionar avaliações

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

  addAssessments(): void {
    if (this.addAssessmentForm.valid) {
      const selectedAssessmentIds =
        this.addAssessmentForm.get('newAssessments')?.value;
      if (selectedAssessmentIds && selectedAssessmentIds.length > 0) {
        const newAssessments = selectedAssessmentIds.map((id: any) => {
          const assessment = this.getAvailableAssessments().find(
            (a) => a.id === id
          );
          return {
            id: id,
            name: assessment?.name || 'Nova Avaliação',
            status: 'Pendente',
            linkSent: false,
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
        // Atualiza localmente antes de enviar
        assessment.linkSent = true;
        assessment.status = 'Pendente';

        // Monta a requisição para enviar o e-mail, conforme o exemplo curl
        const emailRequest = {
          email: this.data.evaluatee.email,
          templateId: templateId,
          participantId: this.data.evaluatee.id,
          assessmentId: assessmentId,
        };

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
        });

        // Atualiza o status do participante, se necessário
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
      const currentAssessments = this.assessments.map((a) => a.id);
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
      await updateDoc(evaluateeDoc, {
        assessments: this.assessments.map((a) => a.id),
      });
    } catch (error) {
      console.error('Erro ao atualizar avaliações no Firestore:', error);
      this.snackBar.open('Erro ao atualizar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  closeModal(): void {
    this.dialogRef.close({
      updatedAssessments: this.assessments.map((a) => a.id),
    });
  }

  public getAvailableAssessments(): AssessmentDetail[] {
    // Retorna avaliações disponíveis que não estão na lista atual
    const currentIds = new Set(this.assessments.map((a) => a.id));
    return this.data.assessments.filter((a) => !currentIds.has(a.id));
  }
}
