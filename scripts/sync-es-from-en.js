/**
 * Propaga traduções EN -> ES para chaves onde ES ainda = PT mas EN já traduzido.
 * Uso: node scripts/sync-es-from-en.js
 */
const fs = require('fs');
const path = require('path');

const pt = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/assets/i18n/pt-BR.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/assets/i18n/en.json'), 'utf8'));
let es = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/assets/i18n/es.json'), 'utf8'));

/** Mapas manuais EN->ES para termos comuns quando EN existe mas ES não */
const EN_TO_ES = {
  'Add': 'Agregar',
  'Edit': 'Editar',
  'Delete': 'Eliminar',
  'Save': 'Guardar',
  'Cancel': 'Cancelar',
  'Close': 'Cerrar',
  'Search': 'Buscar',
  'Loading': 'Cargando',
  'Error': 'Error',
  'Success': 'Éxito',
  'Report': 'Informe',
  'Reports': 'Informes',
  'Assessment': 'Evaluación',
  'Project': 'Proyecto',
  'Client': 'Cliente',
  'User': 'Usuario',
  'Template': 'Plantilla',
  'Export': 'Exportar',
  'Import': 'Importar',
  'Settings': 'Configuración',
  'Dashboard': 'Panel',
  'Competency': 'Competencia',
  'Competencies': 'Competencias',
  'Preview': 'Vista previa',
  'Publish': 'Publicar',
  'Unpublish': 'Despublicar',
  'Draft': 'Borrador',
  'Section': 'Sección',
  'Sections': 'Secciones',
  'Chart': 'Gráfico',
  'Charts': 'Gráficos',
  'Table': 'Tabla',
  'Tables': 'Tablas',
  'Color': 'Color',
  'Colors': 'Colores',
  'Active': 'Activo',
  'Inactive': 'Inactivo',
  'All': 'Todos',
  'None': 'Ninguno',
  'Yes': 'Sí',
  'No': 'No',
};

function roughEnToEs(enVal) {
  if (!enVal || enVal === enVal.toUpperCase()) return enVal;
  let out = enVal;
  for (const [from, to] of Object.entries(EN_TO_ES)) {
    out = out.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  return out;
}

let n = 0;
for (const key of Object.keys(pt)) {
  if (es[key] !== key) continue; // já traduzido
  if (en[key] && en[key] !== key) {
    es[key] = roughEnToEs(en[key]);
    n++;
  }
}

const sorted = Object.keys(es)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  .reduce((acc, k) => {
    acc[k] = es[k];
    return acc;
  }, {});

fs.writeFileSync(path.join(__dirname, '../src/assets/i18n/es.json'), JSON.stringify(sorted, null, 2) + '\n', 'utf8');
console.log('es synced from en:', n);
