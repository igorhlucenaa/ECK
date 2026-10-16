# Lista de features inovadoras — ECK 360°

> **Perspectiva:** engenharia de inovação · **Negócio:** consultoria B2B multi-tenant (avaliação 360°, créditos, devolutiva consultiva)  
> **Atualizado:** setembro/2026 · **Complementa:** `ROADMAP-INOVACAO.md`, `ECK-V2-FEATURES-INOVADORAS.md`

---

## 1. Contexto de negócio (north star)

A ECK Consulting vende **ciclos de 360°** para empresas: metodologia (competências), operação (convites, prazos, lembretes), interpretação (gap, Johari, abertas) e entrega (PDF/DOCX/Excel + publicação para gestores). O produto **monetiza por crédito** (~1 avaliado = 1 crédito) e **escala** quando a consultoria repete ciclos sem retrabalho.

**Inovação que importa aqui:** menos horas da consultoria por ciclo, mais recorrência de créditos, mais valor percebido pelo RH/gestor, **sem** virar “form builder genérico”.

---

## 2. Alavancas já no produto (base para inovar)

| Alavanca | Uso para features novas |
|----------|-------------------------|
| Biblioteca global de competências + import em relatórios (rev. 6.1) | Benchmark interno, kits metodológicos, mercado de templates |
| Formulários globais + duplicar entre clientes | Franchise de metodologia ECK, onboarding rápido |
| Lembretes + templates GrapesJS + e-mail branded | Multicanal, jornadas de engajamento |
| `releasedReports` + perfil `viewer` | Portal do colaborador, trilhas de desenvolvimento |
| Dashboard de créditos, prazos e respostas | Alertas preditivos, health score do cliente |
| Survey.js + agregações em relatórios | IA explicativa, calibração, pulse surveys |
| i18n pt / en / es | Expansão LATAM e clientes multinacionais |

---

## 3. Lista de features inovadoras

Legenda de esforço: **S** (semanas), **M** (1–2 meses), **L** (trimestre+).  
Legenda de impacto: **$** receita/recorrência, **⏱** eficiência consultoria, **★** diferenciação comercial.

| # | Feature | Dor de negócio | Proposta | Valor | Esf. | Reaproveita |
|---|---------|----------------|----------|-------|------|-------------|
| **Operação e recorrência** |
| 1 | **Clone de ciclo anual** | Reconfigurar projeto, e-mails e competências a cada ano | Duplicar projeto “limpo” (estrutura, templates, lembretes; sem respostas) | ⏱ ★ | S | `projects`, `mailTemplates`, rev. 6.1 duplicate |
| 2 | **Kit “Novo cliente ECK”** | Onboarding demora semanas | Wizard: cliente + grupo competência global + formulário padrão + 3 templates e-mail | ⏱ ★ | M | `competencyGroups`, `assessments.global`, biblioteca global |
| 3 | **Fila comercial de créditos in-app** | Pedidos fora do sistema | `admin_client` solicita pacote; master aprova com 1 clique + notificação | $ ⏱ | S | `creditOrders`, dashboard créditos |
| 4 | **Renovação preditiva de créditos** | Cliente esgota saldo no meio do ciclo | Alertas “saldo para N avaliados” + sugestão de pedido antes do prazo | $ | S | créditos reservados/consumidos |
| 5 | **Health score do projeto** | Projetos morrem sem resposta | Score único: % resposta, dias restantes, créditos, lembretes disparados | ⏱ ★ | S | dashboard KPIs, `participants` |
| **Experiência quem responde (sem login hoje)** |
| 6 | **Micro-portal por link mágico** | Avaliado não vê status nem histórico | Página pós-login-token: “você respondeu X de Y”, reabrir se permitido, FAQ | ★ | M | tokens `assessmentLinks` |
| 7 | **Lembretes multicanal** | E-mail ignorado | WhatsApp/SMS opcional (opt-in LGPD) para pendências críticas | ★ | M | lembretes, Cloud Functions |
| 8 | **Preenchimento adaptativo** | Formulários longos abandonados | Survey: salvar progresso visível + estimativa “faltam ~8 min” | ⏱ | M | Survey.js, autosave existente |
| 9 | **Acessibilidade & mobile first no survey** | Resposta baixa em campo | Modo mobile dedicado, contraste, leitor de tela no fluxo público | ★ | M | `assessment.component` |
| **Devolutiva e people analytics** |
| 10 | **Resumo executivo 1 página** | RH precisa slide para diretoria rápido | PDF automático: adesão, top gaps, 3 insights por competência | ★ $ | S | pdfmake, agregações reports |
| 11 | **PDI assistido pós-relatório** | Feedback não vira ação | Checklist 3–5 ações por competência fraca + metas 30/60/90 dias | ★ $ | M | gap chart, `releasedReports` |
| 12 | **Evolução histórica por pessoa** | Só vê ciclo atual | Linha do tempo de médias por competência (ciclos anteriores do mesmo avaliado) | ★ $ | M | `results`, `releasedReports` |
| 13 | **Nine-box / mapa de talento** | Cliente pede visão sucessão | Matriz potencial × desempenho a partir de competências + gestor | ★ $ | L | scores, categorias avaliador |
| 14 | **Calibração de avaliadores** | Notas enviesadas distorcem 360 | Painel outliers (sempre 1/5, tempo < 2 min, desvio vs grupo) antes de fechar | ★ | M | `results`, estatísticas dashboard |
| 15 | **Benchmark anonimizado ECK** | “Somos bons ou ruins?” | Comparar cliente vs média agregada ECK (opt-in, k-anonymity) | ★ $ | L | Firestore agregado, LGPD |
| **Metodologia e conteúdo** |
| 16 | **Marketplace interno de kits** | Consultores reinventam roda | Catálogo master: grupos + formulários + templates certificados ECK | $ ⏱ | M | biblioteca global, `isGlobalTemplate` |
| 17 | **Pulse entre ciclos 360** | 12 meses sem touchpoint | Mini-survey 5 perguntas no meio do ano (1 crédito fracionado ou add-on) | $ | M | Survey + lembretes |
| 18 | **Competências com evidências comportamentais** | Nota sem contexto | Opcional: exemplos STAR por competência na devolutiva | ★ | M | perguntas abertas + IA (ver 22) |
| 19 | **Simulador “e se” no relatório** | RH testa cortes antes de publicar | Ocultar categoria de avaliador e recalcular médias ao vivo | ⏱ ★ | M | `reports.component` agregações |
| **Inteligência (IA responsável)** |
| 20 | **Síntese qualitativa com citações** | Horas lendo abertas | Resumo por competência com trechos anonimizados + tom configurável | ⏱ ★ | M | abertas, Cloud Function + LLM |
| 21 | **Coach de devolutiva para gestor** | Gestor não sabe conduzir 1:1 | Roteiro de conversa gerado a partir do PDF do avaliado | ★ $ | M | relatório + templates |
| 22 | **Detector de risco de turnover** | RH reativo | Sinal combinando gap extremo, comentários negativos, baixa autoavaliação | ★ $ | L | NLP + regras |
| 23 | **Assistente de desenho de formulário** | Consultor monta survey do zero | Sugerir perguntas a partir do grupo de competências selecionado | ⏱ | M | competências + catálogo perguntas |
| **Enterprise, compliance e integração** |
| 24 | **Centro de privacidade LGPD** | Enterprise exige DPA/auditoria | Exportar dados do titular, registro de consentimento, retention por cliente | ★ $ | L | Auth, `participants`, logs |
| 25 | **SSO SAML/OIDC por cliente** | IT bloqueia senha local | Login corporativo para `admin_client` / `viewer` | ★ $ | M | Firebase Auth custom |
| 26 | **Webhooks & integrações HRIS** | Dados duplicados em planilha | Eventos: conclusão, crédito baixo, projeto atrasado → SAP/Totvs/Slack | $ | S–M | Cloud Functions |
| 27 | **Assinatura digital de devolutiva** | Prova de que gestor recebeu feedback | Aceite eletrônico ao publicar `releasedReports` | ★ | M | viewer + audit trail |
| 28 | **Ambiente sandbox por cliente** | Medo de errar em produção | Clone “treino” do tenant sem consumir créditos reais | ⏱ ★ | M | multi-tenant, créditos |
| **Monetização e produto** |
| 29 | **Planos por módulo** | Tudo ou nada | Add-ons: pulse, benchmark, IA resumo, WhatsApp | $ | M | feature flags por `clientId` |
| 30 | **Crédito fracionado (pulse / re-pulse)** | Pacote mínimo alto demais | 0,2 crédito por mini-ciclo ou pacote “engajamento” | $ | M | `creditOrders` regras |
| 31 | **White-label completo** | Cliente quer marca dele no survey | Domínio custom, logo no link público, e-mail FROM do cliente | ★ $ | M | customization + Functions |
| 32 | **Relatório comparativo multi-unidade** | Holdings com várias BUs | Um PDF consolidado + drill-down por `userGroups`/unidade | $ ★ | L | reports + filtros |
| **Plataforma e escala** |
| 33 | **Tour guiado contextual (já iniciado)** | Curva de aprendizado alta | Tours por perfil + checklist “primeiro ciclo completo” | ⏱ | S | `tour-registry`, i18n |
| 34 | **Modo offline / sync para survey** | Rede instável em fábricas | Cache respostas + envio quando online | ★ | L | PWA assessment |
| 35 | **Observabilidade de entregabilidade** | “Não recebi e-mail” | Dashboard SMTP: bounce, open rate por template/cliente | ⏱ | M | send history, Functions |
| 36 | **API pública read-only para BI** | Cliente usa Power BI | Export agendado para BigQuery/Parquet por tenant | $ | L | `results` ETL |

---

## 4. Top 10 recomendadas (próximo trimestre)

Ordem sugerida equilibrando **receita**, **retenção** e **esforço**:

1. **Clone de ciclo anual** (#1)  
2. **Fila comercial de créditos in-app** (#3)  
3. **Resumo executivo 1 página** (#10)  
4. **Health score do projeto** (#5)  
5. **Kit “Novo cliente ECK”** (#2)  
6. **Webhooks pós-evento** (#26)  
7. **PDI assistido pós-relatório** (#11) — regras primeiro, IA depois  
8. **Calibração de avaliadores** (#14)  
9. **Marketplace interno de kits** (#16) — extensão natural da biblioteca global 6.1  
10. **Síntese qualitativa com citações** (#20) — piloto em 1 cliente âncora  

---

## 5. Features “moonshot” (12–24 meses)

- **Rede ECK de benchmarks setoriais** — dados agregados por setor (CNPJ/sector já no cadastro) com monetização anonymized insights.  
- **Gêmeo digital de competências** — simular impacto de treinamentos nas médias do próximo ciclo (modelo simples + histórico).  
- **360 contínuo** — substituir “projeto com fim” por janelas rolantes de feedback (crédito por janela).  
- **Copilot da consultora** — chat in-app que responde “como importo grupo X no relatório do cliente Y?” usando docs + estado Firestore (RAG interno).

---

## 6. O que evitar (anti-patterns de inovação)

- Rebuild de survey builder próprio (Survey.js já paga o custo metodológico).  
- Portal completo para avaliado **antes** de resolver adesão e lembretes (multicanal + health score primeiro).  
- IA “caixa preta” em notas — sempre explicável, revisável pela consultoria ECK.  
- Features que quebram isolamento multi-tenant (benchmark só com opt-in e agregação).  

---

## 7. Métricas de sucesso por hipótese

| Hipótese | Métrica leading | Métrica lagging |
|----------|-----------------|-----------------|
| Menos retrabalho | Tempo médio setup projeto | Nº ciclos/cliente/ano |
| Mais créditos | Taxa conversão pedido aprovado | ARPU por cliente |
| Melhor adesão | % resposta D-7 do prazo | Projetos concluídos sem extensão |
| Mais valor consultivo | Uso resumo executivo + PDI | NPS RH / renovação contrato |
| Enterprise | Clientes com SSO/LGPD ativo | Ticket médio plano enterprise |

---

## 8. Referências internas

- Operação e QA produto: `docs/QA-RELATORIO-REVISAO-6.1-COMPLETO.md`  
- Justificativas comerciais: `docs/JUSTIFICATIVAS-PRODUTO.md`  
- Roadmap detalhado e tiers: `docs/ROADMAP-INOVACAO.md`  
- Visão V2 completa: `docs/ECK-V2-FEATURES-INOVADORAS.md`  

---

*Documento vivo: revisar após cada ciclo comercial ou release major (ex.: 6.2, 7.0).*
