# Análise de Divergências: Criação de Competências `/competencies` vs `/reports`

## 📋 Resumo Executivo

O problema identificado é que competências criadas na rota `/competencies` não carregam corretamente quando acessadas a partir de uma avaliação, enquanto competências criadas na rota `/reports` funcionam perfeitamente. Esta análise identifica as principais diferenças estruturais e funcionais entre as duas implementações.

---

## 🔍 Principais Divergências Identificadas

### 1. **Estrutura de Dados das Competências**

#### ✅ `/reports` (Funcionando Corretamente)
```typescript
interface Competencia {
  id: string;
  nome: string;
  descricao: string;
  perguntasIds: string[];  // Array de IDs de perguntas da avaliação
}
```

**Estrutura salva no `competencyGroups`:**
```typescript
{
  name: string;
  clientId: string;
  assessmentId: string;  // ✅ VINCULADO À AVALIAÇÃO
  competencias: [
    {
      id: string;
      nome: string;
      descricao: string;
      perguntasIds: string[];  // IDs das perguntas da avaliação
    }
  ],
  createdAt: Date
}
```

#### ❌ `/competencies` (Com Problemas)
```typescript
interface Competency {
  id: string;
  name: string;
  description: string;
  clientId: string;
  questions: Question[];  // Array de objetos Question completos
  createdAt: Date;
  updatedAt: Date;
}
```

**Estrutura salva na coleção `competencies`:**
```typescript
{
  name: string;
  description: string;
  clientId: string;
  questions: [  // ❌ Objetos completos, não IDs
    {
      id: string;
      text: string;
      type: string;
      options: string[];
      required: boolean;
      order: number;
    }
  ],
  createdAt: Date;
  updatedAt: Date;
  // ❌ SEM assessmentId - não está vinculado a uma avaliação
}
```

**Problema:** Quando salva um grupo a partir de competências individuais, tenta converter para o formato do `/reports`, mas:
- As competências individuais não têm `assessmentId` associado
- Não há como mapear `questions` (objetos completos) para `perguntasIds` (IDs da avaliação)
- O mapeamento depende de uma avaliação selecionada no momento da criação do grupo

---

### 2. **Fluxo de Criação**

#### ✅ `/reports` - Fluxo Correto
```
1. Usuário seleciona uma AVALIAÇÃO (assessmentId)
   ↓
2. Sistema carrega perguntas da avaliação (questionMap)
   ↓
3. Usuário cria competências TEMPORARIAMENTE (array local)
   - Seleciona perguntas da avaliação atual
   - Usa perguntasIds diretamente
   ↓
4. Usuário salva grupo em competencyGroups
   - assessmentId é incluído no grupo
   - competencias têm perguntasIds corretos
   ↓
5. Ao carregar grupo posteriormente:
   - assessmentId é restaurado
   - Avaliação é selecionada automaticamente
   - perguntasIds são mapeados corretamente
```

#### ❌ `/competencies` - Fluxo Problemático
```
1. Usuário cria competência INDIVIDUAL
   - Cria perguntas custom (não vinculadas a avaliação)
   - Salva na coleção 'competencies' com estrutura Question[]
   ↓
2. Usuário tenta criar GRUPO a partir de competências existentes
   - Seleciona competências da coleção 'competencies'
   - Precisa selecionar uma avaliação (opcional)
   ↓
3. Se avaliação selecionada:
   - Tenta mapear perguntas custom para perguntasIds da avaliação
   - ❌ PROBLEMA: Perguntas custom não têm correspondência com perguntas da avaliação
   ↓
4. Se não há avaliação:
   - Usa customQuestions
   - Mas ao carregar, não sabe de qual avaliação buscar perguntas
```

---

### 3. **Método de Salvamento de Grupos**

#### ✅ `/reports` - `saveCompetencyGroup()`
```typescript:3595:3632:src/app/pages/reports/reports.component.ts
async saveCompetencyGroup(): Promise<void> {
  // ... validações ...
  
  const groupData = {
    name: this.groupNameControl.value,
    clientId: this.selectedClientId,
    competencias: this.competencias,  // ✅ Array já no formato correto
    createdAt: new Date(),
    assessmentId: this.selectedAssessmentId  // ✅ VINCULADO À AVALIAÇÃO
  };

  await addDoc(collection(this.firestore, 'competencyGroups'), groupData);
}
```

**Características:**
- `this.competencias` já está no formato `Competencia[]` com `perguntasIds`
- `assessmentId` está sempre disponível (contexto de avaliação)
- Estrutura é direta e consistente

#### ❌ `/competencies` - `saveCompetencyGroup()` (no dialog)
```typescript:389:439:src/app/pages/competencies/competency-dialog/competency-dialog.component.ts
async saveCompetencyGroup(): Promise<void> {
  // ... validações ...
  
  // Monta a estrutura de competencias do grupo no padrão do reports
  const competencias = (selectedCompetencyIds || []).map(id => {
    const c = this.availableCompetencies.find(ac => ac.id === id);
    const perguntasIds = this.getPerguntasIdsForCompetency(id, !!assessmentId);
    return c ? { id: c.id, nome: c.name, descricao: c.description, perguntasIds } : null;
  }).filter(...);

  const groupData: any = {
    name: groupName,
    clientId,
    competencias,
    createdAt: new Date(),
  };
  if (assessmentId) {
    groupData.assessmentId = assessmentId;  // ⚠️ Opcional
  } else {
    groupData.customQuestions = this.customQuestionsByCompetency;  // ❌ Problema
  }

  await addDoc(collection(this.firestore, 'competencyGroups'), groupData);
}
```

**Problemas:**
- `getPerguntasIdsForCompetency()` depende de mapeamento manual (mappingsArray)
- Se não há `assessmentId`, salva `customQuestions` mas não há como carregar depois
- Conversão de competências individuais para formato grupo pode perder informações

---

### 4. **Método de Carregamento de Grupos**

#### ✅ `/reports` - `loadCompetencyGroup()`
```typescript:3634:3666:src/app/pages/reports/reports.component.ts
async loadCompetencyGroup(): Promise<void> {
  const selectedGroupId = this.competencyGroupControl.value;
  const groupDoc = await getDoc(doc(this.firestore, 'competencyGroups', selectedGroupId));
  
  if (groupDoc.exists()) {
    const groupData = groupDoc.data();
    
    // Carregar competências do grupo
    this.competencias = groupData['competencias'] || [];
    
    // ✅ Se o grupo tem assessmentId associado, selecionar a avaliação
    if (groupData['assessmentId']) {
      this.selectedAssessmentId = groupData['assessmentId'];
      this.assessmentControl.setValue(groupData['assessmentId']);
      await this.onAssessmentChange();  // ✅ Carrega perguntas da avaliação
    }
    
    this.atualizarPerguntasBloqueadas();
  }
}
```

**Funciona porque:**
- `assessmentId` está sempre presente nos grupos criados via `/reports`
- `onAssessmentChange()` carrega o `questionMap` necessário para mapear `perguntasIds`
- As competências têm `perguntasIds` que correspondem às perguntas da avaliação

#### ❌ `/competencies` - Não tem método de carregamento no componente principal
- O componente `/competencies` não tem interface para carregar grupos
- Só salva grupos, não carrega
- Competências individuais não são convertidas para o formato de grupo automaticamente

---

### 5. **Contexto de Avaliação**

#### ✅ `/reports`
- **SEMPRE** trabalha no contexto de uma avaliação selecionada
- `selectedAssessmentId` está sempre definido quando cria competências
- `questionMap` é carregado automaticamente quando seleciona avaliação
- Competências são criadas com `perguntasIds` que referenciam perguntas da avaliação atual

#### ❌ `/competencies`
- Trabalha **SEM** contexto de avaliação obrigatório
- Competências individuais são criadas independentemente de avaliações
- Quando cria grupo, avaliação é **opcional**
- Se não há avaliação, não há como mapear perguntas para `perguntasIds`

---

## 🎯 Causa Raiz do Problema

O problema ocorre porque:

1. **Competências criadas em `/competencies` não estão vinculadas a avaliações:**
   - São salvas como entidades independentes com `questions: Question[]`
   - Não têm `assessmentId` ou `perguntasIds`

2. **Ao criar grupo em `/competencies`:**
   - Precisa mapear manualmente `questions` → `perguntasIds`
   - Se não há avaliação selecionada, não há como fazer o mapeamento
   - Se há avaliação, o mapeamento manual pode estar incorreto ou incompleto

3. **Ao carregar grupo criado em `/competencies`:**
   - Se não tem `assessmentId`, não sabe de qual avaliação buscar perguntas
   - Se tem `assessmentId` mas `perguntasIds` estão incorretos, não encontra as perguntas

4. **Ao carregar grupo criado em `/reports`:**
   - `assessmentId` está sempre presente
   - `perguntasIds` correspondem às perguntas da avaliação
   - Sistema restaura automaticamente o contexto da avaliação

---

## 💡 Recomendações para Correção

### Opção 1: Alinhar `/competencies` com `/reports` (Recomendado)
- Remover criação de competências individuais independentes
- Exigir seleção de avaliação antes de criar competências
- Usar mesma estrutura de dados que `/reports`
- Trabalhar sempre no contexto de uma avaliação

### Opção 2: Melhorar Conversão em `/competencies`
- Ao criar grupo, exigir avaliação obrigatória
- Criar mapeamento automático de `questions` → `perguntasIds`
- Validar que todas as perguntas têm correspondência na avaliação
- Garantir que `assessmentId` sempre seja salvo

### Opção 3: Suportar Ambos os Formatos
- Detectar formato ao carregar grupo
- Converter automaticamente entre formatos
- Manter compatibilidade com grupos antigos

---

## 📊 Tabela Comparativa

| Aspecto | `/reports` | `/competencies` |
|---------|-----------|----------------|
| **Contexto de avaliação** | ✅ Sempre presente | ❌ Opcional |
| **Estrutura de competência** | `{ id, nome, descricao, perguntasIds }` | `{ id, name, description, questions[] }` |
| **Vinculação a avaliação** | ✅ `assessmentId` no grupo | ⚠️ Opcional |
| **Mapeamento de perguntas** | ✅ Direto via `perguntasIds` | ❌ Conversão manual necessária |
| **Salvamento de grupo** | ✅ Estrutura completa | ⚠️ Depende de avaliação |
| **Carregamento de grupo** | ✅ Restaura avaliação automaticamente | ❌ Não implementado |
| **Suporte a perguntas custom** | ❌ Não | ⚠️ Sim, mas problemático |

---

## 🔧 Pontos de Atenção no Código

### 1. Método `getPerguntasIdsForCompetency()` em `/competencies`
```typescript:475:484:src/app/pages/competencies/competency-dialog/competency-dialog.component.ts
getPerguntasIdsForCompetency(competencyId: string, hasAssessment: boolean): string[] {
  if (hasAssessment) {
    const fg = this.mappingsArray.controls.find(...);
    const ids = (fg?.get('perguntasIds')?.value as string[]) || [];
    return Array.isArray(ids) ? ids : [];
  }
  // Sem avaliação: usar perguntas custom
  const customs = this.customQuestionsByCompetency[competencyId] || [];
  return customs.map(q => q.id);  // ❌ IDs custom não correspondem a perguntas da avaliação
}
```

**Problema:** Se não há avaliação, retorna IDs custom que não existem na avaliação quando o grupo for carregado.

### 2. Salvamento de grupo sem `assessmentId`
```typescript:422:427:src/app/pages/competencies/competency-dialog/competency-dialog.component.ts
if (assessmentId) {
  groupData.assessmentId = assessmentId;
} else {
  // Persistir perguntas custom criadas quando não houver avaliação
  groupData.customQuestions = this.customQuestionsByCompetency;  // ❌ Não há como usar depois
}
```

**Problema:** `customQuestions` não são utilizadas quando o grupo é carregado em `/reports`.

---

## ✅ Conclusão

A principal diferença é que `/reports` trabalha **sempre no contexto de uma avaliação**, garantindo que as competências sejam criadas com `perguntasIds` que correspondem às perguntas reais da avaliação. Já `/competencies` permite criar competências independentes, o que cria uma desconexão quando essas competências são agrupadas e carregadas em um contexto de avaliação.

**Solução recomendada:** Alinhar `/competencies` para trabalhar sempre no contexto de uma avaliação, similar a `/reports`, garantindo consistência e funcionalidade correta.


