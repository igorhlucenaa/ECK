const fs = require('fs');
const path = require('path');

async function generateFunctionsYaml() {
  const functionsDir = path.resolve(__dirname, '..');
  const loader = require(path.join(functionsDir, 'node_modules/firebase-functions/lib/runtime/loader.js'));
  const manifest = require(path.join(functionsDir, 'node_modules/firebase-functions/lib/runtime/manifest.js'));
  const outputPath = path.join(functionsDir, 'functions.yaml');

  const stack = await loader.loadStack(functionsDir);
  const wireSpec = manifest.stackToWire(stack);

  fs.writeFileSync(outputPath, `${JSON.stringify(wireSpec, null, 2)}\n`, 'utf8');
  console.log('functions.yaml atualizado com sucesso.');
}

generateFunctionsYaml().catch((error) => {
  console.error('Falha ao gerar functions.yaml:', error);
  process.exit(1);
});
