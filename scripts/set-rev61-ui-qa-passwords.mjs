/**
 * Define senha Auth para contas criadas pela UI (revisão 6.1).
 * Requer: GOOGLE_APPLICATION_CREDENTIALS apontando para a chave Admin SDK.
 *
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\caminho\pwa-workana-adminsdk.json"
 *   $env:QA_UI_PASSWORD = "123@qwe"
 *   node scripts/set-rev61-ui-qa-passwords.mjs
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'));

const PASSWORD = process.env.QA_UI_PASSWORD || '123@qwe';
const EMAILS = [
  'qa.admin.rev61@admin.com',
  'qa.viewer.rev61@admin.com',
];

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS com a chave Admin SDK.');
  process.exit(1);
}

admin.initializeApp({ projectId: 'pwa-workana' });
const auth = admin.auth();

for (const email of EMAILS) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: PASSWORD, disabled: false });
    console.log('OK', email);
  } catch (e) {
    console.error('FAIL', email, e.message || e);
  }
}
