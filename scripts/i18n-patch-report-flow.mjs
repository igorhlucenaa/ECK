import fs from 'fs';

const enPatch = {
  'Continuar para Montar': 'Continue to build report',
  'Competências carregadas. Avance para montar o relatório ou aplicar um template.':
    'Competencies loaded. Continue to build the report or apply a template.',
  'Você veio da tela de Relatórios': 'You came from the Reports screen',
  'Após salvar o grupo, use o botão ao lado para voltar ao mesmo cliente, avaliação e aba — sem recomeçar do zero.':
    'After saving the group, use the button beside it to return to the same client, assessment, and tab — without starting over.',
  'Após salvar em Competências, use o botão «Voltar para Relatórios» no topo daquela página — cliente, avaliação e aba serão restaurados automaticamente.':
    'After saving in Competencies, use the «Back to Reports» button at the top of that page — client, assessment, and tab will be restored automatically.',
  'Gerando relatório PDF...': 'Generating PDF report...',
  'Este projeto não possui template de relatório vinculado. Configure um template na edição do projeto.':
    'This project has no linked report template. Configure a template when editing the project.',
  'Os dados do relatório ainda não carregaram. Tente novamente em instantes.':
    'Report data has not loaded yet. Please try again in a moment.',
  'Este projeto não possui template de relatório vinculado. Edite o projeto e selecione um template.':
    'This project has no linked report template. Edit the project and select a template.',
  'Tem certeza de que deseja excluir o grupo {{name}}?': 'Are you sure you want to delete the group {{name}}?',
};

const esPatch = {
  'Continuar para Montar': 'Continuar para montar el informe',
  'Competências carregadas. Avance para montar o relatório ou aplicar um template.':
    'Competencias cargadas. Avance para armar el informe o aplicar una plantilla.',
  'Você veio da tela de Relatórios': 'Llegó desde la pantalla de Informes',
  'Após salvar o grupo, use o botão ao lado para voltar ao mesmo cliente, avaliação e aba — sem recomeçar do zero.':
    'Después de guardar el grupo, use el botón al lado para volver al mismo cliente, evaluación y pestaña, sin empezar de cero.',
  'Após salvar em Competências, use o botão «Voltar para Relatórios» no topo daquela página — cliente, avaliação e aba serão restaurados automaticamente.':
    'Después de guardar en Competencias, use el botón «Volver a Informes» en la parte superior de esa página; cliente, evaluación y pestaña se restaurarán automáticamente.',
  'Gerando relatório PDF...': 'Generando informe PDF...',
  'Este projeto não possui template de relatório vinculado. Configure um template na edição do projeto.':
    'Este proyecto no tiene plantilla de informe vinculada. Configure una plantilla al editar el proyecto.',
  'Os dados do relatório ainda não carregaram. Tente novamente em instantes.':
    'Los datos del informe aún no se cargaron. Inténtelo de nuevo en unos instantes.',
  'Este projeto não possui template de relatório vinculado. Edite o projeto e selecione um template.':
    'Este proyecto no tiene plantilla de informe vinculada. Edite el proyecto y seleccione una plantilla.',
  'Tem certeza de que deseja excluir o grupo {{name}}?':
    '¿Está seguro de que desea eliminar el grupo {{name}}?',
};

const orphanKeys = [
  'Grupo ',
  'Nenhuma competência encontrada para o grupo ',
  'Tem certeza de que deseja excluir o grupo ',
  'Tem certeza de que deseja excluir o grupo \\',
  'Tem certeza de que deseja excluir o usuário ',
  'Tem certeza de que deseja excluir o grupo "{{name}}"?',
];

function patch(path, patchMap) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const [k, v] of Object.entries(patchMap)) {
    if (k in data) data[k] = v;
  }
  for (const k of orphanKeys) delete data[k];
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

patch('src/assets/i18n/en.json', enPatch);
patch('src/assets/i18n/es.json', esPatch);
for (const p of ['src/assets/i18n/pt-BR.json', 'src/assets/i18n/en.json', 'src/assets/i18n/es.json']) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const k of orphanKeys) delete data[k];
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
console.log('Patched report-flow translations and removed orphan keys.');
