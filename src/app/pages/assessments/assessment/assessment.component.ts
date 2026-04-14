import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as Survey from 'survey-angular';
import { SurveyService } from './survey.service';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  collection,
} from '@angular/fire/firestore';

// Defina a interface para o objeto Assessment retornado pelo SurveyService
interface Assessment {
  surveyJSON: any;
  ['theme']?: any; // Usando any para flexibilidade, pois ITheme pode não existir nessa versão
  // Adicione outros campos, se necessário (ex.: clientId, name, etc.)
}

@Component({
  selector: 'app-assessment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assessment.component.html',
  styleUrls: ['./assessment.component.scss'],
})
export class AssessmentComponent implements OnInit {
  surveyJSON: any;
  token: string | null = null;
  participantId: string | null = null;
  assessmentId: string | null = null;
  surveyCompleted = false;
  alreadyCompleted = false;

  constructor(
    private route: ActivatedRoute,
    private surveyService: SurveyService,
    private firestore: Firestore // Injetei Firestore para atualizações diretas, se necessário
  ) {}

  ngOnInit(): void {
    this.assessmentId = this.route.snapshot.queryParamMap.get('assessment');
    this.token = this.route.snapshot.queryParamMap.get('token');
    this.participantId = this.route.snapshot.queryParamMap.get('participant');

    if (this.assessmentId && this.participantId) {
      this.checkAndLoadSurvey(this.assessmentId, this.participantId);
    } else {
      console.error('ID da avaliação ou participantId não fornecido na URL.');
    }
  }

  async checkAndLoadSurvey(
    assessmentId: string,
    participantId: string
  ): Promise<void> {
    this.alreadyCompleted = await this.surveyService.checkIfAssessmentCompleted(
      assessmentId,
      participantId
    );

    if (this.alreadyCompleted) {
            return;
    }

    await this.loadSurvey(assessmentId, participantId);
  }

  async loadSurvey(assessmentId: string, participantId: string): Promise<void> {
    const assessment: any = await this.surveyService.getAssessment(
      assessmentId
    );

    if (assessment && assessment.surveyJSON) {
      this.surveyJSON = assessment.surveyJSON;

      // Substituir {{nome_avaliado}} pelo nome do avaliado correto
      let surveyJSONFinal = this.surveyJSON;
      try {
        let avaliadoName = '';

        const participantRef = doc(this.firestore, `participants/${participantId}`);
        const participantSnap = await getDoc(participantRef);
        console.log('[nome_avaliado] participantId:', participantId, 'exists:', participantSnap.exists());

        if (participantSnap.exists()) {
          const participantData = participantSnap.data();
          const participantType: string = participantData['type'] || '';
          console.log('[nome_avaliado] type:', participantType, 'name:', participantData['name']);

          if (participantType === 'avaliador') {
            const linkQuery = query(
              collection(this.firestore, 'assessmentLinks'),
              where('participantId', '==', participantId),
              where('assessmentId', '==', assessmentId)
            );
            const linkSnap = await getDocs(linkQuery);
            console.log('[nome_avaliado] links found:', linkSnap.size, linkSnap.docs.map(d => d.data()));
            if (!linkSnap.empty) {
              const avaliadoId: string = linkSnap.docs[0].data()['avaliadoId'] || '';
              console.log('[nome_avaliado] avaliadoId:', avaliadoId);
              if (avaliadoId) {
                const avaliadoSnap = await getDoc(doc(this.firestore, `participants/${avaliadoId}`));
                if (avaliadoSnap.exists()) {
                  avaliadoName = avaliadoSnap.data()['name'] || avaliadoSnap.data()['nome'] || '';
                }
              }
            }
          } else {
            avaliadoName = participantData['name'] || participantData['nome'] || '';
          }
        }

        console.log('[nome_avaliado] avaliadoName resolvido:', avaliadoName);
        const jsonStr = JSON.stringify(surveyJSONFinal)
          .replace(/\{\{nome_avaliado\}\}/g, avaliadoName);
        surveyJSONFinal = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Não foi possível substituir {{nome_avaliado}}:', e);
      }

      // Carregar o tema do atributo 'theme' do documento, se existir
      const theme: any = assessment['theme']; // Usando any para flexibilidade

      const survey = new Survey.Model(surveyJSONFinal);

      // Configurar locale pelo idioma do navegador (pt, en, es)
      const browserLang = navigator.language?.split('-')[0]?.toLowerCase();
      const supportedLocales = ['pt', 'en', 'es'];
      survey.locale = supportedLocales.includes(browserLang) ? browserLang : 'pt';

      // Aplicar o tema salvo, se existir, com validação para versão 1.12.23
      if (theme && theme.cssVariables) {
        try {
          // Tentar aplicar as variáveis CSS diretamente
          Object.entries(theme.cssVariables).forEach(([key, value]) => {
            // Usar notação de colchetes para acessar setCssVariable, se existir
            if ('setCssVariable' in survey) {
              (survey as any)['setCssVariable'](key, value as string);
            } else {
              // Alternativa: aplicar via CSS dinâmico (se setCssVariable não existe)
              const style = document.createElement('style');
              style.textContent = `:root { ${key}: ${value}; }`;
              document.head.appendChild(style);
              console.warn(
                'Usando CSS dinâmico, pois setCssVariable não está disponível.'
              );
            }
          });

          // Tentar aplicar o tema, se suportado
          if ('theme' in survey) {
            survey['theme'] = theme; // Usar notação de colchetes
             // Log para depuração
          } else {
            console.warn(
              'Propriedade theme não suportada nesta versão do SurveyJS.'
            );
          }
        } catch (error) {
          console.error('Erro ao aplicar o tema:', error);
        }
      } else {
        console.warn('Nenhum tema ou cssVariables encontrado no documento.');
      }

      // Carrega progresso anterior, se houver
      const existingData = await this.surveyService.getAssessmentProgress(
        assessmentId,
        participantId
      );
      if (existingData) {
        survey.data = existingData;
      }

      survey.onValueChanged.add(this.onValueChanged.bind(this));
      survey.onComplete.add(this.onSurveyCompleted.bind(this));

      survey.render('surveyContainer');
    } else {
      console.error('Avaliação inválida ou surveyJSON não encontrado.');
    }
  }

  async onValueChanged(sender: Survey.SurveyModel): Promise<void> {
    const surveyData = sender.data;
    
    if (this.assessmentId && this.token && this.participantId) {
      try {
        await this.surveyService.saveAssessmentProgress(
          this.assessmentId,
          this.participantId,
          this.token,
          surveyData
        );
      } catch (error) {
        console.error('Erro ao salvar progresso:', error);
      }
    } else {
      console.warn('Faltam parâmetros para salvar o progresso.');
    }
  }

  async onSurveyCompleted(sender: Survey.SurveyModel): Promise<void> {
    const surveyData = sender.data;

    if (this.assessmentId && this.token && this.participantId) {
      try {
        await this.surveyService.completeAssessment(
          this.assessmentId,
          this.participantId,
          this.token,
          surveyData
        );

        await this.updateAssessmentLinkStatus(
          this.assessmentId,
          this.participantId
        );

        // Deduz 1 crédito do cliente ao registrar a resposta
        await this.deductClientCredit(this.participantId);

        this.surveyCompleted = true;
      } catch (error) {
        console.error('Erro ao salvar conclusão:', error);
      }
    } else {
      console.warn('Faltam parâmetros para salvar a conclusão.');
    }
  }

  private async deductClientCredit(participantId: string): Promise<void> {
    try {
      // Busca o participante para obter o clientId
      const participantRef = doc(this.firestore, `participants/${participantId}`);
      const participantSnap = await getDoc(participantRef);
      if (!participantSnap.exists()) return;

      const participantData = participantSnap.data();

      // Verificar se crédito já foi deduzido para este participante (evitar dupla dedução)
      if (participantData['creditDeducted'] === true) return;

      // Obter clientId — direto no participante ou via projeto
      let clientId: string = participantData['clientId'] || '';
      if (!clientId && participantData['projectId']) {
        const projectSnap = await getDoc(doc(this.firestore, `projects/${participantData['projectId']}`));
        if (projectSnap.exists()) clientId = projectSnap.data()['clientId'] || '';
      }
      if (!clientId) return;

      const clientRef = doc(this.firestore, `clients/${clientId}`);
      const clientSnap = await getDoc(clientRef);
      if (!clientSnap.exists()) return;

      const currentCredits: number = clientSnap.data()['credits'] || 0;
      const currentUsed: number = clientSnap.data()['creditsUsed'] || 0;

      // FIFO: deduz do pedido aprovado mais antigo com remainingCredits > 0
      // Ordena em memória para não depender de índice em createdAt
      const ordersSnap = await getDocs(query(
        collection(this.firestore, 'creditOrders'),
        where('clientId', '==', clientId),
        where('status', '==', 'Aprovado')
      ));
      const sortedOrders = ordersSnap.docs.slice().sort((a, b) => {
        const tA = a.data()['createdAt']?.toMillis?.() ?? 0;
        const tB = b.data()['createdAt']?.toMillis?.() ?? 0;
        return tA - tB;
      });

      // Verifica se há algum pedido com créditos disponíveis
      const hasAvailableOrder = sortedOrders.some(d =>
        (d.data()['remainingCredits'] ?? d.data()['credits'] ?? 0) > 0
      );
      if (!hasAvailableOrder) return;

      for (const orderDoc of sortedOrders) {
        const remaining: number = orderDoc.data()['remainingCredits'] ?? orderDoc.data()['credits'] ?? 0;
        if (remaining > 0) {
          await updateDoc(doc(this.firestore, `creditOrders/${orderDoc.id}`), {
            remainingCredits: remaining - 1,
          });
          break;
        }
      }

      // Atualiza totais do cliente (Math.max evita valor negativo caso haja dessincronização)
      await updateDoc(clientRef, {
        credits: Math.max(0, currentCredits - 1),
        creditsUsed: currentUsed + 1,
      });

      // Marca o participante para evitar dupla dedução
      await updateDoc(participantRef, { creditDeducted: true });

    } catch (error) {
      // Não bloqueia a conclusão da avaliação em caso de erro
      console.error('Erro ao deduzir crédito do cliente:', error);
    }
  }

  // Método para atualizar o status em assessmentLinks
  private async updateAssessmentLinkStatus(
    assessmentId: string,
    participantId: string
  ): Promise<void> {
    try {
      const assessmentLinksQuery = query(
        collection(this.firestore, 'assessmentLinks'),
        where('assessmentId', '==', assessmentId),
        where('participantId', '==', participantId)
      );
      const snapshot = await getDocs(assessmentLinksQuery);

      if (!snapshot.empty) {
        const linkDoc = doc(
          this.firestore,
          'assessmentLinks',
          snapshot.docs[0].id
        );
        await updateDoc(linkDoc, {
          status: 'completed',
          completedAt: new Date(), // Opcional: adicionar timestamp de conclusão
        });
              } else {
        console.warn('Nenhum document link encontrado para atualização.');
      }
    } catch (error) {
      console.error('Erro ao atualizar status em assessmentLinks:', error);
      throw error; // Repropaga o erro para tratamento no onSurveyCompleted
    }
  }
}
