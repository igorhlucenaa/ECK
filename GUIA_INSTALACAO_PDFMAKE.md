# 🚀 Guia de Instalação e Integração - PDFMake POC

## 📦 Passo 1: Instalar Dependências

```bash
npm install pdfmake
npm install --save-dev @types/pdfmake
```

## 🔧 Passo 2: Configurar Fontes (Opcional)

O PDFMake já vem com fontes Roboto pré-configuradas. Se quiser usar fontes customizadas:

1. Baixe as fontes TTF desejadas
2. Use o script `node_modules/pdfmake/build/buildFonts.js` para gerar o arquivo de fontes
3. Importe no serviço

## 📝 Passo 3: Integrar no Componente Reports

### 3.1. Importar o Serviço

No arquivo `src/app/pages/reports/reports.component.ts`:

```typescript
import { ReportPdfMakeService } from '../../services/report-pdfmake.service';
```

### 3.2. Injetar no Construtor

```typescript
constructor(
  // ... outros serviços
  private pdfMakeService: ReportPdfMakeService
) {}
```

### 3.3. Adicionar Método de Exportação

Adicione este método ao componente:

```typescript
/**
 * Exporta relatório usando PDFMake (NOVO)
 */
async exportarRelatorioPDFMake(): Promise<void> {
  try {
    // Verificar se há dados
    if (!this.isDataReady()) {
      this.snackBar.open(
        this.t('Por favor, selecione uma avaliação e aguarde o carregamento dos dados.'),
        this.t('Fechar'),
        { duration: 3000 }
      );
      return;
    }

    this.loadingService.show('Gerando PDF com PDFMake...');

    // Preparar dados do componente para o serviço PDFMake
    const reportData = this.pdfMakeService.prepareReportDataFromComponent(this);

    // Gerar PDF
    await this.pdfMakeService.generateReport(reportData);

    this.loadingService.hide();
    this.snackBar.open(
      this.t('PDF gerado com sucesso usando PDFMake!'),
      this.t('Fechar'),
      { duration: 3000 }
    );
  } catch (error: any) {
    this.loadingService.hide();
    console.error('Erro ao gerar PDF com PDFMake:', error);
    this.snackBar.open(
      this.t('Erro ao gerar PDF: {{error}}', { error: error.message }),
      this.t('Fechar'),
      { duration: 5000 }
    );
  }
}
```

### 3.4. Adicionar Botão no Template (Opcional)

No arquivo `src/app/pages/reports/reports.component.html`, adicione um botão:

```html
<button mat-raised-button color="primary" (click)="exportarRelatorioPDFMake()">
  <mat-icon>picture_as_pdf</mat-icon>
  Exportar PDF (PDFMake)
</button>
```

## ✅ Passo 4: Testar

1. Selecione uma avaliação
2. Configure as seções do relatório
3. Clique em "Exportar PDF (PDFMake)"
4. O PDF será gerado e baixado automaticamente

## 🎨 Funcionalidades Implementadas

### ✅ Tipos de Gráficos Suportados

1. **Barras Comparativas** (`barra`)
   - Gráfico de barras horizontal comparando categorias
   - Suporta cores personalizadas

2. **Radar Comparativo** (`radar`)
   - Gráfico radar comparando múltiplas competências
   - Múltiplas séries

3. **Pizza Comparativa** (`pizza-comparativa`)
   - Gráfico de pizza comparando competências
   - Mostra percentuais

4. **Pizza Individual** (`pizza-individual`)
   - Gráfico de pizza por competência
   - Distribuição por categorias

5. **Barras Individuais** (`barras-individuais`)
   - Gráfico de barras empilhadas por competência
   - Comparação entre categorias

6. **Janela de Johari** (`janela_johari`)
   - Gráfico 2D com quadrantes
   - Análise de autoavaliação vs avaliação dos outros

7. **Gráfico de Defasagem** (`grafico_defasagem`)
   - Análise de gap entre autoavaliação e outros
   - Identifica pontos cegos e pontos fortes

### ✅ Seções do Relatório

1. **Capa** - Página inicial com informações do participante
2. **Introdução** - Texto customizável
3. **Resumo Executivo** - Top 5 competências e áreas de desenvolvimento
4. **Gráficos** - Todos os tipos de gráficos acima
5. **Tabelas** - Tabelas detalhadas por competência
6. **Destaques** - Pontos fortes, áreas de desenvolvimento e recomendações
7. **Competência Detalhada** - Análise detalhada por pergunta
8. **Texto Customizado** - Seções de texto livre

## 🔍 Troubleshooting

### Erro: "Cannot find module 'pdfmake'"

```bash
npm install pdfmake @types/pdfmake
```

### Erro: "Fonts not loaded"

O PDFMake já vem com fontes pré-configuradas. Se ainda assim der erro, verifique se o import está correto:

```typescript
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
```

### Gráficos não aparecem no PDF

Os gráficos são gerados como imagens Canvas. Se não aparecerem:
1. Verifique se há dados suficientes
2. Verifique o console do navegador para erros
3. Os gráficos são gerados manualmente via Canvas, não dependem de ECharts renderizado

### PDF muito grande

Os PDFs gerados são nativos e geralmente menores que HTML convertido. Se ainda assim estiver grande:
- Reduza o número de seções
- Reduza a qualidade das imagens (ajuste `pixelRatio` no código)

## 📚 Próximos Passos

1. **Customização de Estilos**: Edite `getStyles()` no serviço para personalizar cores e fontes
2. **Adicionar Mais Gráficos**: Implemente novos tipos no método `buildChartsSection()`
3. **Otimização**: Cache de gráficos gerados para melhor performance
4. **Testes**: Adicione testes unitários para o serviço

## 🆘 Suporte

Em caso de problemas, verifique:
- Console do navegador para erros JavaScript
- Network tab para verificar se os recursos estão carregando
- Dados do componente (se `isDataReady()` retorna `true`)
