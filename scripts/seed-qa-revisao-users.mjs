/**
 * Cria contas QA (Firebase Auth + Firestore) para validar revisão PPT 6.1.
 *
 * Pré-requisito: chave de conta de serviço (Admin SDK)
 *   Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada
 *
 * Uso (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\caminho\pwa-workana-firebase-adminsdk.json"
 *   $env:QA_DEFAULT_PASSWORD = "SuaSenhaForte123!"   # opcional
 *   node scripts/seed-qa-revisao-users.mjs
 *
 * Saída: scripts/qa-credentials.local.json (gitignored) + resumo no console
 */

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'));

const PROJECT_ID = 'pwa-workana';
const TAG = 'revisao-6.1';
const DOMAIN = process.env.QA_EMAIL_DOMAIN || 'eck-qa.test';
const PASSWORD = process.env.QA_DEFAULT_PASSWORD || `EckQa_${TAG}_2026!`;

const ACCOUNTS = [
  { key: 'master', role: 'admin_master', localPart: `eck-qa-master-${TAG}` },
  { key: 'admin_client', role: 'admin_client', localPart: `eck-qa-admin-${TAG}` },
  { key: 'viewer', role: 'viewer', localPart: `eck-qa-viewer-${TAG}` },
];

function emailFor(localPart) {
  return `${localPart}@${DOMAIN}`.toLowerCase();
}

async function getOrCreateAuthUser(auth, email, displayName) {
  try {
    return await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }
  return auth.createUser({
    email,
    password: PASSWORD,
    emailVerified: true,
    displayName,
    disabled: false,
  });
}

async function ensureQaClient(db) {
  const name = 'Cliente QA Revisão 6.1';
  const snap = await db.collection('clients').where('companyName', '==', name).limit(1).get();
  if (!snap.empty) {
    return snap.docs[0].id;
  }
  const ref = await db.collection('clients').add({
    companyName: name,
    cnpj: '',
    sector: 'QA',
    credits: 100,
    remainingCredits: 100,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function upsertFirestoreUser(db, authUser, role, clientId) {
  const email = authUser.email;
  const emailLower = email.toLowerCase();
  const snap = await db.collection('users').where('emailLower', '==', emailLower).limit(1).get();

  const base = {
    name: 'QA',
    surname: role.replace('_', ' '),
    email,
    emailLower,
    role,
    status: 'active',
    groups: [],
    projects: [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (role === 'admin_master') {
    base.clients = clientId ? [clientId] : [];
    base.client = clientId || '';
  } else {
    base.clients = [clientId];
    base.client = clientId;
  }

  if (snap.empty) {
    base.createdAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('users').add(base);
    return 'created';
  }

  await snap.docs[0].ref.update(base);
  return 'updated';
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      '\n❌ Defina GOOGLE_APPLICATION_CREDENTIALS com o JSON da conta de serviço (Admin SDK).\n'
    );
    process.exit(1);
  }

  admin.initializeApp({ projectId: PROJECT_ID });
  const auth = admin.auth();
  const db = admin.firestore();

  const clientId = await ensureQaClient(db);
  console.log(`\n✓ Cliente QA: ${clientId}\n`);

  const credentials = {
    projectId: PROJECT_ID,
    clientId,
    password: PASSWORD,
    accounts: {},
    createdAt: new Date().toISOString(),
  };

  for (const spec of ACCOUNTS) {
    const email = emailFor(spec.localPart);
    const displayName = `QA ${spec.role}`;
    const authUser = await getOrCreateAuthUser(auth, email, displayName);
    if (authUser) {
      await auth.updateUser(authUser.uid, { password: PASSWORD, disabled: false });
    }
    const action = await upsertFirestoreUser(db, authUser, spec.role, clientId);
    credentials.accounts[spec.key] = { email, role: spec.role, firestore: action };
    console.log(`✓ ${spec.role}: ${email} (${action})`);
  }

  const outPath = join(__dirname, 'qa-credentials.local.json');
  writeFileSync(outPath, JSON.stringify(credentials, null, 2), 'utf8');
  console.log(`\n📄 Credenciais salvas em: ${outPath}`);
  console.log('   (arquivo gitignored — use no login local http://localhost:4200)\n');
}

main().catch((err) => {
  console.error('\n❌ Falha no seed:', err.message || err);
  process.exit(1);
});
