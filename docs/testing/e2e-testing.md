### Guia de Testes End-to-End (E2E) — ECK

Este guia explica como testar, ponta a ponta, os principais fluxos do app ECK (Angular + Firebase). Foca em testes manuais reproduzíveis e confiáveis em ambiente local. Se você usa uma ferramenta E2E (ex.: Cypress/Playwright), adapte os passos abaixo em specs automatizadas.

---

## 1) Pré‑requisitos
- Node.js 18+ e npm
- Angular CLI instalado globalmente: `npm i -g @angular/cli`
- Conta Firebase com acesso ao projeto `pwa-workana`
- Chrome/Edge atualizado

Opcional para mock local:
- Firebase CLI: `npm i -g firebase-tools`
- Emuladores Firebase (Functions/Auth/Firestore) se desejar isolar do ambiente real

---

## 2) Setup do projeto
1. Instalar dependências
   - Na raiz do projeto: `npm ci` (ou `npm install`)
   - Em `functions/`: `npm ci`
2. Variáveis/Ambiente
   - O app usa `src/enviroments/environment.ts` apontando para `pwa-workana`.
   - Para emuladores, configure `firebase.json` e `firebase emulators:start` conforme sua necessidade.
3. Subir a aplicação
   - `npm start`
   - Acesse `http://localhost:4200`

---

## 3) Perfis e permissões
Os guards e rotas exigem papéis específicos:
- admin_master: gestão global (ex.: `clients`, `dashboard`)
- admin_client: gestão do cliente (ex.: `projects`, `assessments`)
- viewer: acesso de leitura (ex.: `reports`)

Garanta que o usuário autenticado possua o papel adequado nos dados (coleção `users`).

---

## 4) Fluxos E2E a validar
Execute os fluxos na ordem; cada fluxo indica entradas, passos e critérios de aceite.

### 4.1 Login (Authentication)
Entrada: usuário válido (email/senha) com papel conhecido.
Passos:
1. Acesse `/authentication/login`.
2. Informe credenciais válidas.
3. Verifique redirecionamento para `/dashboard` quando autenticado.
Aceite:
- Sem erros na console.
- Guard permite rota autorizada e bloqueia rotas sem permissão.

### 4.2 Clientes (apenas admin_master)
Passos:
1. Acesse `/clients`.
2. Liste clientes e abra um cliente.
3. Acesse `/clients/:id/customization` e salve uma alteração visual simples.
Aceite:
- Lista carrega com dados.
- Customização persiste e reflete em páginas relacionadas.

### 4.3 Projetos (admin_client)
Passos:
1. Acesse `/projects`.
2. Crie projeto via `/projects/new` com dados mínimos.
3. Edite via `/projects/:id/edit` e salve.
4. Gerencie usuários em `/projects/:id/users` (adicionar/remover).
5. Template de e‑mail: `/projects/:id/templates` (criar/editar).
Aceite:
- CRUD funciona e dados aparecem após refresh.

### 4.4 Questionários (admin_client)
Passos:
1. Acesse `/projects/:id/questionnaires`.
2. Crie via `/projects/:id/questionnaires/new`.
3. Edite e faça preview `/projects/:id/questionnaires/:questionnaireId/preview`.
Aceite:
- Preview renderiza sem erros; alterações persistem.

### 4.5 Avaliações (assessments)
Passos:
1. Acesse `/assessments`.
2. Crie avaliação em `/assessments/new`.
3. Faça upload de avaliados/avaliadores em `/assessments/upload`.
4. Acompanhe dashboard em `/assessments/dashboard`.
5. Gerencie participantes em `/assessments/participants` (status, reenvio).
Aceite:
- Estados dos participantes atualizam corretamente; dashboard reflete dados.

### 4.6 Envio de e‑mails (Functions)
Entrada: função HTTP `sendEmail` em produção ou emulador.
Passos:
1. Dispare um envio onde o app o suporta (ex.: convites/reenvio).
2. Valide que não há erro HTTP; checar logs (Functions/emulador).
Aceite:
- Resposta 2xx; logs sem exceptions.

### 4.7 Relatórios (Reports)
Referência: `FLUXO_GERACAO_RELATORIOS.md`.
Passos:
1. Com participantes respondidos, acesse fluxo de geração via projeto.
2. Escolha template, competências e gere PDF.
3. Em `/reports`, valide abas: Visão Geral, Competências, Configurar, Visualizar, Dados Brutos.
4. Exporte PDF/Excel e relatório individual.
Aceite:
- Arquivos baixados, conteúdo consistente com filtros/seleções.

### 4.8 Pedidos de crédito (admin_master/admin_client)
Passos:
1. Acesse `/orders` e confira lista.
2. Crie novo em `/orders/new` e finalize.
Aceite:
- Pedido aparece na lista; dados persistem.

### 4.9 Usuários (admin_master/admin_client)
Passos:
1. Acesse `/users`.
2. Crie/edite usuário e defina papel.
Aceite:
- Papel correto influencia acesso às rotas protegidas.

---

## 5) Dados de teste
- Use as coleções em `collections/*.json` como referência de estrutura: `projects.json`, `assessments.json`, `participants.json`, `users.json`, etc.
- Garanta ao menos um participante com status "Respondido" para testes de relatórios.

---

## 6) Critérios gerais de aceite
- Navegação protegida pelos guards conforme `app.routes.ts` e rotas filhas.
- Sem erros no console, UI responsiva e carregamentos cobertos pelo loading global.
- Operações CRUD refletem no estado e após recarregar a página.
- Exports (PDF/Excel) geram arquivos válidos.

---

## 7) Troubleshooting
- Sem botão "Gerar Relatório": participante não respondido.
- Falha no PDF/Excel: reduzir escopo (competências) e tentar novamente.
- Erros HTTP: verificar `environment.ts` e credenciais Firebase.
- Acesso negado: revisar papel do usuário (`users`), e dados `data.role` nas rotas.
- Lento/carregando: validar interceptors de loading e rede.

---

## 8) Checklist rápido (smoke E2E)
- Login ok e redireciona ao `/dashboard`.
- CRUD básico de `projects`, `users`, `questionnaires`.
- Upload/participants e dashboard de `assessments` atualizam.
- Envio de e‑mail retorna 2xx.
- Relatórios geram e exportam.

---

## 9) Automação (opcional)
Caso adote Cypress/Playwright:
- Setup: instalar dependência, configurar baseUrl `http://localhost:4200`.
- Criar comandos para login (preservar sessão) e seeds via emuladores.
- Converter cada fluxo da seção 4 em testes (smoke/regressão), isolando dados com fixtures.

---

Última revisão: preencher data ao atualizar este guia.


