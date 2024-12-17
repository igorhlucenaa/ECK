import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-questionnaire-preview',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './preview-questionnaire.component.html',
  styleUrls: ['./preview-questionnaire.component.scss'],
})
export class QuestionnairePreviewComponent implements OnInit {
  projectId: string | null = null;
  questionnaireId: string | null = null;
  questionnaireName: string = '';
  questionnaireContent: SafeHtml | null = null;

  constructor(
    private firestore: Firestore,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    this.questionnaireId = this.route.snapshot.paramMap.get('questionnaireId');

    if (this.projectId && this.questionnaireId) {
      this.loadQuestionnaire();
    }
  }

  private async loadQuestionnaire(): Promise<void> {
    try {
      const docRef = doc(
        this.firestore,
        `projects/${this.projectId}/questionnaires/${this.questionnaireId}`
      );
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        this.questionnaireName = data['name'];
        this.questionnaireContent = this.sanitizer.bypassSecurityTrustHtml(
          data['content']
        );
      }
    } catch (error) {
      console.error('Erro ao carregar questionário:', error);
    }
  }
}
