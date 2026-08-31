/**
 * Rodada 3 — chaves restantes Relatórios / Report Builder / paletas / publicação
 */
const fs = require('fs');
const path = require('path');

const EN = {
  'Visual (Drag & Drop)': 'Visual (Drag & Drop)',
  'Clássico': 'Classic',
  'Bloco de Texto': 'Text Block',
  'Barra Comparativa': 'Comparative Bar',
  'Radar Comparativo': 'Comparative Radar',
  'Pizza Comparativa': 'Comparative Pie',
  'Pizza Individual': 'Individual Pie',
  'Barras Individuais': 'Individual Bars',
  'Barras Comparativas': 'Comparative Bars',
  'Personalização de Cores': 'Color Customization',
  'Gráfico de Barras Comparativo:': 'Comparative Bar Chart:',
  'Cada categoria terá uma cor distinta para melhor visualização.': 'Each category will have a distinct color for better visualization.',
  'A paleta "Categorias Distintas" é recomendada para este tipo de gráfico.': 'The "Distinct Categories" palette is recommended for this chart type.',
  'Gradientes': 'Gradients',
  'Especiais': 'Special',
  'Mostrar pontuação sem autoavaliação': 'Show score without self-assessment',
  'Sobre Avaliações Mais Altas e Baixas': 'About Highest and Lowest Ratings',
  'Esta seção lista os comportamentos/perguntas com maior e menor pontuação média geral. Inclui todas as competências automaticamente.':
    'This section lists behaviors/questions with the highest and lowest overall average scores. Includes all competencies automatically.',
  'Adicionar seção abaixo': 'Add section below',
  'Remover seção': 'Remove section',
  'Visualizador ainda tem acesso': 'Viewer still has access',
  'O relatório consta como não publicado, mas o visualizador ainda consegue vê-lo. Clique em "Despublicar" para cortar o acesso.':
    'The report is marked as unpublished, but the viewer can still see it. Click "Unpublish" to revoke access.',
  'Alterações não publicadas': 'Unpublished changes',
  'Você alterou o relatório desde a última publicação. Publique novamente para o visualizador ver as mudanças.':
    'You changed the report since the last publication. Publish again for the viewer to see the changes.',
  'Republicar alterações': 'Republish changes',
  'Publicar relatório': 'Publish report',
  'Despublicar': 'Unpublish',
  'Template não configurado no projeto.': 'Template not configured in project.',
  'PDF e DOCX ficam indisponíveis até vincular um template na edição do projeto.':
    'PDF and DOCX are unavailable until a template is linked when editing the project.',
  'Exportar PDF individual': 'Export individual PDF',
  'competência pronta': 'competency ready',
  'competências prontas': 'competencies ready',
  'de {{total}} competência ativa': 'of {{total}} active competency',
  'de {{total}} competências ativas': 'of {{total}} active competencies',
  'questão': 'question',
  'questões': 'questions',
  'Configuração': 'Configuration',
  'Título da Seção': 'Section Title',
  'Digite o título...': 'Enter title...',
  'Seção visível no relatório': 'Section visible in report',
  'Quebras de página': 'Page breaks',
  'Iniciar em nova página': 'Start on new page',
  '(antes desta seção)': '(before this section)',
  'Forçar nova página após esta seção': 'Force new page after this section',
  'Cor das Tabelas': 'Table Color',
  'Cor Sólida': 'Solid Color',
  'Escolher cor': 'Choose color',
  'Cor — Avaliações mais altas': 'Color — Highest ratings',
  'Cor — Avaliações mais baixas': 'Color — Lowest ratings',
  'Cor das Tabelas Detalhadas': 'Detailed Table Color',
  'Tipo de Gráfico': 'Chart Type',
  'Paleta de Cores': 'Color Palette',
  'Adicionar cor': 'Add color',
  'Remover': 'Remove',
  'Salvar Alterações': 'Save Changes',
  'Cancelar': 'Cancel',
  'Configurações do Documento': 'Document Settings',
  'Recolher painel': 'Collapse panel',
  'Cabeçalho': 'Header',
  'Rodapé': 'Footer',
  'Texto à esquerda': 'Left text',
  'Texto central': 'Center text',
  'Cor': 'Color',
  'Ocultar': 'Hide',
  'Mostrar': 'Show',
  'Duplicar': 'Duplicate',
  'Sem quebra de página antes': 'No page break before',
  'Quebra de página após esta seção': 'Page break after this section',
  'Clique para editar a paleta de cores': 'Click to edit color palette',
  'competência(s)': 'competency(ies)',
  'Remover todas as seções': 'Remove all sections',
  'Tem certeza que deseja remover todas as seções?': 'Are you sure you want to remove all sections?',
  'Seção': 'Section',
  'Resumo de Competências': 'Competency Summary',
  'Gráfico de Defasagem (Gap)': 'Gap Chart',
  'Tabela de Consolidação': 'Consolidation Table',
  'Tabela por Competência': 'Table by Competency',
  'Pontos de Destaque': 'Highlights',
  'Customizado': 'Custom',
  'Desconhecido': 'Unknown',
  '{{count}} competência ativa': '{{count}} active competency',
  '{{count}} competências ativas': '{{count}} active competencies',
  '{{count}} seção ativa': '{{count}} active section',
  '{{count}} seções ativas': '{{count}} active sections',
  '{{count}} competência': '{{count}} competency',
  '{{count}} competências': '{{count}} competencies',
  'Selecione uma avaliação antes de exportar.': 'Select an assessment before exporting.',
  'Erro ao gerar PDF: {{message}}': 'Error generating PDF: {{message}}',
  'Nenhum relatório pôde ser capturado.': 'No report could be captured.',
  'Erro: {{message}}': 'Error: {{message}}',
  'erro desconhecido': 'unknown error',
  'desconhecido': 'unknown',
  'Padrão (Cinza)': 'Default (Gray)',
  'Azul Profissional': 'Professional Blue',
  'Verde Sucesso': 'Success Green',
  'Laranja Energia': 'Energy Orange',
  'Roxo Criativo': 'Creative Purple',
  'Vermelho Impacto': 'Impact Red',
  'Teal Moderno': 'Modern Teal',
  'Índigo Elegante': 'Elegant Indigo',
  'Coral & Rosê': 'Coral & Rose',
  'Dourado & Âmbar': 'Gold & Amber',
  'Esmeralda': 'Emerald',
  'Azul Marinho': 'Navy Blue',
  'Cinza Azulado': 'Blue Gray',
  'Categorias Distintas': 'Distinct Categories',
  'Personalizada': 'Custom',
  'Na página de Competências, selecione a mesma avaliação': 'On the Competencies page, select the same assessment',
  'crie ou edite os grupos de competências vinculando as perguntas do formulário, e clique em Salvar.':
    'create or edit competency groups by linking form questions, then click Save.',
};

const ES = {
  'Visual (Drag & Drop)': 'Visual (Arrastrar y Soltar)',
  'Clássico': 'Clásico',
  'Bloco de Texto': 'Bloque de Texto',
  'Barra Comparativa': 'Barra Comparativa',
  'Radar Comparativo': 'Radar Comparativo',
  'Pizza Comparativa': 'Pizza Comparativa',
  'Pizza Individual': 'Pizza Individual',
  'Barras Individuais': 'Barras Individuales',
  'Barras Comparativas': 'Barras Comparativas',
  'Personalização de Cores': 'Personalización de Colores',
  'Gráfico de Barras Comparativo:': 'Gráfico de Barras Comparativo:',
  'Cada categoria terá uma cor distinta para melhor visualização.': 'Cada categoría tendrá un color distinto para mejor visualización.',
  'A paleta "Categorias Distintas" é recomendada para este tipo de gráfico.': 'La paleta "Categorías Distintas" se recomienda para este tipo de gráfico.',
  'Gradientes': 'Gradientes',
  'Especiais': 'Especiales',
  'Mostrar pontuação sem autoavaliação': 'Mostrar puntuación sin autoevaluación',
  'Sobre Avaliações Mais Altas e Baixas': 'Sobre Evaluaciones Más Altas y Bajas',
  'Esta seção lista os comportamentos/perguntas com maior e menor pontuação média geral. Inclui todas as competências automaticamente.':
    'Esta sección lista los comportamientos/preguntas con mayor y menor puntuación media general. Incluye todas las competencias automáticamente.',
  'Adicionar seção abaixo': 'Agregar sección abajo',
  'Remover seção': 'Eliminar sección',
  'Visualizador ainda tem acesso': 'El visualizador aún tiene acceso',
  'O relatório consta como não publicado, mas o visualizador ainda consegue vê-lo. Clique em "Despublicar" para cortar o acesso.':
    'El informe consta como no publicado, pero el visualizador aún puede verlo. Haga clic en "Despublicar" para cortar el acceso.',
  'Alterações não publicadas': 'Cambios no publicados',
  'Você alterou o relatório desde a última publicação. Publique novamente para o visualizador ver as mudanças.':
    'Modificó el informe desde la última publicación. Publique nuevamente para que el visualizador vea los cambios.',
  'Republicar alterações': 'Republicar cambios',
  'Publicar relatório': 'Publicar informe',
  'Despublicar': 'Despublicar',
  'Template não configurado no projeto.': 'Plantilla no configurada en el proyecto.',
  'PDF e DOCX ficam indisponíveis até vincular um template na edição do projeto.':
    'PDF y DOCX no están disponibles hasta vincular una plantilla al editar el proyecto.',
  'Exportar PDF individual': 'Exportar PDF individual',
  'competência pronta': 'competencia lista',
  'competências prontas': 'competencias listas',
  'de {{total}} competência ativa': 'de {{total}} competencia activa',
  'de {{total}} competências ativas': 'de {{total}} competencias activas',
  'questão': 'pregunta',
  'questões': 'preguntas',
  'Configuração': 'Configuración',
  'Título da Seção': 'Título de la Sección',
  'Digite o título...': 'Escriba el título...',
  'Seção visível no relatório': 'Sección visible en el informe',
  'Quebras de página': 'Saltos de página',
  'Iniciar em nova página': 'Iniciar en nueva página',
  '(antes desta seção)': '(antes de esta sección)',
  'Forçar nova página após esta seção': 'Forzar nueva página después de esta sección',
  'Cor das Tabelas': 'Color de las Tablas',
  'Cor Sólida': 'Color Sólido',
  'Escolher cor': 'Elegir color',
  'Cor — Avaliações mais altas': 'Color — Evaluaciones más altas',
  'Cor — Avaliações mais baixas': 'Color — Evaluaciones más bajas',
  'Cor das Tabelas Detalhadas': 'Color de Tablas Detalladas',
  'Tipo de Gráfico': 'Tipo de Gráfico',
  'Paleta de Cores': 'Paleta de Colores',
  'Adicionar cor': 'Agregar color',
  'Remover': 'Eliminar',
  'Salvar Alterações': 'Guardar Cambios',
  'Cancelar': 'Cancelar',
  'Configurações do Documento': 'Configuración del Documento',
  'Recolher painel': 'Contraer panel',
  'Cabeçalho': 'Encabezado',
  'Rodapé': 'Pie de página',
  'Texto à esquerda': 'Texto a la izquierda',
  'Texto central': 'Texto central',
  'Cor': 'Color',
  'Ocultar': 'Ocultar',
  'Mostrar': 'Mostrar',
  'Duplicar': 'Duplicar',
  'Sem quebra de página antes': 'Sin salto de página antes',
  'Quebra de página após esta seção': 'Salto de página después de esta sección',
  'Clique para editar a paleta de cores': 'Haga clic para editar la paleta de colores',
  'competência(s)': 'competencia(s)',
  'Remover todas as seções': 'Eliminar todas las secciones',
  'Tem certeza que deseja remover todas as seções?': '¿Está seguro de que desea eliminar todas las secciones?',
  'Seção': 'Sección',
  'Resumo de Competências': 'Resumen de Competencias',
  'Gráfico de Defasagem (Gap)': 'Gráfico de Brecha',
  'Tabela de Consolidação': 'Tabla de Consolidación',
  'Tabela por Competência': 'Tabla por Competencia',
  'Pontos de Destaque': 'Puntos Destacados',
  'Customizado': 'Personalizado',
  'Desconhecido': 'Desconocido',
  '{{count}} competência ativa': '{{count}} competencia activa',
  '{{count}} competências ativas': '{{count}} competencias activas',
  '{{count}} seção ativa': '{{count}} sección activa',
  '{{count}} seções ativas': '{{count}} secciones activas',
  '{{count}} competência': '{{count}} competencia',
  '{{count}} competências': '{{count}} competencias',
  'Selecione uma avaliação antes de exportar.': 'Seleccione una evaluación antes de exportar.',
  'Erro ao gerar PDF: {{message}}': 'Error al generar PDF: {{message}}',
  'Nenhum relatório pôde ser capturado.': 'No se pudo capturar ningún informe.',
  'Erro: {{message}}': 'Error: {{message}}',
  'erro desconhecido': 'error desconocido',
  'desconhecido': 'desconocido',
  'Padrão (Cinza)': 'Predeterminado (Gris)',
  'Azul Profissional': 'Azul Profesional',
  'Verde Sucesso': 'Verde Éxito',
  'Laranja Energia': 'Naranja Energía',
  'Roxo Criativo': 'Púrpura Creativo',
  'Vermelho Impacto': 'Rojo Impacto',
  'Teal Moderno': 'Verde Azulado Moderno',
  'Índigo Elegante': 'Índigo Elegante',
  'Coral & Rosê': 'Coral y Rosa',
  'Dourado & Âmbar': 'Dorado y Ámbar',
  'Esmeralda': 'Esmeralda',
  'Azul Marinho': 'Azul Marino',
  'Cinza Azulado': 'Gris Azulado',
  'Categorias Distintas': 'Categorías Distintas',
  'Personalizada': 'Personalizada',
  'Na página de Competências, selecione a mesma avaliação': 'En la página de Competencias, seleccione la misma evaluación',
  'crie ou edite os grupos de competências vinculando as perguntas do formulário, e clique em Salvar.':
    'cree o edite grupos de competencias vinculando las preguntas del formulario y haga clic en Guardar.',
};

function merge(pathFile, manual) {
  const data = JSON.parse(fs.readFileSync(pathFile, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(manual)) {
    if (data[k] !== v) {
      data[k] = v;
      n++;
    }
  }
  const sorted = Object.keys(data)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
  fs.writeFileSync(pathFile, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  return n;
}

const ptPath = path.join(__dirname, '../src/assets/i18n/pt-BR.json');
const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
let ptN = 0;
for (const k of Object.keys(EN)) {
  if (pt[k] === undefined) {
    pt[k] = k;
    ptN++;
  }
}
fs.writeFileSync(
  ptPath,
  JSON.stringify(
    Object.keys(pt)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .reduce((acc, key) => {
        acc[key] = pt[key];
        return acc;
      }, {}),
    null,
    2
  ) + '\n',
  'utf8'
);

console.log('pt-BR added', ptN);
console.log('en updated', merge(path.join(__dirname, '../src/assets/i18n/en.json'), EN));
console.log('es updated', merge(path.join(__dirname, '../src/assets/i18n/es.json'), ES));
