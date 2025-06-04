# Dashboard Personalizado para Avaliações

Este módulo implementa uma solução completa de dashboard personalizado para avaliações usando Cube.js, Angular e Gridster2.

## Visão Geral

A solução permite aos usuários:
- Criar dashboards personalizados de análise de avaliações
- Arrastar e soltar widgets para organizar o layout
- Escolher entre diferentes tipos de visualizações (barras, pizza, radar, etc)
- Aplicar filtros dinâmicos
- Salvar e compartilhar dashboards

## Arquitetura

A solução é composta por duas partes principais:

1. **Frontend Angular**:
   - Interface do usuário usando Angular, Angular Material e NGX-Charts
   - Componentes para construção interativa de dashboard
   - Integração com Firebase para armazenamento de configurações

2. **Backend Cube.js**:
   - API analítica para processamento e agregação de dados
   - Definição de métricas, dimensões e pré-agregações
   - Cache inteligente para consultas rápidas

## Configuração

### Requisitos

- Node.js 14+
- Firebase (Firestore)
- Banco de dados para Cube.js (PostgreSQL, MySQL, MongoDB, ou outro suportado)

### Instalação

1. **Instalar dependências**:

```bash
npm install @cubejs-client/core @cubejs-client/ngx angular-gridster2 @swimlane/ngx-charts uuid
npm install --save-dev @types/uuid
```

2. **Configurar Cube.js Server**:

```bash
# Instalar Cube.js CLI
npm install -g cubejs-cli

# Criar projeto Cube.js
cubejs create assessment-analytics -d postgres

# Copiar os arquivos de schema para a pasta schema/
cp src/cube/schema/* assessment-analytics/schema/
```

3. **Configurar o banco de dados**

Edite o arquivo `.env` no diretório do projeto Cube.js:

```ini
CUBEJS_DB_HOST=localhost
CUBEJS_DB_PORT=5432
CUBEJS_DB_NAME=seu_banco
CUBEJS_DB_USER=seu_usuario
CUBEJS_DB_PASS=sua_senha
CUBEJS_WEB_SOCKETS=true
CUBEJS_DEV_MODE=true
```

## Execução

1. **Iniciar o servidor Cube.js**:

```bash
cd assessment-analytics
npm run dev
```

O servidor Cube.js estará disponível em `http://localhost:4000`.

2. **Configurar o endpoint na aplicação Angular**:

Edite o arquivo `src/app/services/cube.service.ts` e atualize a URL:

```typescript
const API_URL = 'http://localhost:4000/cubejs-api/v1';
```

## Funcionalidades

### Templates pré-configurados

- **Desempenho por Competência**: Mostra o desempenho em diferentes competências com gráfico de radar
- **Comparativo Auto vs. Gestor**: Comparação das avaliações entre autoavaliação e gestor
- **Visão da Equipe**: Visão geral do desempenho da equipe ao longo do tempo

### Tipos de widgets

- Gráficos de Barras
- Gráficos de Pizza
- Gráfico de Radar (Polar)
- Gráfico de Linha
- Indicadores Numéricos
- Tabela de Dados

### Customização

Cada widget pode ser personalizado em termos de:
- Título e descrição
- Tipo de visualização
- Cores e legenda
- Métricas e dimensões exibidas
- Filtros aplicados

## Estrutura de Arquivos

```
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── dashboard-builder/      # Componente principal do dashboard
│   │   │   └── widget/                 # Componente de widget individual
│   │   ├── models/
│   │   │   └── dashboard.model.ts      # Modelos de dados do dashboard
│   │   └── services/
│   │       ├── cube.service.ts         # Serviço para comunicação com Cube.js
│   │       └── dashboard.service.ts    # Serviço para gerenciar dashboards
│   └── cube/
│       └── schema/                     # Definições do schema Cube.js
│           └── Assessments.js          # Definição do cubo de avaliações
```

## Integração com Firebase

Os dashboards são salvos no Firestore na coleção `dashboards` com a seguinte estrutura:

```json
{
  "id": "dashboard-uuid",
  "name": "Nome do Dashboard",
  "description": "Descrição",
  "widgets": [
    {
      "id": "widget-uuid",
      "name": "Nome do Widget",
      "type": "bar_chart",
      "position": { "x": 0, "y": 0, "cols": 6, "rows": 4 },
      "query": {
        "measures": ["Assessments.averageRating"],
        "dimensions": ["Assessments.competencyName"],
        "filters": []
      },
      "visualOptions": {
        "title": "Título do Widget",
        "showLegend": true
      }
    }
  ],
  "createdAt": "2023-07-01T12:00:00Z",
  "updatedAt": "2023-07-02T15:30:00Z"
}
```

## Próximos Passos

Sugestões para melhorias futuras:

1. **Adicionar mais interatividade**:
   - Drill-down em gráficos
   - Filtros interligados entre widgets

2. **Recursos avançados**:
   - Exportação para PDF/Excel
   - Agendamento de relatórios
   - Compartilhamento por email

3. **Integração com IA**:
   - Insights automáticos sobre os dados
   - Sugestões de visualizações baseadas no contexto
   - Detecção de anomalias

## Troubleshooting

**Problema**: Erro "Failed to fetch data from Cube.js API"
**Solução**: Verifique se o servidor Cube.js está rodando e se a URL em `cube.service.ts` está correta.

**Problema**: Widgets não exibem dados
**Solução**: Verifique no console do navegador se há erros nas consultas e se as dimensões/métricas existem no schema. 
