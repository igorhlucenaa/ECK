# Estrutura dos Dados - Sistema de Relatórios

## Visão Geral

Este documento explica como os dados estão estruturados no sistema de relatórios, especialmente para as tabelas detalhadas de competências.

## Estrutura dos Dados no Firebase

### 1. Collections Principais

```
assessments/
├── {assessmentId}/
│   ├── surveyJSON: { pages: [...] }  // Estrutura do questionário
│   └── results/
│       └── {resultId}/
│           ├── participantId: string
│           ├── completedAt: timestamp
│           └── surveyData: { [perguntaId]: valor }
```

### 2. Participants Collection

```
participants/
└── {participantId}/
    ├── name: string
    ├── category: string  // "Avaliado", "Gestor", "Pares", "Subordinados", "Outros"
    ├── email: string
    └── type: "avaliado" | "avaliador"
```

## Processamento dos Dados no Frontend

### 1. Carregamento (onAssessmentChange)

```typescript
// 1. Carrega assessment e extrai perguntas
const surveyJSON = assessmentData['surveyJSON'];

// 2. Carrega resultados
const resultsSnap = await getDocs(collection(this.firestore, `assessments/${assessmentId}/results`));

// 3. Para cada resultado, busca dados do participante
for (const resultDoc of resultsSnap.docs) {
  const resultData = resultDoc.data();
  const participantData = await getDoc(doc(this.firestore, 'participants', resultData['participantId']));
  
  // 4. Constrói objeto final
  const row = {
    data: '',
    categoria: participantData.category,
    avaliado: participantData.name,
    dataAvaliacao: formatDate(resultData.completedAt),
    // As respostas ficam diretamente no objeto:
    [perguntaId]: resultData.surveyData[perguntaId],
    // ... outras perguntas
  };
}
```

### 2. Estrutura Final do dataSource

```typescript
dataSource: Array<{
  data: string,
  categoria: string,        // "Avaliado", "Gestor", etc.
  avaliado: string,         // Nome do participante
  dataAvaliacao: string,    // Data formatada
  [perguntaId]: number,     // Resposta da pergunta (1-5)
  // ... outras perguntas
}>
```

## Mapeamento de Categorias

```typescript
private mapCategoriaToGrupo(categoria: string): string {
  const mapping: { [key: string]: string } = {
    'Avaliado': 'Avaliado(a)',
    'Gestor': 'Gestor(es)',
    'Pares': 'Pares',
    'Subordinados': 'Subordinados',
    'Outros': 'Outros'
  };
  return mapping[categoria] || 'Outros';
}
```

## Geração de Tabelas Detalhadas

### 1. Fluxo Principal

```typescript
gerarTabelaCompetencia(competencia: Competencia) {
  // Para cada pergunta da competência
  competencia.perguntasIds.forEach(perguntaId => {
    // Para cada grupo de avaliadores
    grupos.forEach(grupo => {
      // Busca respostas específicas
      const respostas = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
      // Calcula distribuição (quantas notas 1, 2, 3, 4, 5)
      const distribuicao = this.calcularDistribuicaoNotas(respostas);
      // Calcula média
      const media = this.calcularMediaDistribuicao(distribuicao);
    });
  });
}
```

### 2. Busca de Respostas

```typescript
private getRespostasParaPerguntaEGrupo(perguntaId: string, grupo: string): number[] {
  const participantesGrupo = this.dataIndexes.participantsByCategory.get(grupo) || [];
  const respostas: number[] = [];

  participantesGrupo.forEach(participantIndex => {
    const participant = this.dataSource[participantIndex];
    // IMPORTANTE: As respostas estão diretamente no objeto
    if (participant && participant[perguntaId] !== undefined) {
      const valor = Number(participant[perguntaId]);
      if (!isNaN(valor) && valor >= 1 && valor <= 5) {
        respostas.push(valor);
      }
    }
  });

  return respostas;
}
```

## Problemas Comuns e Soluções

### 1. Tabela Vazia ou Dados Incorretos

**Problema**: Tabela não mostra dados ou mostra zeros.

**Diagnóstico**:
```typescript
// Use o botão "Debug Tabela Detalhada" para verificar:
debugTabelaDetalhada();
```

**Possíveis Causas**:
- Categorias não mapeadas corretamente
- Perguntas não encontradas no dataSource
- Índices não criados corretamente
- Dados não carregados

### 2. Coluna "Avaliado" Ausente

**Problema**: Não aparece a coluna "Avaliado(a)" na tabela.

**Solução**: O método `getGrupos()` sempre retorna os grupos padrão:
```typescript
getGrupos() {
  const gruposPadrao = ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'];
  const gruposEncontrados = Array.from(this.dataIndexes.participantsByCategory.keys());
  return [...new Set([...gruposPadrao, ...gruposEncontrados])];
}
```

### 3. Valores Incorretos

**Problema**: Médias ou distribuições incorretas.

**Verificação**:
```typescript
// Verificar se os valores estão sendo parseados corretamente
console.log('Valor original:', participant[perguntaId]);
console.log('Valor parseado:', Number(participant[perguntaId]));
```

## Debug e Monitoramento

### 1. Método de Debug

Use `debugTabelaDetalhada()` para verificar:
- Total de registros
- Estrutura dos dados
- Categorias encontradas
- Mapeamento de grupos
- Índices criados
- Teste com primeira competência

### 2. Logs Importantes

```typescript
// Verificar carregamento
console.log('DataSource carregado:', this.dataSource.length);

// Verificar índices
console.log('Índices criados:', this.dataIndexes.participantsByCategory);

// Verificar respostas
console.log('Respostas encontradas:', respostas);
```

## Estrutura da Tabela HTML

```html
<table>
  <thead>
    <tr>
      <th>Competência</th>
      <th colspan="5">A</th>  <!-- Avaliado(a) -->
      <th colspan="5">G</th>  <!-- Gestor(es) -->
      <th colspan="5">P</th>  <!-- Pares -->
      <th colspan="5">S</th>  <!-- Subordinados -->
      <th colspan="5">O</th>  <!-- Outros -->
    </tr>
    <tr>
      <th></th>
      <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>  <!-- Para cada categoria -->
      <!-- ... repetir para outras categorias -->
    </tr>
  </thead>
  <tbody>
    <tr *ngFor="let linha of tabela.linhas">
      <td>{{ linha.pergunta }}</td>
      <ng-container *ngFor="let categoria of linha.categorias">
        <td *ngFor="let dist of categoria.distribuicao">{{ dist.quantidade }}</td>
      </ng-container>
    </tr>
  </tbody>
</table>
```

Este documento deve ser atualizado conforme mudanças na estrutura dos dados. 
