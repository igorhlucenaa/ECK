import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { Model } from 'survey-core';
import { VisualizationPanel } from 'survey-analytics';
import 'survey-analytics/survey.analytics.css';
import { MaterialModule } from 'src/app/material.module';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';

interface Assessment {
  id: string;
  name: string;
  surveyJSON: any;
}

@Component({
  selector: 'app-assessment-dashboard',
  templateUrl: './assessment-dashboard.component.html',
  styleUrls: ['./assessment-dashboard.component.scss'],
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule]
})
export class AssessmentDashboardComponent implements OnInit {
  private visualizationPanel: VisualizationPanel;
  assessments: Assessment[] = [];
  selectedAssessmentId = new FormControl('all');
  isLoading = false;

  constructor(
    private firestore: Firestore,
    private location: Location
  ) {}

  ngOnInit() {
    this.loadAssessments();
  }

  private async loadAssessments() {
    try {
      this.isLoading = true;
      const assessmentsRef = collection(this.firestore, 'assessments');
      const assessmentsSnapshot = await getDocs(assessmentsRef);

      this.assessments = assessmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data()['name'],
        surveyJSON: doc.data()['surveyJSON']
      }));

      // Carregar todas as respostas inicialmente
      await this.loadResponses();
    } catch (error) {
      console.error('Erro ao carregar formulários:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async onAssessmentChange(event: MatSelectChange) {
    await this.loadResponses();
  }

  private async loadResponses() {
    try {
      this.isLoading = true;
      const responsesRef = collection(this.firestore, 'responses');
      let responsesQuery;

      if (this.selectedAssessmentId.value === 'all') {
        // Carregar todas as respostas
        responsesQuery = query(responsesRef);
      } else {
        // Carregar respostas de um formulário específico
        responsesQuery = query(
          responsesRef,
          where('assessmentId', '==', this.selectedAssessmentId.value)
        );
      }

      const responsesSnapshot = await getDocs(responsesQuery);
      const results = responsesSnapshot.docs.map(doc => doc.data()['answers']);

      // Se estiver mostrando todas as respostas, precisamos combinar as perguntas de todos os formulários
      let allQuestions:any = [];
      if (this.selectedAssessmentId.value === 'all') {
        const uniqueQuestions = new Set();
        this.assessments.forEach(assessment => {
          const surveyModel = new Model(assessment.surveyJSON);
          surveyModel.getAllQuestions().forEach(question => {
            if (!uniqueQuestions.has(question.name)) {
              uniqueQuestions.add(question.name);
              allQuestions.push(question);
            }
          });
        });
      } else {
        const selectedAssessment = this.assessments.find(
          a => a.id === this.selectedAssessmentId.value
        );
        if (selectedAssessment) {
          const surveyModel = new Model(selectedAssessment.surveyJSON);
          allQuestions = surveyModel.getAllQuestions();
        }
      }

      // Criar o painel de visualização
      const container = document.getElementById('dashboardContainer');
      if (container && allQuestions.length > 0) {
        container.innerHTML = '';
        this.visualizationPanel = new VisualizationPanel(
          allQuestions,
          results
        );
        this.visualizationPanel.render(container);
      }
    } catch (error) {
      console.error('Erro ao carregar respostas:', error);
    } finally {
      this.isLoading = false;
    }
  }

  goBack(): void {
    this.location.back();
  }
}
