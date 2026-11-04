/**
 * Smoke HTTP: rotas públicas/protegidas (sem auth cookie — só status/redirect).
 * Complementa testes no browser autenticado.
 */
const base = 'http://localhost:4200';
const routes = [
  '/authentication/login',
  '/authentication/side-register',
  '/authentication/side-forgot-pwd',
  '/dashboard',
  '/clients',
  '/projects',
  '/reports',
  '/competencies',
  '/assessments/participants',
  '/mail-templates',
  '/orders',
  '/users',
  '/emails-notifications',
  '/settings',
  '/nao-autorizado',
  '/assessment',
];

for (const path of routes) {
  try {
    const res = await fetch(base + path, { redirect: 'manual' });
    console.log(`${res.status}\t${path}`);
  } catch (e) {
    console.log(`ERR\t${path}\t${e.message}`);
  }
}
