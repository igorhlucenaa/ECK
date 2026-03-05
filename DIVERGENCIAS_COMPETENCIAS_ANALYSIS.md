# Análise de Divergências: /reports vs /competencies

## 📋 Resumo Executivo

O cadastro de competências funciona corretamente em `/reports` mas apresenta problemas em `/competencies`. Esta análise identifica as principais divergências entre as duas implementações.

---

## 🔍 Divergências Identificadas

### 1. **Abordagem de Formulários**

#### ✅ REPORTS (Funcionando)
```typescript
// reports.component.ts (linha 558-562)
this.competenciaForm = this.fb.group({
  nome: ['', Validators.required],
  descricao: ['', Validators.required],
  perguntasIds: [[] as string[], Validators.required]
});
```

```html
<!-- reports.component.html (linha 269) -->
<mat-select formControlName="perguntasIds" multiple>
```

**✅ Usa Reactive Forms com FormBuilder e validação integrada**

---

#### ❌ COMPETENCIES (Com problemas)
```typescript
// competencies.component.ts (linha 74)
competenciaEditando: Competencia = { id: '', nome: '', descricao: '', perguntasIds: [] };
```

```html
<!-- competencies.component.html (linha 190) -->
<mat-select [(value)]="competenciaEditando.perguntasIds" multiple>
```

**❌ Usa two-way binding direto sem FormGroup**

---

### 2. **Fonte de Dados para Perguntas no Select**

#### ✅ REPORTS
```html
<!-- linha 270 -->
<mat-option *ngFor="let q of dynamicColumns" [value]="q">
```

```typescript
// linha 1047
this.dynamicColumns = this.filteredQuestions.map(q => q.id);
```

**✅ Usa array de IDs (dynamicColumns) sincronizado com filteredQuestions**

---

#### ❌ COMPETENCIES
```html
<!-- linha 191 -->
<mat-option *ngFor="let question of filteredQuestions" [value]="question.id">
```

**❌ Usa objetos completos mas vincula apenas o ID**

---

### 3. **Controle do Filtro de Perguntas**

#### ✅ REPORTS
```typescript
// linha 348
includeOpenQuestions = new FormControl(false);

// linha 710-712
this.includeOpenQuestions.valueChanges.subscribe(() => {
  this.onQuestionFilterChange();
});

// linha 3827-3836
onQuestionFilterChange(): void {
  this.applyQuestionFilter();
  this.dynamicColumns = this.filteredQuestions.map(q => q.id);
  this.cdr.detectChanges();
}
```

**✅ Usa FormControl com listener reativo que atualiza dynamicColumns**

---

#### ❌ COMPETENCIES
```typescript
// linha 79
includeOpenQuestions: boolean = true;

// linha 291-298
filterQuestions(): void {
  this.filteredQuestions = this.allQuestions.filter(q => {
    if (!this.includeOpenQuestions) {
      return !['text', 'comment', 'file'].includes(q.type);
    }
    return true;
  });
}
```

**❌ Usa boolean simples sem sincronização automática**

---

### 4. **Validação do Formulário**

#### ✅ REPORTS
```typescript
// linha 1289-1290
salvarCompetencia() {
  if (this.competenciaForm.invalid) return;
  const formValue = this.competenciaForm.value;
```

```html
<!-- linha 284 -->
<button type="submit" [disabled]="!competenciaForm.valid">
```

**✅ Validação integrada do Angular Reactive Forms**

---

#### ❌ COMPETENCIES
```typescript
// linha 366-371
isValidCompetenciaForm(): boolean {
  return !!(this.competenciaEditando.nome &&
            this.competenciaEditando.descricao &&
            this.competenciaEditando.perguntasIds &&
            this.competenciaEditando.perguntasIds.length > 0);
}
```

```html
<!-- linha 201 -->
<button [disabled]="!isValidCompetenciaForm()">
```

**❌ Validação manual sem integração com formulário**

---

### 5. **Edição de Competências**

#### ✅ REPORTS
```typescript
// linha 1316-1324
editarCompetencia(c: Competencia) {
  this.competenciaEditando = { ...c };
  this.competenciaForm.setValue({
    nome: c.nome,
    descricao: c.descricao,
    perguntasIds: c.perguntasIds
  });
  this.atualizarPerguntasBloqueadas();
}
```

**✅ Popula o FormGroup com setValue(), garantindo sincronização**

---

#### ❌ COMPETENCIES
```typescript
// linha 349-352
editarCompetencia(c: Competencia): void {
  this.competenciaEditando = { ...c };
  this.atualizarPerguntasBloqueadas();
}
```

**❌ Apenas copia o objeto sem sincronizar com controles de formulário**

---

### 6. **Cancelamento de Edição**

#### ✅ REPORTS
```typescript
// linha 1326-1330
cancelarEdicaoCompetencia() {
  this.competenciaEditando = { id: '', nome: '', descricao: '', perguntasIds: [] };
  this.competenciaForm.reset({ nome: '', descricao: '', perguntasIds: [] });
  this.atualizarPerguntasBloqueadas();
}
```

**✅ Reseta tanto o objeto quanto o FormGroup**

---

#### ❌ COMPETENCIES
```typescript
// linha 354-357
cancelarEdicaoCompetencia(): void {
  this.competenciaEditando = { id: '', nome: '', descricao: '', perguntasIds: [] };
  this.atualizarPerguntasBloqueadas();
}
```

**❌ Apenas reseta o objeto**

---

### 7. **Salvamento de Competências**

#### ✅ REPORTS
```typescript
// linha 1289-1314
salvarCompetencia() {
  if (this.competenciaForm.invalid) return;
  const formValue = this.competenciaForm.value;
  const idCompetenciaEditando = this.competenciaEditando.id;

  if (idCompetenciaEditando) {
    const idx = this.competencias.findIndex(c => c.id === idCompetenciaEditando);
    if (idx > -1) this.competencias[idx] = { ...this.competenciaEditando, ...formValue };
  } else {
    const nova: Competencia = {
      id: `comp_${new Date().getTime()}`,
      ...formValue
    };
    this.competencias.push(nova);
  }
  this.cancelarEdicaoCompetencia();
  this.atualizarPerguntasBloqueadas();
}
```

**✅ Usa valores do FormGroup e merge com competenciaEditando**

---

#### ❌ COMPETENCIES
```typescript
// linha 320-347
salvarCompetencia(): void {
  if (!this.isValidCompetenciaForm()) {
    this.snackBar.open('Preencha todos os campos obrigatórios', 'Fechar', { duration: 3000 });
    return;
  }

  const idCompetenciaEditando = this.competenciaEditando.id;

  if (idCompetenciaEditando) {
    const idx = this.groupCompetencies.findIndex(c => c.id === idCompetenciaEditando);
    if (idx > -1) {
      this.groupCompetencies[idx] = { ...this.competenciaEditando };
    }
  } else {
    const nova: Competencia = {
      ...this.competenciaEditando,
      id: `comp_${new Date().getTime()}`
    };
    this.groupCompetencies.push(nova);
  }
  this.cancelarEdicaoCompetencia();
  this.atualizarPerguntasBloqueadas();
}
```

**❌ Usa apenas competenciaEditando sem validação de formulário**

---

## 🎯 Problemas Causados pelas Divergências

### 1. **Perda de Sincronização**
- O two-way binding `[(value)]` pode não sincronizar corretamente com `competenciaEditando.perguntasIds`
- Mudanças no filtro não atualizam automaticamente as opções disponíveis

### 2. **Validação Inconsistente**
- Sem Reactive Forms, a validação é manual e propensa a erros
- Não há feedback visual integrado de campos inválidos

### 3. **Problemas de Referência**
- O binding pode criar referências incorretas entre objetos e IDs
- `filteredQuestions` contém objetos completos mas o `[value]` usa apenas IDs

### 4. **Falta de Reatividade**
- Mudanças no filtro `includeOpenQuestions` não disparam atualizações automáticas
- Não há `ChangeDetectorRef.detectChanges()` após mudanças críticas

---

## ✅ Soluções Recomendadas

### 1. **Migrar para Reactive Forms**
```typescript
// Adicionar no constructor
this.competenciaForm = this.fb.group({
  nome: ['', Validators.required],
  descricao: ['', Validators.required],
  perguntasIds: [[] as string[], Validators.required]
});
```

### 2. **Criar dynamicColumns**
```typescript
// Após carregar perguntas
this.dynamicColumns = this.filteredQuestions.map(q => q.id);
```

### 3. **Converter includeOpenQuestions para FormControl**
```typescript
includeOpenQuestions = new FormControl(false);

ngOnInit() {
  this.includeOpenQuestions.valueChanges.subscribe(() => {
    this.onQuestionFilterChange();
  });
}
```

### 4. **Atualizar HTML**
```html
<!-- Use formControlName em vez de [(value)] -->
<mat-select formControlName="perguntasIds" multiple>
  <mat-option *ngFor="let q of dynamicColumns" [value]="q">
    {{ questionMap[q] || q }}
  </mat-option>
</mat-select>
```

### 5. **Sincronizar Edição**
```typescript
editarCompetencia(c: Competencia): void {
  this.competenciaEditando = { ...c };
  this.competenciaForm.setValue({
    nome: c.nome,
    descricao: c.descricao,
    perguntasIds: c.perguntasIds
  });
  this.atualizarPerguntasBloqueadas();
}
```

### 6. **Adicionar ChangeDetection**
```typescript
// Injetar no constructor
constructor(
  // ... outros serviços
  private cdr: ChangeDetectorRef
) {}

// Usar após mudanças
onQuestionFilterChange(): void {
  this.applyQuestionFilter();
  this.dynamicColumns = this.filteredQuestions.map(q => q.id);
  this.cdr.detectChanges();
}
```

---

## 📊 Tabela Comparativa

| Aspecto | REPORTS ✅ | COMPETENCIES ❌ |
|---------|-----------|-----------------|
| **Formulário** | Reactive Forms | Two-way binding |
| **Validação** | Integrada | Manual |
| **Fonte de dados** | dynamicColumns (IDs) | filteredQuestions (objetos) |
| **Filtro** | FormControl reativo | Boolean simples |
| **Sincronização** | setValue() | Cópia direta |
| **ChangeDetection** | Explícita | Implícita |
| **Cancelamento** | Reset form + objeto | Apenas objeto |

---

## 🚀 Prioridade de Correções

1. **CRÍTICO**: Migrar para Reactive Forms
2. **ALTO**: Criar dynamicColumns para sincronização
3. **ALTO**: Converter includeOpenQuestions para FormControl
4. **MÉDIO**: Adicionar ChangeDetectorRef.detectChanges()
5. **MÉDIO**: Sincronizar edição com setValue()
6. **BAIXO**: Melhorar feedback visual de validação

---

## 📝 Notas Adicionais

- O componente REPORTS é mais robusto e segue as melhores práticas do Angular
- O componente COMPETENCIES mistura abordagens (reactive e template-driven)
- A falta de FormGroup em COMPETENCIES causa problemas de sincronização
- A iteração sobre objetos completos em vez de IDs causa inconsistência

---

**Conclusão**: O problema principal em `/competencies` é a falta de Reactive Forms e sincronização adequada entre o modelo de dados e a UI. Seguir o padrão implementado em `/reports` resolverá todos os problemas identificados.




