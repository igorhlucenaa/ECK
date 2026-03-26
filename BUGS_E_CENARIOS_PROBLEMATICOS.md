# 🐛 Bugs e Cenários Problemáticos Identificados

## 📋 Índice
1. [Bugs Críticos](#bugs-críticos)
2. [Race Conditions](#race-conditions)
3. [Memory Leaks](#memory-leaks)
4. [Validações Faltando](#validações-faltando)
5. [Edge Cases](#edge-cases)
6. [Problemas de Segurança](#problemas-de-segurança)
7. [Problemas de Performance](#problemas-de-performance)
8. [Problemas de Código Deprecado](#problemas-de-código-deprecado)

---

## 🚨 Bugs Críticos

### 1. **Uso de `.substr()` Deprecado**
**Localização**: 
- `functions/src/index.ts` (linhas 281, 304)
- `src/app/pages/competencies/competencies.component.ts` (linha 1587)
- `src/app/pages/competencies/create-question-dialog/create-question-dialog.component.ts` (linha 88)
- `src/app/pages/competencies/competency-dialog/competency-dialog.component.ts` (linha 311)
- `src/app/services/core.service.ts` (linhas 105-107)

**Problema**: `.substr()` está deprecado e pode ser removido em versões futuras do JavaScript.

**Impacto**: Alto - Pode quebrar em navegadores/ambientes mais recentes.

**Solução**:
```typescript
// ❌ ERRADO
Math.random().toString(36).substr(2, 9)

// ✅ CORRETO
Math.random().toString(36).substring(2, 11)
// ou
Math.random().toString(36).slice(2, 11)
```

---

### 2. **Credenciais Hardcoded no Código**
**Localização**: `functions/src/index.ts` (linhas 209, 213)

**Problema**: Email e senha do Gmail estão hardcoded como fallback.

**Impacto**: Crítico - Risco de segurança se o código for exposto.

**Código Problemático**:
```typescript
const emailUser =
  EMAIL_USER_PARAM.value() ||
  process.env.EMAIL_USER ||
  'igorhlucenaa@gmail.com'; // ⚠️ CREDENCIAL HARDCODED
const emailPass =
  EMAIL_PASS_PARAM.value() ||
  process.env.EMAIL_PASS ||
  'catt vkem hnzg gwns'; // ⚠️ SENHA HARDCODED
```

**Solução**: Remover valores hardcoded e garantir que sempre venham de variáveis de ambiente ou parâmetros do Firebase.

---

### 3. **Falta de Validação de Email**
**Localização**: `functions/src/index.ts` (linha 196)

**Problema**: O email não é validado antes de ser usado.

**Impacto**: Médio - Pode causar erros no envio de emails.

**Solução**:
```typescript
const { email, templateId, participantId, assessmentId } = req.body;

// Adicionar validação
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  res.status(400).send({ error: 'Email inválido.' });
  return;
}
```

---

### 4. **Token de Avaliação Não Seguro**
**Localização**: `functions/src/index.ts` (linhas 280-282, 302-304)

**Problema**: Tokens são gerados usando apenas `Math.random()` e `Date.now()`, que não são criptograficamente seguros.

**Impacto**: Médio-Alto - Tokens podem ser adivinhados ou colidirem.

**Solução**: Usar biblioteca de criptografia segura:
```typescript
import * as crypto from 'crypto';

const assessmentLink = `https://eck360.web.app/assessment?token=${
  crypto.randomBytes(32).toString('hex')
}&participant=${participantId}&assessment=${assessmentId}`;
```

---

### 5. **Falta de Tratamento de Erro no Update do Participante**
**Localização**: `functions/src/index.ts` (linhas 308-312, 323-326)

**Problema**: Se o `update()` falhar após o email ser enviado, o estado do participante ficará inconsistente.

**Impacto**: Médio - Dados inconsistentes no banco.

**Solução**: Usar transação do Firestore ou adicionar tratamento de erro específico.

---

## ⚡ Race Conditions

### 6. **Múltiplas Chamadas Simultâneas de Loading**
**Localização**: `src/app/services/loading.service.ts` (linhas 32-51)

**Problema**: Se `show()` e `hide()` forem chamados rapidamente em sequência, pode haver inconsistência no contador.

**Cenário Problemático**:
```typescript
// Thread 1
this.loadingService.show();
// Thread 2 (quase simultâneo)
this.loadingService.show();
// Thread 1 termina
this.loadingService.hide(); // Contador vai para 1, mas deveria estar em 1 ainda
// Thread 2 termina
this.loadingService.hide(); // Contador vai para 0, mas pode ter havido outra chamada entre
```

**Solução**: Usar operações atômicas ou locks:
```typescript
private loadingLock = false;

show(message?: string): void {
  if (this.loadingLock) return;
  this.loadingLock = true;
  this.globalLoadingCount++;
  this.loadingSubject.next({...});
  this.loadingLock = false;
}
```

---

### 7. **Carregamento Paralelo de Dados sem Controle**
**Localização**: `src/app/pages/competencies/competencies.component.ts` (linhas 107-115)

**Problema**: Múltiplas operações assíncronas são iniciadas sem garantir ordem ou cancelamento.

**Cenário Problemático**:
```typescript
async ngOnInit(): Promise<void> {
  await this.loadUserData();
  await this.loadClients();
  await this.loadAssessments();
  // Se o componente for destruído durante o carregamento,
  // as operações continuarão executando
}
```

**Solução**: Usar `takeUntil` ou AbortController:
```typescript
private abortController = new AbortController();

async loadClients(): Promise<void> {
  if (this.abortController.signal.aborted) return;
  // ...
}

ngOnDestroy(): void {
  this.abortController.abort();
  this.destroy$.next();
  this.destroy$.complete();
}
```

---

### 8. **Auto-geração de PDF com Timeouts Aninhados**
**Localização**: `src/app/pages/reports/reports.component.ts` (linhas 778-799)

**Problema**: Timeouts aninhados podem causar múltiplas execuções se o componente for destruído.

**Código Problemático**:
```typescript
setTimeout(async () => {
  // ...
  setTimeout(async () => {
    // Timeout aninhado sem controle de cancelamento
  }, 3000);
}, 5000);
```

**Solução**: Usar variável de controle:
```typescript
private pdfGenerationTimeout: any = null;

ngOnDestroy() {
  if (this.pdfGenerationTimeout) {
    clearTimeout(this.pdfGenerationTimeout);
  }
}

// No código
this.pdfGenerationTimeout = setTimeout(async () => {
  // ...
  this.pdfGenerationTimeout = setTimeout(async () => {
    // ...
  }, 3000);
}, 5000);
```

---

## 💾 Memory Leaks

### 9. **Subscriptions Não Canceladas em ValueChanges**
**Localização**: `src/app/pages/competencies/competencies.component.ts` (linhas 118-173)

**Problema**: Embora use `takeUntil`, se o componente for destruído durante uma operação assíncrona dentro do subscribe, pode haver leak.

**Código Problemático**:
```typescript
this.assessmentControl.valueChanges
  .pipe(takeUntil(this.destroy$))
  .subscribe(id => {
    this.selectedAssessmentId = id;
    if (id) {
      this.onAssessmentChange(); // Operação assíncrona sem controle
    }
  });
```

**Solução**: Garantir que operações assíncronas também sejam canceláveis:
```typescript
this.assessmentControl.valueChanges
  .pipe(
    takeUntil(this.destroy$),
    switchMap(id => {
      if (id) {
        return from(this.onAssessmentChange()).pipe(
          catchError(err => {
            console.error(err);
            return EMPTY;
          })
        );
      }
      return EMPTY;
    })
  )
  .subscribe();
```

---

### 10. **Cache Não Limpado em Competencies**
**Localização**: `src/app/pages/competencies/competencies.component.ts` (linha 75)

**Problema**: `perguntasCustomCache` pode acumular dados ao longo do tempo.

**Solução**: Limpar cache periodicamente ou no `ngOnDestroy`:
```typescript
ngOnDestroy(): void {
  this.perguntasCustomCache = [];
  this.customQuestionsByCompetency = {};
  // ...
}
```

---

## ✅ Validações Faltando

### 11. **Falta de Validação de Template JSON**
**Localização**: `functions/src/index.ts` (linha 286)

**Problema**: `JSON.parse()` pode lançar exceção se o JSON estiver malformado, mas não há validação da estrutura esperada.

**Solução**:
```typescript
try {
  const parsedContent = JSON.parse(template.content);
  
  // Validar estrutura esperada
  if (!parsedContent.body || !parsedContent.body.rows) {
    throw new Error('Estrutura do template inválida.');
  }
  
  emailHtml = renderTemplateToHtml(parsedContent, {...});
} catch (err) {
  // ...
}
```

---

### 12. **Falta de Validação de Tipos no Firestore**
**Localização**: Múltiplos componentes

**Problema**: Dados do Firestore são assumidos como tendo tipos corretos sem validação.

**Exemplo Problemático**:
```typescript
const participantData = participantDoc.data();
const participantName = participantData?.name || 'Participante';
// Se name não for string, pode causar problemas
```

**Solução**: Criar função de validação:
```typescript
function validateParticipant(data: any): Participant {
  if (!data || typeof data.name !== 'string') {
    throw new Error('Dados do participante inválidos.');
  }
  return {
    name: data.name,
    email: data.email || '',
    // ...
  };
}
```

---

### 13. **Falta de Validação de Deadline**
**Localização**: `functions/src/index.ts` (linhas 248-265)

**Problema**: Deadline pode ser uma data inválida ou no passado sem validação.

**Solução**:
```typescript
if (deadline) {
  if (isNaN(deadline.getTime())) {
    console.warn('Data inválida, ignorando deadline');
    deadline = undefined;
  } else if (deadline < new Date()) {
    console.warn('Deadline no passado, usando data atual');
    deadline = new Date();
  }
  // ...
}
```

---

## 🎯 Edge Cases

### 14. **Participante Sem projectId**
**Localização**: `functions/src/index.ts` (linha 232)

**Problema**: Se `projectId` for `null` ou `undefined`, o código continua sem deadline, mas não há tratamento explícito.

**Impacto**: Baixo - Funciona, mas pode confundir usuários.

**Solução**: Adicionar log ou mensagem informativa.

---

### 15. **Template Sem Conteúdo**
**Localização**: `functions/src/index.ts` (linha 45)

**Problema**: Se `templateContent.body.rows` for `undefined` ou vazio, o HTML gerado será vazio.

**Solução**:
```typescript
function renderTemplateToHtml(...): string {
  if (!templateContent?.body?.rows || !Array.isArray(templateContent.body.rows)) {
    throw new Error('Template sem conteúdo válido.');
  }
  // ...
}
```

---

### 16. **Array Vazio em assessmentLinks**
**Localização**: `functions/src/index.ts` (linha 310)

**Problema**: Se `assessmentLinks` não existir no documento, `arrayUnion` pode criar o campo, mas se já existir e for `null`, pode causar erro.

**Solução**:
```typescript
const currentLinks = participantData?.assessmentLinks || [];
await participantRef.update({
  assessmentLinks: admin.firestore.FieldValue.arrayUnion(assessmentLinkObj),
  // ...
});
```

---

### 17. **ParticipanteId Null no Catch**
**Localização**: `functions/src/index.ts` (linha 331)

**Problema**: O código verifica `if (participantId)`, mas se `participantId` for `null` no catch, não atualiza o status de erro.

**Solução**: Melhorar tratamento:
```typescript
catch (error: any) {
  console.error('Erro ao enviar e-mail:', error);
  if (participantId && typeof participantId === 'string') {
    try {
      await admin.firestore()
        .collection('participants')
        .doc(participantId)
        .update({
          deliveryStatus: 'failed',
          errorMessage: error.message,
        });
    } catch (updateError) {
      console.error('Erro ao atualizar status do participante:', updateError);
    }
  }
  res.status(500).send({ error: `Erro ao enviar e-mail: ${error.message}` });
}
```

---

## 🔒 Problemas de Segurança

### 18. **CORS Aberto sem Validação de Origem**
**Localização**: `functions/src/index.ts` (linha 193)

**Problema**: CORS está habilitado sem restrições de origem.

**Solução**: Adicionar validação de origem:
```typescript
export const sendEmail = onRequest(
  {
    region: 'us-central1',
    cors: [
      'https://eck360.web.app',
      'https://eck360.firebaseapp.com'
    ],
  },
  async (req, res) => {
    // Validar origem
    const origin = req.headers.origin;
    const allowedOrigins = ['https://eck360.web.app', 'https://eck360.firebaseapp.com'];
    if (!allowedOrigins.includes(origin || '')) {
      res.status(403).send({ error: 'Origem não permitida.' });
      return;
    }
    // ...
  }
);
```

---

### 19. **Falta de Rate Limiting**
**Localização**: `functions/src/index.ts`

**Problema**: Não há limite de requisições por IP/usuário, permitindo spam de emails.

**Solução**: Implementar rate limiting usando Firebase Extensions ou middleware.

---

### 20. **Validação de Permissões Inconsistente**
**Localização**: Múltiplos componentes

**Problema**: Alguns componentes verificam permissões, outros não.

**Exemplo**: `src/app/pages/users/users.component.ts` verifica role, mas outros componentes podem não verificar.

**Solução**: Criar guard ou decorator para validação consistente.

---

## ⚡ Problemas de Performance

### 21. **Queries Sem Índices**
**Localização**: Múltiplos componentes usando `where()` e `orderBy()`

**Problema**: Queries compostas podem ser lentas sem índices no Firestore.

**Exemplo**:
```typescript
const q = query(
  collection(this.firestore, 'users'),
  where('client', '==', clientId),
  orderBy('createdAt', 'desc')
);
```

**Solução**: Criar índices compostos no Firestore Console.

---

### 22. **Carregamento Sequencial Quando Poderia Ser Paralelo**
**Localização**: `src/app/pages/projects-list/projects-list.component.ts` (linhas 104-127)

**Problema**: `Promise.all` é usado, mas dentro há operações que poderiam ser otimizadas.

**Solução**: Usar `Promise.allSettled` para não falhar tudo se uma operação falhar:
```typescript
const results = await Promise.allSettled(
  snapshot.docs.map(async (doc) => {
    // ...
  })
);
```

---

### 23. **Múltiplas Queries para Mesmos Dados**
**Localização**: `src/app/pages/users/users.component.ts` (linhas 146-153)

**Problema**: Carrega todas as collections mesmo quando não precisa.

**Solução**: Carregar sob demanda ou usar cache.

---

## 📝 Problemas de Código Deprecado

### 24. **Uso de `substr()` em Core Service**
**Localização**: `src/app/services/core.service.ts` (linhas 105-107)

**Problema**: `.substr()` está deprecado.

**Solução**:
```typescript
// ❌ ERRADO
const r = parseInt(hex.substr(1, 2), 16);

// ✅ CORRETO
const r = parseInt(hex.substring(1, 3), 16);
// ou
const r = parseInt(hex.slice(1, 3), 16);
```

---

## 📊 Resumo de Prioridades

### 🔴 Crítico (Corrigir Imediatamente)
1. Credenciais hardcoded (#2)
2. Token não seguro (#4)
3. Uso de `.substr()` deprecado (#1, #24)

### 🟠 Alto (Corrigir em Breve)
4. Race conditions em loading (#6)
5. Memory leaks (#9, #10)
6. Validações faltando (#11, #12)
7. CORS sem validação (#18)

### 🟡 Médio (Melhorar Quando Possível)
8. Validação de email (#3)
9. Tratamento de erro inconsistente (#5, #17)
10. Edge cases (#14, #15, #16)
11. Rate limiting (#19)

### 🟢 Baixo (Otimizar Futuramente)
12. Performance (#21, #22, #23)
13. Validação de permissões (#20)

---

## 🛠️ Recomendações Gerais

1. **Adicionar testes unitários** para casos críticos
2. **Implementar logging estruturado** para facilitar debug
3. **Criar tipos TypeScript** mais específicos ao invés de `any`
4. **Documentar edge cases** conhecidos
5. **Implementar monitoramento** de erros (Sentry, Firebase Crashlytics)
6. **Revisar periodicamente** dependências por vulnerabilidades
7. **Adicionar validação de schema** para dados do Firestore
8. **Implementar circuit breakers** para operações externas (email)

---

**Última atualização**: Baseado na análise do código em 2024
**Próximos passos**: Priorizar correções críticas e altas
