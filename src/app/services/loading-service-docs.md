# Sistema de Loading Global - ECK

## Visão Geral

O sistema de loading global da ECK foi projetado para fornecer uma experiência de usuário consistente durante operações assíncronas em toda a aplicação. Ele oferece diferentes tipos de loading, controle automático de múltiplas requisições e integração com HTTP e Firestore.

## Componentes Principais

### 1. LoadingService
Serviço principal que gerencia todos os estados de loading.

### 2. GlobalLoadingComponent
Componente visual que exibe o loading na tela.

### 3. LoadingInterceptor
Interceptor HTTP que automaticamente mostra/esconde loading durante requisições.

### 4. FirestoreLoadingInterceptor
Interceptor específico para operações do Firestore.

## Tipos de Loading

### 1. Spinner (Padrão)
```typescript
// Loading simples
this.loadingService.show();

// Loading com mensagem
this.loadingService.show('Carregando dados...');

// Esconder loading
this.loadingService.hide();
```

### 2. Progress Bar
```typescript
// Iniciar loading com progresso
const progressControl = this.loadingService.showWithProgress('Fazendo upload...');

// Atualizar progresso
progressControl.updateProgress(50); // 50%

// Finalizar
progressControl.hide();
```

### 3. Skeleton Loading
```typescript
// Loading com efeito skeleton
this.loadingService.showSkeleton('Carregando interface...');
```

## Funcionalidades Avançadas

### 1. Loading Específico por Chave
```typescript
// Mostrar loading para uma operação específica
this.loadingService.showFor('upload', 'Fazendo upload...');

// Atualizar progresso específico
this.loadingService.updateProgress('upload', 75);

// Esconder loading específico
this.loadingService.hideFor('upload');
```

### 2. Loading com Timeout
```typescript
// Loading que para automaticamente após 30s
this.loadingService.showWithTimeout('Operação longa...', 30000)
  .subscribe(timedOut => {
    if (timedOut) {
      console.log('Loading interrompido por timeout');
    }
  });
```

### 3. Loading Delayed
```typescript
// Só mostra loading se demorar mais de 300ms
this.loadingService.showDelayed('Carregando...', 300)
  .subscribe(shouldShow => {
    if (shouldShow) {
      // Operação demorou, mostrar loading
    }
  });
```

### 4. Múltiplos Loadings
O sistema gerencia automaticamente múltiplas operações simultâneas:
```typescript
// Múltiplas operações
this.loadingService.show('Operação 1...');
this.loadingService.show('Operação 2...');
this.loadingService.show('Operação 3...');

// O loading só para quando todas as operações terminarem
this.loadingService.hide();
this.loadingService.hide();
this.loadingService.hide();
```

## Integração com Firestore

### Usando o FirestoreLoadingInterceptor
```typescript
constructor(
  private firestoreInterceptor: FirestoreLoadingInterceptor
) {}

// Carregar documentos com loading automático
async loadData() {
  const docs = await this.firestoreInterceptor
    .getDocsWithLoading('users', 'Carregando usuários...')
    .toPromise();
}

// Salvar documento com loading
async saveData(data: any) {
  await this.firestoreInterceptor
    .addDocWithLoading('users', data, 'Salvando dados...')
    .toPromise();
}
```

## Configuração

### 1. App Config
O interceptor HTTP já está configurado no `app.config.ts`:
```typescript
{ provide: LoadingInterceptor, useClass: LoadingInterceptor }
```

### 2. App Component
O componente global já está incluído no `app.component.html`:
```html
<app-global-loading></app-global-loading>
```

## Exemplos de Uso

### 1. Carregamento de Dados
```typescript
async loadAssessments() {
  this.loadingService.show('Carregando avaliações...');
  try {
    const assessmentsSnap = await getDocs(collection(this.firestore, 'assessments'));
    this.assessments = assessmentsSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['name'] || doc.id
    }));
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    this.loadingService.hide();
  }
}
```

### 2. Upload com Progresso
```typescript
async uploadFile(file: File) {
  const progressControl = this.loadingService.showWithProgress('Fazendo upload...');
  
  try {
    // Simular upload com progresso
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      progressControl.updateProgress(i);
    }
    
    // Upload concluído
    this.snackBar.open('Upload concluído!', 'Fechar', { duration: 3000 });
  } catch (error) {
    console.error('Erro no upload:', error);
  } finally {
    progressControl.hide();
  }
}
```

### 3. Operações Múltiplas
```typescript
async processMultipleOperations() {
  // Iniciar múltiplas operações
  this.loadingService.show('Processando dados...');
  
  const promises = [
    this.loadUsers(),
    this.loadProjects(),
    this.loadReports()
  ];
  
  try {
    await Promise.all(promises);
    this.snackBar.open('Todas as operações concluídas!', 'Fechar', { duration: 3000 });
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    this.loadingService.hide();
  }
}
```

## Boas Práticas

### 1. Sempre use try/finally
```typescript
async loadData() {
  this.loadingService.show('Carregando...');
  try {
    // Operação
  } finally {
    this.loadingService.hide();
  }
}
```

### 2. Use mensagens descritivas
```typescript
// Bom
this.loadingService.show('Carregando lista de usuários...');

// Evite
this.loadingService.show('Loading...');
```

### 3. Para operações rápidas, use delayed loading
```typescript
// Só mostra loading se demorar mais de 300ms
this.loadingService.showDelayed('Carregando...', 300)
  .subscribe(shouldShow => {
    if (shouldShow) {
      // Operação demorou, mostrar loading
    }
  });
```

### 4. Use loading específico para operações independentes
```typescript
// Para uploads independentes
this.loadingService.showFor('upload-1', 'Upload arquivo 1...');
this.loadingService.showFor('upload-2', 'Upload arquivo 2...');
```

## Debugging

### Verificar estado atual
```typescript
// Verificar se está carregando
console.log('Loading ativo:', this.loadingService.isLoading);

// Verificar contagem de loadings ativos
console.log('Loadings ativos:', this.loadingService.activeLoadingCount);

// Verificar estado completo
console.log('Estado atual:', this.loadingService.currentState);
```

### Resetar todos os estados
```typescript
// Em caso de problemas, resetar tudo
this.loadingService.reset();
```

## Performance

- **Debounce**: O sistema usa debounce de 100ms para evitar flickering
- **Distinct Until Changed**: Evita atualizações desnecessárias
- **Contador de Requisições**: Gerencia múltiplas operações simultâneas
- **Cache**: Sistema de cache para operações repetitivas

## Troubleshooting

### Loading não para
1. Verifique se `hide()` está sendo chamado no `finally`
2. Use `reset()` para limpar todos os estados
3. Verifique se não há múltiplas chamadas de `show()`

### Loading não aparece
1. Verifique se o componente está importado no `app.component.ts`
2. Verifique se o interceptor está configurado
3. Verifique se não há erros no console

### Múltiplos loadings simultâneos
1. Use `showFor()` para operações independentes
2. Verifique se está chamando `hide()` para cada `show()`
3. Use o contador de loadings ativos para debug 
