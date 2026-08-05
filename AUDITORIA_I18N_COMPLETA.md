# Auditoria i18n — ECK Angular App

**Data:** 2026-07-27
**Escopo:** Varredura completa de todos os textos exibidos ao usuário
**Biblioteca i18n:** `@ngx-translate/core`

---

## Sumário Executivo

| Severidade  | Categoria                                                                        | Ocorrências                                          |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 🔴 CRÍTICO | `toast.service.ts` — botão "Fechar" hardcoded (afeta 100% dos toasts)        | 1 arquivo                                             |
| 🔴 CRÍTICO | `snackBar.open()` com strings hardcoded em PT/EN                               | **+160 chamadas** em **22 arquivos**      |
| 🔴 CRÍTICO | `alert()` / `confirm()` nativos do navegador (não localizados)              | 3 ocorrências                                        |
| 🟠 ALTO     | Templates HTML com texto hardcoded (placeholders, labels, spans, matTooltip)     | **400+ ocorrências** em **30+ arquivos** |
| 🟠 ALTO     | Template literals construindo mensagens em português sem`translate.instant()` | **58 ocorrências** em 16 arquivos              |
| 🟡 MÉDIO   | Arquitetura de chaves: 95% usa frases completas como chave (não dot-notation)   | 1.141 de 1.198 chaves                                 |
| 🟡 MÉDIO   | `es.json`: 56 chaves com valores em inglês (deveria ser espanhol)             | 56 chaves                                             |
| 🟡 MÉDIO   | `pt-BR.json`: ~380 chaves com valor `self-equal` (inglês não traduzido)    | ~380 chaves                                           |

---

## 1. CRÍTICO — `toast.service.ts`

**Arquivo:** `src/app/services/toast.service.ts`

```typescript
// ❌ PROBLEMA — botão de fechar hardcoded em português
private readonly ACTION = 'Fechar';
```

**Impacto:** Afeta 100% das notificações do sistema em todos os idiomas. Usuários em EN/ES/DE/FR sempre verão "Fechar" em PT-BR.

**Correção:**

```typescript
// ✅ CORREÇÃO — injetar TranslateService e usar no show()
constructor(private snackBar: MatSnackBar, private translate: TranslateService) {}

private show(message: string, type: string, duration: number) {
  this.snackBar.open(message, this.translate.instant('common.close'), {
    duration,
    panelClass: ['app-toast', `app-toast--${type.replace('toast-', '')}`],
    horizontalPosition: 'right',
    verticalPosition: 'top',
  });
}
```

Adicionar ao arquivo de tradução:

```json
{ "common": { "close": "Fechar" } }
```

---

## 2. CRÍTICO — `alert()` e `confirm()` nativos

Três chamadas usam APIs do navegador que nunca são traduzidas e são inconsistentes com o design system.

| Arquivo                                                                    | Linha | Código                                                          |
| -------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| `pages/apps/contact/contact.component.ts`                                | 142   | `alert('Please enter only digits.')` — em inglês             |
| `pages/ui-components/slide-toggle/slide-toggle.component.ts`             | 31    | `alert(JSON.stringify(...))` — debug, deve ser removido       |
| `pages/reports/report-builder-visual/report-builder-visual.component.ts` | 719   | `confirm('Tem certeza que deseja remover todas as seções?')` |

**Correção do `confirm()` em `report-builder-visual`:**

```typescript
// ✅ Substituir native confirm() pelo ConfirmDialogService
import { ConfirmDialogService } from 'src/app/shared/confirm-dialog/confirm-dialog.service';

this.confirmDialog.open({
  title: this.translate.instant('report.sections.remove_all.title'),
  message: this.translate.instant('report.sections.remove_all.confirm')
}).subscribe(confirmed => { if (confirmed) { /* remover seções */ } });
```

---

## 3. CRÍTICO — `snackBar.open()` com strings hardcoded

### Arquivos com mais ocorrências

#### `pages/assessments/participants/participants.component.ts` — ~40 chamadas hardcoded

```typescript
// ❌ Exemplos problemáticos:
this.snackBar.open('Você não tem permissão para esta ação.', 'Fechar', { duration: 4000 });
this.snackBar.open('Erro ao carregar clientes.', 'Fechar', { duration: 3000 });
this.snackBar.open('Créditos insuficientes para importar o avaliado.', 'Fechar', { duration: 6000 });
this.snackBar.open('Participante atualizado com sucesso!', 'Fechar', { duration: 2500 });
this.snackBar.open('E-mail inválido.', 'Fechar', { duration: 4000 });
this.snackBar.open('Nenhum participante válido encontrado na planilha.', 'Fechar', { duration: 3000 });
this.snackBar.open('Projeto adicionado ao acesso do visualizador existente.', 'Fechar', { duration: 3000 });
this.snackBar.open('Este participante já possui acesso como visualizador.', 'Fechar', { duration: 3000 });
// ... +32 outras chamadas
```

#### `pages/project/project-detail/project-detail.component.ts` — 10 chamadas hardcoded

```typescript
this.snackBar.open('Erro ao obter dados do usuário.', 'Fechar', { duration: 3000 });
this.snackBar.open('Erro ao carregar clientes.', 'Fechar', { duration: 3000 });
this.snackBar.open('Projeto não encontrado!', 'Fechar', { duration: 3000 });
this.snackBar.open('Preencha todos os campos obrigatórios!', 'Fechar', { duration: 3000 });
this.snackBar.open('O prazo de preenchimento não pode ser uma data anterior a hoje.', 'Fechar', { duration: 3000 });
this.snackBar.open('Projeto concluído com sucesso! 1 crédito debitado.', 'Fechar', { duration: 4000 });
// ... +4 outras
```

#### `pages/project/participants-modal/participants-modal.component.ts` — 8 chamadas

```typescript
this.snackBar.open('Nenhum clientId fornecido.', 'Fechar', { duration: 3000 });
this.snackBar.open('Nenhum envio pendente encontrado.', 'Fechar', { duration: 3000 });
this.snackBar.open('Envio cancelado.', 'Fechar', { duration: 3000 });
this.snackBar.open('Créditos insuficientes para importar o avaliado.', 'Fechar', { duration: 6000 });
this.snackBar.open('Upload e salvamento concluídos!', 'Fechar', { duration: 3000 });
this.snackBar.open('Selecione um Formulário (Avaliação) para gerar o relatório.', 'Fechar', { duration: 3000 });
// ...
```

#### `pages/assessments/assessment-list/assessment-list.component.ts` — 9 chamadas

```typescript
this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', { duration: 3000 });
this.snackBar.open('Erro ao carregar clientes.', 'Fechar', { duration: 3000 });
this.snackBar.open('Avaliação excluída com sucesso.', 'Fechar', { duration: 3000 });
this.snackBar.open('Modelo de e-mail não encontrado.', 'Fechar', { duration: 3000 });
// ...
```

#### `pages/assessments/participants/evaluators-modal/evaluators-modal.component.ts` — 7 chamadas

```typescript
this.snackBar.open('Avaliações adicionadas com sucesso!', 'Fechar', { duration: 3000 });
this.snackBar.open('Link de avaliação enviado com sucesso!', 'Fechar', { duration: 3000 });
this.snackBar.open('Avaliação removida com sucesso!', 'Fechar', { duration: 3000 });
// ...
```

#### `pages/project/email-template-list/email-template-list.component.ts` — 7 chamadas

```typescript
this.snackBar.open('Template duplicado com sucesso!', 'Fechar', { duration: 3000 });
this.snackBar.open('Template excluído com sucesso!', 'Fechar', { duration: 3000 });
this.snackBar.open('Erro ao carregar templates.', 'Fechar', { duration: 3000 });
// ...
```

#### `pages/settings/reminder-settings/reminder-settings.component.ts` — 9 chamadas

```typescript
// Nota: alguns sem acentos (bug adicional)
this.snackBar.open('Selecione um cliente e um projeto para salvar as configuracoes.', 'Fechar', ...);
this.snackBar.open('Informe um horario valido no formato HH:mm.', 'Fechar', ...);
this.snackBar.open('Configuracoes de lembrete salvas com sucesso.', 'Fechar', ...);
```

#### `pages/assessments/create-assessment/create-assessment.component.ts` — 9 chamadas

```typescript
this.snackBar.open('Formulário atualizado com sucesso!', 'Fechar', { duration: 3000 });
this.snackBar.open('Formulário criado com sucesso!', 'Fechar', { duration: 3000 });
this.snackBar.open('Erro ao salvar. Tente novamente.', 'Fechar', { duration: 3000 });
// ...
```

#### `pages/competencies/create-question-dialog/create-question-dialog.component.ts` — 7 chamadas

```typescript
this.snackBar.open('Preencha todos os campos obrigatórios', 'Fechar', { duration: 3000 });
this.snackBar.open('Pergunta criada e adicionada à avaliação com sucesso!', 'Fechar', { duration: 3000 });
// ...
```

#### Outros arquivos com chamadas hardcoded

| Arquivo                                         | Ocorrências |
| ----------------------------------------------- | ------------ |
| `project/add-participant-modal/`              | 4            |
| `project/email-template-form/`                | 4            |
| `project/questionnaire-form/`                 | 4            |
| `project/report-generation-modal/`            | 3            |
| `competencies/competencies.component.ts`      | 4            |
| `competencies/competency-dialog.component.ts` | 4            |
| `assessments/dashboard.component.ts`          | 4            |
| `assessments/assessment-preview.component.ts` | 2            |
| `assessments/send-assessment-modal/`          | 4            |
| `assessments/participant-responses-modal/`    | 1            |
| `project/project-users.component.ts`          | 2            |
| `users/users.component.ts`                    | 1            |
| `reports/reports.component.ts`                | 2            |

### Padrão de correção para snackBar

```typescript
// ❌ ANTES
this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', { duration: 3000 });

// ✅ DEPOIS — opção A: usar ToastService (já injetado na maioria dos arquivos)
this.toast.error(this.translate.instant('assessment.load_error'));

// ✅ DEPOIS — opção B: se snackBar direto for necessário
this.snackBar.open(
  this.translate.instant('assessment.load_error'),
  this.translate.instant('common.close'),
  { duration: 3000 }
);
```

---

## 4. ALTO — Templates HTML com texto hardcoded

### `pages/competencies/competencies.component.html` — 30+ textos hardcoded

```html
<!-- ❌ PROBLEMAS -->
<span class="step-node__title">Cliente</span>
<span class="step-node__title">Grupo</span>
<span class="step-node__title">Avaliação <span class="step-node__optional-tag">opcional</span></span>
<span class="step-node__title">Competências</span>
<span>Cliente</span>
<span>Grupos</span>
<mat-icon>add</mat-icon> Criar primeiro grupo
<span>Selecione o <strong>cliente</strong></span>
<span>Crie ou selecione um <strong>grupo</strong></span>
<span>Adicione as <strong>competências</strong></span>
<span>Salve o <strong>grupo</strong></span>
<mat-option [value]="''">Nenhuma</mat-option>
<span class="coverage-strip__label">Vinculáveis</span>
<span class="coverage-strip__label">Vinculadas</span>
<mat-icon>edit</mat-icon> Editar e vincular
```

Placeholders hardcoded:

```html
<input ... placeholder="Buscar cliente..." />
<input ... placeholder="Ex: Liderança Executiva" />
<input ... placeholder="Ex: Liderança, Comunicação..." />
<textarea ... placeholder="Descreva brevemente esta competência..."></textarea>
```

matTooltips hardcoded:

```html
<button matTooltip="Criar novo grupo">
```

### `pages/assessments/participants/participants.component.html` — 20+ textos

```html
<!-- ❌ PROBLEMAS -->
<span class="credit-item__label">Disponíveis</span>
<span class="credit-item__label">Reservados</span>
<span class="credit-item__label">Consumidos</span>
```

### `pages/project/projects-list/projects-list.component.html`

```html
<!-- ❌ PROBLEMAS -->
<span class="col-header">Projeto</span>   <!-- usa | translate em alguns, não em outros -->
<span class="col-header">Prazo</span>
<!-- placeholder hardcoded: -->
<input placeholder="Nome do projeto..." />
<input placeholder="Buscar cliente..." />
```

### `pages/project/email-template-list/email-template-list.component.html`

```html
<!-- ❌ PROBLEMAS -->
<span class="col-header">Assunto</span>
<input placeholder="Nome ou assunto..." />
```

### `pages/project/project-export-dialog/project-export-dialog.component.html`

```html
<!-- ❌ PROBLEMAS — frases completas hardcoded -->
<button>Cancelar</button>
<mat-label>Template</mat-label>
```

### `pages/project/users-list-by-group/users-list-by-group.component.html`

```html
<!-- ❌ PROBLEMAS -->
<mat-label>Buscar</mat-label>
<input placeholder="Busque por nome ou e-mail" />
<th mat-header-cell>Nome</th>
<button mat-dialog-close>Fechar</button>
```

### `pages/project/questionnaire-list/*.html`

```html
<mat-label>Nome</mat-label>
<input placeholder="Digite o nome" />
<mat-label>Buscar</mat-label>
<th mat-header-cell>Nome</th>
<th mat-header-cell>Ações</th>
```

### `pages/project/email-selection-dialog/email-selection-dialog.component.html`

```html
<mat-option value="">Todos</mat-option>
<mat-option value="true">Sim</mat-option>
<mat-option value="false">Não</mat-option>
```

### `pages/assessments/participants/edit-participant-dialog/edit-participant-dialog.component.html`

```html
<mat-label>Nome</mat-label>
<input placeholder="Nome completo" />
<input placeholder="email@exemplo.com" />
<mat-label>Categoria</mat-label>
<mat-option value="Gestor">Gestor</mat-option>
<mat-option value="Par">Par</mat-option>
<mat-option value="Subordinado">Subordinado</mat-option>
```

### `pages/assessments/participants/evaluators-modal/evaluators-modal.component.html`

```html
<th mat-header-cell>Nome</th>
<th mat-header-cell>Status</th>
<th mat-header-cell>Respondida</th>
```

### `pages/assessments/create-assessment/create-assessment.component.html`

```html
<label>Título do Formulário<span class="req">*</span></label>
<input placeholder="Ex: Avaliação de Liderança 2026" />
<label>Descrição</label>
<input placeholder="Opcional — descreva o objetivo desta avaliação" />
<label>Cliente<span class="req">*</span></label>
<span>Misturar</span>
<input placeholder="Nome da nova lista" />
```

### `pages/assessments/participants/send-history-dialog/send-history-dialog.component.html`

```html
<span class="shd-stat__label">Categoria</span>
<span class="shd-stat__label">Status</span>
```

### `pages/assessments/participants/participants-confirmation-dialog/participants-confirmation-dialog.component.html`

```html
<mat-label>Cliente</mat-label>
<mat-label>Projeto</mat-label>
<span class="pcd__required">obrigatório</span>
<th mat-header-cell>Nome</th>
```

### `pages/settings/reminder-settings/reminder-settings.component.html`

```html
<mat-label>Cliente</mat-label>
<mat-label>Projeto</mat-label>
<span class="rs-project-chip__label">Configurando</span>
<span>Agendamento</span>
<span matSuffix class="rs-suffix">dias</span>
<mat-icon>work</mat-icon> Dias úteis
<mat-icon>mail</mat-icon> Template padrão
<mat-icon>person</mat-icon> Para avaliados
<mat-icon>people</mat-icon> Para avaliadores
<div class="rs-run-stat__lbl">Enviados</div>
<div class="rs-run-stat__lbl">Pulados</div>
<div class="rs-run-stat__lbl">Erros</div>
<input placeholder="Buscar cliente..." />
```

### `pages/reports/reports.component.html` — muitos textos

```html
<mat-label>Cliente</mat-label>
<mat-label>Avaliado</mat-label>
<span class="rp-project-badge__label">Projeto</span>
<span class="rp-avaliado-badge__label">Avaliado</span>
<strong>Montar</strong>
<strong>Visualizar</strong>
<input placeholder="Avaliação carregada automaticamente" />
<input placeholder="Ex: Relatório João Silva" />
<input placeholder="Buscar cliente..." />
vinculando as perguntas do formulário, e clique em <strong>Salvar</strong>.
<mat-option value="capa">Capa</mat-option>
```

### `pages/reports/report-builder-visual/report-builder-visual.component.html`

```html
<h3>Componentes</h3>
<input placeholder="Digite o título...">
<mat-option value="capa">Capa</mat-option>
<mat-option value="graficos">Gráficos</mat-option>
<mat-option value="destaques">Destaques</mat-option>
<p class="palette-picker__group">Gradientes</p>
<p class="palette-picker__group">Especiais</p>
```

### `pages/reports/charts/gap-chart/gap-chart.component.html`

```html
<div class="score-header">Outros</div>
```

### `pages/reports/charts/johari-window-chart/johari-window-chart.component.html`

```html
<th>Comportamentos</th>
```

### `pages/reports/client-export-dialog/client-export-dialog.component.html`

```html
Gera um arquivo Excel com abas <strong>Resumo</strong> e <strong>Respostas</strong>...
<mat-label>Cliente</mat-label>
```

### `pages/project/project-detail/project-detail.component.html`

```html
<input placeholder="DD/MM/AAAA" />
```

### Padrão de correção para templates HTML

```html
<!-- ❌ ANTES -->
<span class="step-node__title">Cliente</span>
<input placeholder="Buscar cliente..." />
<button matTooltip="Criar novo grupo">

<!-- ✅ DEPOIS -->
<span class="step-node__title">{{ 'competency.step.client' | translate }}</span>
<input [placeholder]="'common.search_client' | translate" />
<button [matTooltip]="'competency.group.create_tooltip' | translate">
```

---

## 5. ALTO — Template Literals com texto português

**58 ocorrências em 16 arquivos** — strings construídas dinamicamente sem `translate.instant()`:

```typescript
// ❌ Exemplos de padrões problemáticos
`Grupo "${group.name}" selecionado com ${competencyIds.length} competências`
`${count} participantes selecionados`
`Erro ao processar linha ${i + 1}`
`Avaliado: ${participant.name}`
```

**Correção:**

```typescript
// ✅ DEPOIS — com interpolação do ngx-translate
this.translate.instant('competency.group.selected', {
  name: group.name,
  count: competencyIds.length
})
// Em pt-BR.json: "competency.group.selected": "Grupo \"{{name}}\" selecionado com {{count}} competências"
```

---

## 6. MÉDIO — Arquitetura das Chaves de Tradução

### Problema crítico de estrutura

**1.198 total de chaves** em cada arquivo de idioma:

- **1.141 chaves (95%)** usam frases completas como chave
- **57 chaves (5%)** usam dot-notation correta

#### Exemplos do problema

```json
// ❌ CHAVE = VALOR (pt-BR.json) — padrão anti-i18n
"A descrição é obrigatória": "A descrição é obrigatória",
"Erro ao carregar a lista de clientes. Tente novamente mais tarde.": "Erro ao carregar a lista de clientes. Tente novamente mais tarde.",
"Cliente atualizado com sucesso!": "Cliente atualizado com sucesso!",

// ✅ CORRETO — dot-notation
"paginator.firstPage": "Primeira página",
"kpi.clientes_ativos": "Clientes Ativos",
"perm.master.intro": "..."
```

#### Consequências

1. O `MissingTranslationHandler` retorna a chave como fallback — que **parece** funcionar em PT-BR, mascarando que traduções estão faltando em EN/ES/DE/FR
2. `en.json` com chave `"Erro ao carregar avaliações."` → valor `"Erro ao carregar avaliações."` — usuário anglófono vê PT-BR
3. Manutenção impossível: alterar o texto em PT exige alterar a chave em todos os 5 arquivos + em todos os componentes TypeScript/HTML

### Estado atual dos arquivos de idioma

| Arquivo        | Total chaves | Self-equal (sem tradução)   | Problema                                                        |
| -------------- | ------------ | ----------------------------- | --------------------------------------------------------------- |
| `pt-BR.json` | 1.198        | ~380 (inglês não traduzido) | 95% sem dot-notation                                            |
| `en.json`    | 1.198        | ~311 (English OK)             | 16 chaves PT não traduzidas                                    |
| `es.json`    | 1.198        | ~204                          | **56 chaves com valor em inglês** (deveria ser espanhol) |
| `de.json`    | 1.198        | N/A                           | Não auditado                                                   |
| `fr.json`    | 1.198        | N/A                           | Não auditado                                                   |

### `es.json` — 56 chaves com valor em inglês (exemplos)

```json
"Admin Cliente": "Client Admin",       // ❌ deveria ser "Administrador de cliente"
"Aviso": "Warning",                    // ❌ deveria ser "Aviso"
"Buscar cliente...": "Search client...",
"Carregando dados do projeto...": "Loading project data..."
```

---

## 7. Problemas Específicos Encontrados

### `reminder-settings.component.ts` — strings sem acentuação

```typescript
// ❌ Bug adicional: strings sem acento (podem ter sido inseridas sem encode correto)
this.snackBar.open('Selecione um cliente e um projeto para salvar as configuracoes.', ...);
this.snackBar.open('Informe um horario valido no formato HH:mm.', ...);
this.snackBar.open('Informe um timezone valido (ex.: America/Fortaleza).', ...);
this.snackBar.open('Nao foi possivel carregar os clientes.', ...);
```

Além de não serem traduzidas, estão com erros de acentuação.

### `users.component.html` — uso inconsistente do pipe `| translate`

Algumas colunas usam `| translate`, outras não:

```html
{{ 'Todos' | translate }}       <!-- ✅ usa translate, mas chave é palavra em PT -->
{{ 'Bloqueados' | translate }}  <!-- ✅ usa translate -->
<span class="col-header">{{ 'Usuário' | translate }}</span>   <!-- ✅ -->
<!-- mas no mesmo arquivo: -->
```

### `page-header` component — atributos hardcoded em uso

```html
<!-- Em competencies.component.html -->
<app-page-header
  eyebrow="Definições"
  title="Gerenciar Competências"
  subtitle="Configure grupos de competências e vincule perguntas...">
</app-page-header>
```

Atributos de texto passados como strings hardcoded (não como binding `[title]="'key' | translate"`).

---

## 8. Plano de Correção por Prioridade

### Fase 1 — IMEDIATA (1-2 dias)

#### 1.1 Corrigir `toast.service.ts`

Arquivo único, impacto máximo:

```typescript
// src/app/services/toast.service.ts
import { TranslateService } from '@ngx-translate/core';

constructor(private snackBar: MatSnackBar, private translate: TranslateService) {}

private show(message: string, type: string, duration: number) {
  this.snackBar.open(message, this.translate.instant('common.close'), { ... });
}
```

#### 1.2 Adicionar chave `common.close` em todos os arquivos i18n

```json
// pt-BR.json, en.json, es.json, de.json, fr.json
{ "common": { "close": "Fechar" } }   // PT
{ "common": { "close": "Close" } }    // EN
{ "common": { "close": "Cerrar" } }   // ES
{ "common": { "close": "Schließen" } } // DE
{ "common": { "close": "Fermer" } }   // FR
```

#### 1.3 Remover `alert()` / `confirm()` nativos

- `contact.component.ts:142` — substituir por `MatSnackBar` com tradução
- `slide-toggle.component.ts:31` — remover (debug code)
- `report-builder-visual.component.ts:719` — substituir por `ConfirmDialogService`

### Fase 2 — CURTO PRAZO (1 semana)

#### 2.1 Criar helper centralizado para snackBar

Ao invés de corrigir 160+ chamadas individualmente, criar um método reutilizável:

```typescript
// src/app/services/notification.service.ts (novo serviço ou expandir toast.service.ts)
showSuccess(key: string, params?: object) {
  this.toast.success(this.translate.instant(key, params));
}
showError(key: string, params?: object) {
  this.toast.error(this.translate.instant(key, params));
}
```

#### 2.2 Migrar snackBar por módulo (ordem sugerida)

1. `participants.component.ts` (~40 calls) — maior impacto
2. `project-detail.component.ts` (10 calls)
3. `assessment-list.component.ts` (9 calls)
4. `create-assessment.component.ts` (9 calls)
5. `reminder-settings.component.ts` (9 calls) — + corrigir erros de acentuação
6. Demais arquivos

#### 2.3 Corrigir `es.json` — 56 chaves com valor em inglês

Traduzir as 56 chaves identificadas para espanhol correto.

### Fase 3 — MÉDIO PRAZO (2-4 semanas)

#### 3.1 Corrigir templates HTML

Por ordem de visibilidade ao usuário:

1. `reports.component.html`
2. `participants.component.html`
3. `competencies.component.html`
4. `project-detail.component.html`
5. Demais pages/

#### 3.2 Corrigir template literals

Migrar as 58 ocorrências usando interpolação do ngx-translate:

```typescript
// ❌
`${count} participantes selecionados`
// ✅
this.translate.instant('participants.count_selected', { count })
```

### Fase 4 — LONGO PRAZO (Sprint dedicada)

#### 4.1 Migração de arquitetura de chaves

Esta é a raiz do problema. Migrar de frases-como-chave para dot-notation:

**Estratégia recomendada (incremental):**

1. Manter chaves atuais como estão para não quebrar nada
2. Novas strings SEMPRE em dot-notation
3. Ao tocar em um componente, migrar suas chaves antigas
4. Após migração completa de um módulo, remover chaves antigas

**Exemplo de estrutura alvo:**

```json
{
  "common": {
    "close": "Fechar",
    "save": "Salvar",
    "cancel": "Cancelar",
    "search": "Buscar",
    "error": {
      "generic": "Ocorreu um erro. Tente novamente.",
      "load": "Erro ao carregar {{resource}}.",
      "save": "Erro ao salvar. Tente novamente."
    },
    "success": {
      "save": "{{resource}} salvo com sucesso!",
      "delete": "{{resource}} excluído com sucesso!"
    }
  },
  "assessment": {
    "load_error": "Erro ao carregar avaliações.",
    "delete_success": "Avaliação excluída com sucesso."
  },
  "participant": {
    "update_success": "Participante atualizado com sucesso!",
    "invalid_email": "E-mail inválido.",
    "insufficient_credits": "Créditos insuficientes para importar o avaliado."
  }
}
```

---

## 9. Checklist de Verificação por Arquivo

### Arquivos para correção imediata (Fase 1-2)

- [ ] `src/app/services/toast.service.ts` — ACTION hardcoded
- [ ] `src/app/pages/assessments/participants/participants.component.ts` — ~40 snackBar
- [ ] `src/app/pages/project/project-detail/project-detail.component.ts` — 10 snackBar
- [ ] `src/app/pages/project/participants-modal/participants-modal.component.ts` — 8 snackBar
- [ ] `src/app/pages/assessments/assessment-list/assessment-list.component.ts` — 9 snackBar
- [ ] `src/app/pages/assessments/create-assessment/create-assessment.component.ts` — 9 snackBar
- [ ] `src/app/pages/settings/reminder-settings/reminder-settings.component.ts` — 9 snackBar + erros de acento
- [ ] `src/app/pages/assessments/participants/evaluators-modal/evaluators-modal.component.ts` — 7 snackBar
- [ ] `src/app/pages/project/email-template-list/email-template-list.component.ts` — 7 snackBar
- [ ] `src/app/pages/competencies/create-question-dialog/create-question-dialog.component.ts` — 7 snackBar
- [ ] `src/app/pages/project/email-template-list/email-template-form/email-template-form.component.ts` — 4 snackBar
- [ ] `src/app/pages/project/add-participant-modal/add-participant-modal.component.ts` — 4 snackBar
- [ ] `src/app/pages/project/questionnaire-list/questionnaire-form/questionnaire-form.component.ts` — 4 snackBar
- [ ] `src/app/pages/assessments/dashboard/dashboard.component.ts` — 4 snackBar
- [ ] `src/app/pages/competencies/competencies.component.ts` — 4 snackBar
- [ ] `src/app/pages/competencies/competency-dialog/competency-dialog.component.ts` — 4 snackBar
- [ ] `src/app/pages/assessments/assessment-list/send-assessment-modal/send-assessment-modal.component.ts` — 4 snackBar
- [ ] `src/app/pages/project/report-generation-modal/report-generation-modal.component.ts` — 3 snackBar
- [ ] `src/app/pages/assessments/assessment-preview/assessment-preview.component.ts` — 2 snackBar
- [ ] `src/app/pages/project/project-users/project-users.component.ts` — 2 snackBar
- [ ] `src/app/pages/reports/reports.component.ts` — 2 snackBar (parcial)
- [ ] `src/app/pages/users/users.component.ts` — 1 snackBar
- [ ] `src/app/pages/assessments/participants/participants.component.ts` — 1 snackBar (participant-responses-modal)
- [ ] `src/app/pages/apps/contact/contact.component.ts` — alert() nativo em inglês
- [ ] `src/app/pages/ui-components/slide-toggle/slide-toggle.component.ts` — alert() debug
- [ ] `src/app/pages/reports/report-builder-visual/report-builder-visual.component.ts` — confirm() nativo

### Arquivos i18n para correção (Fase 2-4)

- [ ] `src/assets/i18n/es.json` — 56 chaves com valor em inglês
- [ ] `src/assets/i18n/pt-BR.json` — ~380 self-equal keys com inglês
- [ ] `src/assets/i18n/en.json` — 16 chaves PT não traduzidas
- [ ] Todos os arquivos — adicionar `common.close` e outras chaves comuns

---

## 10. Resumo de Métricas

| Métrica                                        | Valor                     |
| ----------------------------------------------- | ------------------------- |
| Arquivos TypeScript com snackBar hardcoded      | **22 arquivos**     |
| Total de chamadas snackBar hardcoded            | **~160 chamadas**   |
| Arquivos HTML com texto hardcoded               | **30+ arquivos**    |
| Total placeholders hardcoded                    | **60+**             |
| Total matTooltips hardcoded (pages de negócio) | **20+**             |
| Template literals com PT hardcoded              | **58 ocorrências** |
| Chaves i18n sem dot-notation                    | **1.141 (95%)**     |
| Chaves em es.json com valor em inglês          | **56**              |
| Chamadas alert()/confirm() nativas              | **3**               |

---

*Gerado por auditoria automatizada em 2026-07-27*
