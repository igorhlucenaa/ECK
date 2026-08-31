/**
 * Chaves de loading overlay / spinner
 */
const fs = require('fs');
const path = require('path');

const EN = {
  'Carregando...': 'Loading...',
  'Carregando configurações...': 'Loading settings...',
  'Carregando dados...': 'Loading data...',
  'Carregando projetos...': 'Loading projects...',
  'Carregando avaliações...': 'Loading assessments...',
  'Carregando dados da avaliação...': 'Loading assessment data...',
  'Processando dados da avaliação...': 'Processing assessment data...',
  'Gerando relatórios em ZIP...': 'Generating reports ZIP...',
  'Carregando documento...': 'Loading document...',
  'Carregando {{path}}...': 'Loading {{path}}...',
  'Salvando dados...': 'Saving data...',
  'Atualizando dados...': 'Updating data...',
  'Excluindo dados...': 'Deleting data...',
  'Carregando opções...': 'Loading options...',
  'Carregando histórico...': 'Loading history...',
  'Carregando usuário...': 'Loading user...',
  'Carregando grupo...': 'Loading group...',
  'Carregando grupos…': 'Loading groups…',
  'Carregando membros…': 'Loading members…',
  'Carregando dados do usuário…': 'Loading user data…',
  'Carregando dados do grupo…': 'Loading group data…',
};

const ES = {
  'Carregando...': 'Cargando...',
  'Carregando configurações...': 'Cargando configuraciones...',
  'Carregando dados...': 'Cargando datos...',
  'Carregando projetos...': 'Cargando proyectos...',
  'Carregando avaliações...': 'Cargando evaluaciones...',
  'Carregando dados da avaliação...': 'Cargando datos de la evaluación...',
  'Processando dados da avaliação...': 'Procesando datos de la evaluación...',
  'Gerando relatórios em ZIP...': 'Generando informes en ZIP...',
  'Carregando documento...': 'Cargando documento...',
  'Carregando {{path}}...': 'Cargando {{path}}...',
  'Salvando dados...': 'Guardando datos...',
  'Atualizando dados...': 'Actualizando datos...',
  'Excluindo dados...': 'Eliminando datos...',
  'Carregando opções...': 'Cargando opciones...',
  'Carregando histórico...': 'Cargando historial...',
  'Carregando usuário...': 'Cargando usuario...',
  'Carregando grupo...': 'Cargando grupo...',
  'Carregando grupos…': 'Cargando grupos…',
  'Carregando membros…': 'Cargando miembros…',
  'Carregando dados do usuário…': 'Cargando datos del usuario…',
  'Carregando dados do grupo…': 'Cargando datos del grupo…',
};

function merge(file, manual) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(manual)) {
    if (data[k] !== v) { data[k] = v; n++; }
  }
  const sorted = Object.keys(data).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .reduce((acc, k) => { acc[k] = data[k]; return acc; }, {});
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  return n;
}

const ptPath = path.join(__dirname, '../src/assets/i18n/pt-BR.json');
const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
let ptN = 0;
for (const k of Object.keys(EN)) {
  if (pt[k] === undefined) { pt[k] = k; ptN++; }
}
fs.writeFileSync(ptPath, JSON.stringify(Object.keys(pt).sort((a,b)=>a.localeCompare(b,'pt-BR')).reduce((a,k)=>(a[k]=pt[k],a),{}), null, 2) + '\n', 'utf8');

console.log('pt-BR added', ptN);
console.log('en updated', merge(path.join(__dirname, '../src/assets/i18n/en.json'), EN));
console.log('es updated', merge(path.join(__dirname, '../src/assets/i18n/es.json'), ES));
