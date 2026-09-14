# Alterações recentes — ECK360

Documento consolidado das mudanças implementadas desde a rodada de **internacionalização (i18n)**, passando pelos **arquivos de revisão de 26/08**, **análises de relatório (teste avaliado + Hydro)** e **regras de templates/projetos**.

**Período de referência:** commits recentes (`19baf6e` → `db90c99`) + sessões de desenvolvimento em agosto/2026.

**Idiomas suportados:** pt-BR (padrão), en, es.

---

## Índice

1. [Internacionalização (i18n)](#1-internacionalização-i18n)
2. [Loading global traduzido](#2-loading-global-traduzido)
3. [Relatórios — interface e terminologia](#3-relatórios--interface-e-terminologia)
4. [Relatórios — gráficos, PDF e exportação](#4-relatórios--gráficos-pdf-e-exportação)
5. [Relatórios — cálculo de médias (correção Hydro)](#5-relatórios--cálculo-de-médias-correção-hydro)
6. [Templates vs projetos (regra Eli 28/08)](#6-templates-vs-projetos-regra-eli-2808)
7. [Notificações e publicação de relatórios](#7-notificações-e-publicação-de-relatórios)
8. [Tour guiado e UX](#8-tour-guiado-e-ux)
9. [Participantes e usuários](#9-participantes-e-usuários)
10. [Scripts e documentação auxiliar](#10-scripts-e-documentação-auxiliar)
11. [Correções dos documentos de revisão — status](#11-correções-dos-documentos-de-revisão--status)

---

## 1. Internacionalização (i18n)

### Infraestrutura

- Padrão adotado: **chaves em português** nos JSON (`pt-BR.json`, `en.json`, `es.json`); templates com `| translate`; TypeScript com `translate.instant()` / `this.t()`.
- Guia de auditoria criado: `angular-i18n-cursor-role-prompt.md`.
- Utilitário: `src/app/utils/i18n-labels.util.ts`.

### Telas e componentes internacionalizados

| Área | Arquivos principais |
|------|---------------------|
| **Relatórios (completo)** | `reports.component.html/.ts`, `report-builder-visual`, `client-export-dialog`, `survey-dashboard` |
| **Layout** | `vertical/header`, `vertical/sidebar`, `horizontal/header` — fallback "Usuário" → `\| translate` |
| **Dashboard** | `dashboard.component.html/.ts` |
| **Participantes** | `participants.component.html`, `send-history-dialog` |
| **Projetos** | `projects-list`, modais de export/geração |
| **Usuários** | `create-user`, `edit-user`, `edit-group`, `group-details`, `user-details`, `group-details-dialog` |
| **Configurações** | `reminder-settings` |
| **Tour** | `tour-overlay` — títulos e descrições traduzíveis |
| **Usuários (notificação)** | Status de notificação com `TranslateModule` |

### Rodadas específicas de relatórios

- **Passagem 1–2:** workflow, competências, montar, publicação, export, modo clássico.
- **Passagem 3:** toolbar/canvas/painel do `report-builder-visual`; snackbars e labels dinâmicos no TS.
- **Sincronização EN/ES:** scripts de correção e segunda passagem (`fix-en-i18n.js`, `fix-es-i18n.js`, `sync-es-from-en.js`, `fix-i18n-round3.js`).

### Scripts i18n

| Script | Função |
|--------|--------|
| `scripts/fix-reports-i18n-keys.js` | Chaves da tela de relatórios |
| `scripts/fix-loading-i18n.js` | +21 chaves PT, +18 EN, +18 ES (loadings) |
| `scripts/fix-i18n-round3.js` | Terceira rodada relatórios |
| `scripts/fix-en-i18n.js` | Correções EN |
| `scripts/fix-es-i18n.js` | Correções ES |
| `scripts/sync-es-from-en.js` | Sincronização ES a partir do EN |

---

## 2. Loading global traduzido

**Problema:** overlay global exibia `"Carregando dados..."` fixo em PT.

**Correção:**

| Arquivo | Mudança |
|---------|---------|
| `global-loading.component.ts` | `TranslateModule` + `{{ (loadingState.message \|\| 'Carregando...') \| translate }}` |
| `firestore-loading.interceptor.ts` | Mensagens via `TranslateService.instant()` |

**Telas com loading corrigido:**

- `add-participant-modal`
- `report-generation-modal`
- `project-export-dialog` / `client-export-dialog`
- `survey-dashboard`
- `participants`, `send-history-dialog`
- `user-details`, `group-details`, `edit-user`, `edit-group`, `create-user`, `group-details-dialog`

---

## 3. Relatórios — interface e terminologia

| Alteração | Detalhe |
|-----------|---------|
| **Avaliação → Formulário** | Labels, placeholders e hints na faixa de filtros (`slide 28`) |
| **Pontuação do(a) Avaliado(a)** | Rótulo da coluna de ranking ajustado (`slide 41`) |
| **Outros → Demais Avaliadores** | Gráfico de defasagem e Janela de Johari |
| **Normalização de seções** | `report-section-defaults.ts`, títulos padrão por tipo de seção |
| **Strip de resíduos de cópia** | Remoção de textos colados indevidamente nos títulos |
| **Quebras de página** | CSS para gráficos Johari, defasagem, destaques no PDF/preview |
| **Export DOCX** | Seletores híbridos em `functions/src/docx-export/hybrid-render-session.ts` |

---

## 4. Relatórios — gráficos, PDF e exportação

- **Gráficos de pizza:** formatação de rótulos, legenda e cores para exportação.
- **PDF (pdfmake):** integração com dados do componente; defasagem usa `getDadosPerguntaDefasagem` quando disponível.
- **Publicação / export:** fluxo de PDF individual, DOCX, geração em lote mantido com auto-vínculo projeto → template.

---

## 5. Relatórios — cálculo de médias (correção Hydro)

**Documentos de origem:**

- `a. Analise_teste avaliado_Relatório Feedback 360.docx`
- `b. Analise_Eliwelton Batista_Relatório Feedback 360_Hydro.docx`

### Problema

Duas fórmulas conviviam no mesmo relatório:

| Método | Onde estava errado | Exemplo Hydro |
|--------|-------------------|---------------|
| **Média por grupo → média dos grupos** (correto) | Resumo, Johari, barras, tabela | Demais = **3,79** |
| **Pooled** (soma tudo ÷ total de respondentes) | Defasagem, ranking | Demais = **3,60** |

Com Pares tendo 2 respondentes, o pooled fazia esse grupo pesar o dobro — podendo **mudar o quadrante da Johari** em "Gerar valor para o cliente".

### Solução implementada

**Função central:** `calcularMediaPorGrupos()` em `reports-utils.ts`

```
Para cada grupo (Gestor, Pares, Subordinados, Outros):
  média_grupo = média das respostas individuais naquele grupo
Demais avaliadores = média simples das médias de grupo (grupos vazios ignorados)
```

### Onde foi aplicado

| Seção | Nível | Status |
|-------|-------|--------|
| Resumo dos Resultados | Competência × grupo | ✅ Já estava correto |
| Janela de Johari | Competência | ✅ Já estava correto |
| Gráficos de barra / pizza | Competência | ✅ Já estava correto |
| Tabela de Frequência | Sentença × grupo | ✅ Já estava correto |
| **Gráfico de Defasagem** | Sentença | ✅ **Corrigido** |
| **Ranking (altas/baixas)** | Sentença | ✅ **Corrigido** |
| **PDF defasagem** | Sentença | ✅ Usa callback do componente |

### Ranking — colunas e ordenação

| Coluna | Antes | Agora |
|--------|-------|-------|
| Pontuação do(a) Avaliado(a) | Média pooled (rótulo enganoso) | **Autoavaliação real** |
| Pontuação média sem autoavaliação | Repetia coluna 1 ou errada | **Demais avaliadores** (média por grupo) |
| Ordenação Top/Bottom | Pela média pooled | Pela coluna **sem autoavaliação** |

**Melhorias extras no ranking:**

- Desempate estável por `perguntaId`.
- Item do Top N não aparece também no Bottom N.

**Testes:** `reports-utils.spec.ts` — valida diferença pooled vs por grupo.

### Arquivos alterados

- `src/app/pages/reports/reports-utils.ts`
- `src/app/pages/reports/reports-utils.spec.ts`
- `src/app/pages/reports/reports.component.ts`
- `src/app/pages/reports/reports.component.html`
- `src/app/services/report-pdfmake.service.ts`

---

## 6. Templates vs projetos (regra Eli 28/08)

**Regra de negócio:**

| Entidade | Regra |
|----------|-------|
| **Template** (`reportTemplates`) | Biblioteca do **cliente** — pode existir sem projeto |
| **Projeto** (`projects`) | Deve ter **1 template fixo** (`reportTemplateId`) |
| **Relatórios** | Ao selecionar projeto, template auto-aplica |

### Implementado

**Biblioteca de templates (sem projeto/avaliação):**

- Botão **"Templates do cliente"** na faixa de filtros (Relatórios).
- **Modo biblioteca:** edita layouts na aba Montar sem exigir formulário/projeto/competências.
- Banner com opção **"Sair do modo biblioteca"**.
- Criação de template usa **estrutura padrão** quando o editor está vazio.
- **"Gerenciar templates do cliente"** também quando projeto não tem template vinculado.

**Template obrigatório no projeto:**

- `project-detail`: `reportTemplateId` com `Validators.required`.
- Removida opção "— Nenhum —".
- Hint: *"Obrigatório — todo projeto deve ter um template de relatório vinculado"*.
- Mensagem específica ao salvar sem template.

**Arquivos:**

- `project-detail.component.ts/.html`
- `reports.component.ts/.html/.scss`
- Chaves i18n em `pt-BR.json`, `en.json`, `es.json`

---

## 7. Notificações e publicação de relatórios

- Nova função de **notificação para relatórios finalizados** (Firebase Functions).
- E-mails para avaliados/equipes ao publicar.
- Templates de e-mail e traduções PT/EN/ES.
- Integração na tela de relatórios (status de publicação / viewer aguardando aprovação).

---

## 8. Tour guiado e UX

- Tour interativo em **Participantes** e **Competências** (novos passos).
- `tour-overlay` com i18n (`TranslateModule`).
- Descrição do passo "Modelos de E-mail" simplificada.
- Ícone de ajuda (?) contextual por tela — marcado OK na revisão Viewer.

---

## 9. Participantes e usuários

- **Cargo e setor:** exibição e importação via planilha; campos no modal de adição e edição.
- Remoção de campos duplicados de cargo/setor do componente principal (simplificação).
- **Status de notificação** internacionalizado na listagem de usuários.

---

## 10. Scripts e documentação auxiliar

| Arquivo | Descrição |
|---------|-----------|
| `angular-i18n-cursor-role-prompt.md` | Persona e playbook i18n para o agente |
| `ANALISE_RELATORIOS_E_SUGESTOES.md` | Análise de bibliotecas PDF (referência) |
| `_docx_extract/` | Textos extraídos dos docs de revisão 26/08 |
| Docs de revisão (`.docx`) | Viewer, AdminCliente, análises teste/Hydro |

---

## 11. Correções dos documentos de revisão — status

### `1. Telas Usuário - viewer - revisao 26.08.docx`

| Item | Status |
|------|--------|
| Dashboard, participantes, filtros, histórico de envio | ✅ OK (já funcionava) |
| Relatórios via projeto, PDF individual | ✅ OK |
| Tour, seletor de idioma | ✅ OK |

### `2. Telas Usuário - AdminCliente revisao 26.08.docx`

| Item | Status |
|------|--------|
| Usuários, Competências, Formulários bloqueados | ✅ OK |
| Modelos de e-mail, Lembretes (com cliente vinculado) | ✅ OK |

### `a. Analise_teste avaliado_Relatório Feedback 360.docx`

| Item | Status |
|------|--------|
| Resumo ↔ Tabela ↔ Barras ↔ Johari ↔ Defasagem (antes) | ✅ OK |
| **Inconsistência 1 — coluna sem auto no ranking** | ✅ **Corrigido** (cálculo de médias) |
| **Inconsistência 2 — desempate Top/Bottom** | ✅ **Mitigado** (sort + exclusão mútua) |
| **Autoavaliação errada no ranking** | ✅ **Corrigido** (coluna = auto real) |

### `b. Analise_Eliwelton Batista_Relatório Feedback 360_Hydro.docx`

| Item | Status |
|------|--------|
| Médias por grupo (Resumo, barras, tabela) | ✅ OK |
| **Achado 1 — duas fórmulas de Demais Avaliadores** | ✅ **Corrigido** |
| **Achado 2 — rótulo "Pontuação do(a) Avaliado(a)"** | ✅ **Corrigido** |
| Ranking ordenação / desempate | ✅ OK (no relatório Hydro original) + melhorias no código |
| Mapeamento comportamento → competência | ✅ OK no Hydro |

---

## Commits de referência (ordem recente → antiga)

```
db90c99  Relatórios feedback 360 + análises + templates + i18n
35c2811  Template obrigatório no projeto + biblioteca de templates
f1e7d5f  Auditoria i18n + scripts EN/ES + loading
3983352  Defasagem: "Demais Avaliadores"
2349c77  Gráficos de pizza — legenda e export
945a41a  Normalização de títulos / strip resíduos
a6bcc3f  Normalização de seções relatório 360
8b50fd1  DOCX export + CSS relatórios
b1343f6  Notificação relatório finalizado + e-mails
9a71bf2  Tour participantes/competências + i18n
fd7c1c0  Johari: "Demais Avaliadores"
dc24087  Ranking: "Pontuação do(a) Avaliado(a)"
19baf6e  Status notificação usuários + i18n
0abb98e  Tour overlay i18n
287545f  "Avaliação" → "Formulário"
```

---

*Última atualização: 03/09/2026 — consolidado a partir dos commits, sessões de desenvolvimento e documentos de revisão 26/08.*
