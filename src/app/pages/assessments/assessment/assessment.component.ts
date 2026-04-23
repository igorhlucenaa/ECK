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
  runTransaction,
  increment,
  query,
  where,
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
  linkCancelled = false;

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
    // Verifica se o link foi cancelado
    const linkQuery = query(
      collection(this.firestore, 'assessmentLinks'),
      where('assessmentId', '==', assessmentId),
      where('participantId', '==', participantId)
    );
    const linkSnap = await getDocs(linkQuery);

    // Sem link nenhum = link inválido ou nunca enviado → bloqueia acesso
    if (linkSnap.empty) {
      this.linkCancelled = true;
      return;
    }

    // Todos os links cancelados/expirados → bloqueia acesso
    const statuses = linkSnap.docs.map(d => d.data()['status'] as string);
    const allInactive = statuses.every(s => s === 'cancelled' || s === 'expired');
    if (allInactive) {
      this.linkCancelled = true;
      return;
    }

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

        // Marca link como completed + deduz crédito atomicamente (idempotente)
        await this.deductAndMarkCompleted(this.assessmentId, this.participantId);

        this.surveyCompleted = true;
      } catch (error) {
        console.error('Erro ao salvar conclusão:', error);
      }
    } else {
      console.warn('Faltam parâmetros para salvar a conclusão.');
    }
  }

  /**
   * Operação atômica e idempotente que:
   * 1. Marca assessmentLinks.status = 'completed'
   * 2. Marca participants.creditDeducted = true
   * 3. Move crédito: reservedCredits-1 + creditsUsed+1 (novo sistema)
   *    ou credits-1 + creditsUsed+1 (legado sem reserva)
   *
   * Não faz FIFO incremental nos creditOrders — isso fica exclusivamente
   * em sincronizarCreditosClientes / onAssessmentCompleted (Cloud Function).
   *
   * CORREÇÃO 4: sem FIFO incremental  |  CORREÇÃO 5: runTransaction idempotente
   */
  private async deductAndMarkCompleted(
    assessmentId: string,
    participantId: string
  ): Promise<void> {
    try {
      const participantRef = doc(this.firestore, `participants/${participantId}`);

      // ── Resolve refs FORA da transação (queries não permitidas dentro) ──

      // clientId — direto no participante ou via projeto
      const pSnap = await getDoc(participantRef);
      if (!pSnap.exists()) return;
      const pData = pSnap.data();

      let clientId: string = pData['clientId'] || '';
      if (!clientId && pData['projectId']) {
        const projSnap = await getDoc(doc(this.firestore, `projects/${pData['projectId']}`));
        if (projSnap.exists()) clientId = projSnap.data()['clientId'] || '';
      }
      if (!clientId) return;

      const clientRef = doc(this.firestore, `clients/${clientId}`);

      // assessmentLink doc ref (query fora da transação)
      const linkQ = query(
        collection(this.firestore, 'assessmentLinks'),
        where('assessmentId', '==', assessmentId),
        where('participantId', '==', participantId)
      );
      const linkSnap = await getDocs(linkQ);
      if (linkSnap.empty) {
        console.warn('Nenhum assessmentLink encontrado — conclusão não registrada.');
        return;
      }
      const linkDocRef = doc(this.firestore, 'assessmentLinks', linkSnap.docs[0].id);

      // ── Transação atômica ────────────────────────────────────────────────
      await runTransaction(this.firestore, async (t) => {
        const freshParticipant = await t.get(participantRef);
        if (!freshParticipant.exists()) return;

        const freshLink = await t.get(linkDocRef);
        const creditWasReserved =
          freshLink.exists() && freshLink.data()?.['creditReserved'] === true;

        // Sempre marca o link como completed
        t.update(linkDocRef, { status: 'completed', completedAt: new Date() });

        // Idempotência: se já deduziu, apenas o link update é necessário
        if (freshParticipant.data()['creditDeducted'] === true) return;

        // Marca participante — impede re-execução em caso de retry
        t.update(participantRef, { creditDeducted: true });

        // Deduz do cliente via FieldValue.increment (atômico, sem ler o valor atual)
        if (creditWasReserved) {
          // Novo sistema: crédito já foi debitado de credits no disparo → move reserved→used
          t.update(clientRef, {
            reservedCredits: increment(-1),
            creditsUsed:     increment(1),
          });
        } else {
          // Legado: crédito nunca foi reservado → desconta de credits agora
          t.update(clientRef, {
            credits:     increment(-1),
            creditsUsed: increment(1),
          });
        }
      });
    } catch (error) {
      // Não bloqueia a exibição da tela de conclusão
      console.error('Erro ao registrar conclusão e deduzir crédito:', error);
    }
  }
}
