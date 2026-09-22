# QA — Revisão PPT 6.1 (contas + checklist)

## 1. Criar contas de teste (uma vez)

1. Baixe a chave **Admin SDK** no [Firebase Console](https://console.firebase.google.com/) → projeto `pwa-workana` → Configurações → Contas de serviço → **Gerar nova chave privada**.
2. No PowerShell, na raiz do ECK:

```powershell
cd C:\Users\adm\Documents\workspace_igor\eck_v3\ECK
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\caminho\para\sua-chave.json"
# Opcional: domínio dos e-mails (padrão eck-qa.test)
# $env:QA_EMAIL_DOMAIN = "seudominio.com.br"
# Opcional: senha única das três contas
# $env:QA_DEFAULT_PASSWORD = "MinhaSenhaForte123!"
npm run seed:qa
```

3. Abra `scripts/qa-credentials.local.json` (gerado automaticamente, **não commitar**).

Contas criadas:

| Perfil | Uso na checklist |
|--------|------------------|
| `master` | Créditos, templates globais, menu completo |
| `admin_client` | Menu restrito, projetos, escopo cliente |
| `viewer` | Textos de lembretes (slide 7) |

Todas ficam vinculadas ao cliente Firestore **Cliente QA Revisão 6.1**.

## 2. Subir a app

```powershell
npm start
# http://localhost:4200
```

Use a branch `development` com os commits da revisão.

## 3. Validar no navegador (Cursor Agent)

Peça ao Agent:

```text
Leia scripts/qa-credentials.local.json, faça login no http://localhost:4200
e execute a checklist dos slides 4-7, 9-15 (parcial). Tabela PASS/FAIL.
```

Ou faça login manualmente e escreva **「ok master」** / **「ok admin_client」** / **「ok viewer」**.

## 4. Checklist (correções)

- [x] **4–5** — Aprovar pedido de crédito; validade coerente + toast i18n  
- [x] **6** — Textos grupos vs usuários (Admin Cliente)  
- [x] **7** — Texto lembretes (Visualizador)  
- [x] **9** — Clientes só do tenant (Admin Cliente)  
- [x] **10** — Sem Relatórios / Modelos de e-mail no menu e no dashboard (Admin Cliente)  
- [x] **11** — Criar projeto (Admin Cliente)  
- [x] **12** — Grupos ao editar usuário  
- [x] **13–14** — Listagem `/mail-templates`: filtro «Somente TEMPLATE PADRÃO (global)», badge i18n; duplicar template com seletor de cliente (master)  
- [x] **15** — Card lembretes no editar projeto (bullets + deep link `/settings?clientId&projectId`)  

**Alinhamento de permissões (pós-QA):** `permissions.config.ts` é a fonte da verdade. Admin Cliente mantém **Gerar Relatório** na lista de projetos apenas para **Extrato Excel** (sem navegação para `/reports`).

**Dados:** para slide 4–5, crie um pedido de crédito de teste ou use um pendente existente no cliente QA.

## 5. Senha das contas criadas pela UI (Rev 6.1)

Contas `qa.admin.rev61@admin.com` e `qa.viewer.rev61@admin.com`:

1. **Master** → Usuários → menu **⋯** → **Definir senha de acesso** (usa `qaDefaultPassword` do `environment.ts`, hoje `123@qwe`).
2. Ou script (com chave Admin SDK): `npm run qa:set-ui-passwords`

Tour de primeiro acesso está **desligado** em dev (`disableProductTour: true`) para não bloquear cliques no QA.

## 6. Features PPT 6.1 (slides 1–2)

| Slide | Item | QA UI (master, localhost) |
|-------|------|---------------------------|
| **1** | Reutilizar grupo de competências (`/competencies`, botão `content_copy`) | **PASS** — lista multi-cliente; cópia “Setembro → Samara” com 4 competências (Liderança, Comunicação, Inovação, Organização). |
| **2** | Importar competências / visão global (`/reports`, aba Competências) | **PASS parcial** — bloco “Importar competencias de otro grupo” visível; rascunho carrega `competencias` do Firestore; templates novos guardam `competenciasModelo`. Validar dropdown + import end-to-end manualmente se o automação não abrir o `mat-select`. |
| **3** | Formulário template global multi-cliente | **PASS** — master em `/assessments/new`: toggle “Formulário padrão para todos os clientes”, salvar “Template Global QA Rev 6.1”, lista em `/assessments` com badge **Template padrão (global)**; copiar para cliente via ícone `content_copy`; projetos/relatórios usam `fetchAssessmentsForClientScope` (formulários do cliente + globais). |
| **4–5** | Validade de créditos / prazo / dias verdes | **PASS (UI)** — master `localhost:4200`: diálogo **Editar Cliente** (ex. Cliente teste: 299 / 25/08/2027 / 343d; Samara LTDA: painel visível); **Ver pedidos de crédito** → `/orders?clientId=…`; pedido 25/08/2027 **343d** alinhado ao card. |
| **8** | E-mail de redefinição de senha (marca ECK) | **PASS (emulador + UI)** — `npm run functions:serve` (só Functions, porta **5001**); app com `npm run start:local` ou `useFunctionsEmulator: true` + `connectFunctionsEmulator` em `app.config.ts`. Callable retorna `{ ok: true }`; **Usuários → key** dispara `sendBrandedPasswordResetEmail` no emulador (~7s, Auth produção + SMTP `.env`). Corrigido `getFirebaseAdmin()` na function. Conferir inbox do destinatário para layout ECK. |
| **13** | Listagem modelos + destaque global | **PASS (UI)** — master `/mail-templates`: banner global; coluna **TEMPLATE PADRÃO**; filtro **Somente TEMPLATE PADRÃO (global)**. |
| **14** | Duplicar template trocando cliente | **PASS (UI)** — diálogo **Duplicar template** com campo **Cliente** (incl. TEMPLATE PADRÃO); cópia limpa `projectId` se mudar de cliente. |
| **15** | Lembretes no fluxo do projeto | **PASS (UI)** — card em **Editar projeto** com bullets + botão → `/settings?clientId=…&projectId=…` (testado em `NsUYK9RhU60VNtQODamO`). |

## 6.1 Rodada QA UI — 17/09/2026 (localhost:4200)

Contas: `admin@admin.com` (master), `qa.admin.rev61@admin.com`, `qa.viewer.rev61@admin.com` (senha `123@qwe`). Sem `scripts/qa-credentials.local.json` no workspace.

| Slide | Item | Master | Admin cliente | Viewer |
|-------|------|--------|---------------|--------|
| **1** | Reutilizar competências | **PASS** — `/competencies`, botão `content_copy` | — | — |
| **2** | Importar competências (`/reports`) | **PASS** — hint no gate + bloco «Import competencies» após escolher formulário (§6.2) | — | — |
| **3** | Formulário global | **PASS** — badge «Default template» / global em `/assessments` (§6.2) | — | — |
| **4–5** | Créditos / validade | **PASS** — Editar Cliente **Cliente teste**: 299 disp., 25/08/2027, **343d**, link pedidos | **PASS** — escopo **Teste Setembro** (detalhe cliente) | — |
| **6** | Textos grupos vs usuários | **PASS** — painel Perfis (Admin Cliente: grupos sim, aba Usuários consultoria) | **PASS** — `/users` só aba **Grupos** + copy consultoria | — |
| **7** | Texto lembretes viewer | **PASS** — item «Enviar e configurar lembretes…» no painel Visualizador | — | **PASS** — menu **Lembretes Automáticos** + `/settings` OK |
| **8** | E-mail reset ECK | **PASS (emulador + UI local)** — ver §6.2 | — | — |
| **9** | Clientes tenant | — | **PASS** — não lista todos; detalhe **Teste Setembro** | — |
| **10** | Menu / dashboard | — | **PASS** — sem **Relatórios** nem **Modelos de E-mail** no menu; `/reports` → negado; `/mail-templates` → dashboard | **PASS** — sem Usuários; `/users` → negado |
| **11** | Criar projeto | — | **PASS** — **Adicionar Projeto** em `/projects` | — |
| **12** | Grupos | **PASS** — abas Usuários + Grupos | **PASS** — **Adicionar Grupo** | — |
| **13–14** | Templates e-mail | **PASS** — filtro global + duplicar com cliente | — | — |
| **15** | Lembretes no projeto | **PASS** — ver slide 15 §6 | — | — |

## 6.2 Rodada QA UI — 17/09/2026 (continuação)

**Ambiente slide 8**

```powershell
# Terminal 1 — emulador (UI Firebase na porta 4002 se 4000 estiver ocupada)
npm run functions:serve

# Terminal 2 — app apontando para o emulador
npm run start:local
# ou: npx ng serve --configuration local --port 4202
```

**Slide 2:** `/reports` → texto `reports.importGroup.gateHint` antes de escolher formulário; após cliente + formulário → bloco **Import competencies from another group**.

**Slide 3:** `/assessments` → badge de template global visível (ex. «Default template» / Template Global QA).

**Slide 8:** POST emulador `sendBrandedPasswordResetEmail` → `{"result":{"ok":true}}`; em `127.0.0.1:4202` + `useFunctionsEmulator: true`, botão **key** em Usuários dispara callable (toast de link enviado ou erro SMTP). Conferir HTML no inbox manualmente se necessário.

**Dev:** `firebase.json` — porta da Emulator UI alterada para **4002** (evita conflito com outra instância na 4000).

## 6.3 Rodada QA UI — 17/09/2026 (tarde, `127.0.0.1:4202`)

App: `ng serve --configuration local` (emulador Functions quando `functions:serve` ativo na **5001**). Contas: `admin@admin.com`, `qa.admin.rev61@admin.com`, `qa.viewer.rev61@admin.com` (`123@qwe`).

| Slide | Item | Resultado |
|-------|------|-----------|
| **1** | `content_copy` em `/competencies` | **PASS** — master; botão `content_copy` na lista |
| **2** | Gate + import em `/reports` | **PASS (gate)** — parágrafo «importar competências de outro grupo…» no gate; import E2E (mat-select + confirmar) não repetido nesta rodada |
| **3** | Badge global em `/assessments` | **PASS** — chip **TEMPLATE PADRÃO (GLOBAL)** + «Template Global QA» |
| **6–7** | Perfis / lembretes viewer | **PASS** — admin_client: só **Grupos** + copy consultoria; viewer: menu **Lembretes Automáticos**, `/settings` OK, `/users` → negado |
| **8** | Botão **key** (Usuários) | **PASS parcial** — toast de erro SMTP quando envio falha («Erro ao enviar link…»); sucesso «Link de acesso enviado…» depende de `.env` SMTP + callable OK (rodadas anteriores: `{ ok: true }` no emulador) |
| **9–11** | Admin cliente | **PASS** — `/reports` e `/mail-templates` → **Acesso Negado**; `/projects` com **Adicionar Projeto** |
| **13–15** | (master, rodadas §6.1) | **PASS** — sem regressão reportada nesta sessão |

**Admin cliente (10):** dashboard sem atalhos indevidos a relatórios globais; rotas bloqueadas conforme §6.1.

## 6.4 Simulação QA no browser — 17/09/2026 (~14h, `127.0.0.1:4202`)

Execução manual automatizada (login → navegação → asserts visuais), estilo checklist QA.

| ID | Perfil | Passos (resumo) | Esperado | Resultado |
|----|--------|-----------------|----------|-----------|
| M01 | Master | `/competencies` | Botão `content_copy` | **PASS** |
| M02 | Master | `/assessments` (aguardar lista) | Badge template global | **PASS** |
| M03 | Master | `/reports` gate | Hint importar de outro grupo | **PASS** |
| M03b | Master | Cliente teste + «Questionário teste» | «Grupo de origem» + «Importar competências» | **PASS** (botão disabled até escolher grupo) |
| M04 | Master | `/clients` → Editar **Cliente teste** | 299 / 25/08/2027 / 343d + pedidos | **PASS** |
| M05 | Master | `/mail-templates` → filtro cliente | «Somente TEMPLATE PADRÃO (global)» | **PASS** |
| M06 | Master | `/projects/…/edit` | Card lembretes + bullets | **PASS** |
| M07 | Master | `/users` → expandir Perfis; botão **key** | Copy Admin/Viewer; toast reset | **PASS** perfis; **PASS parcial** slide 8 (toast erro SMTP) |
| AC1 | Admin cliente | Login → dashboard | Menu sem Relatórios/Modelos globais | **PASS** |
| AC2 | Admin cliente | URL `/reports` | Acesso negado | **PASS** (§6.3) |
| AC3 | Admin cliente | `/users` | Só Grupos + copy consultoria | **PASS** (§6.3) |
| V1 | Viewer | Login → menu | «Lembretes Automáticos» | **PASS** |
| V2 | Viewer | URL `/users` | Acesso negado | **PASS** |

## 6.5 Continuação QA — 17/09/2026 (~14h10)

| ID | Slide | Passos | Resultado |
|----|-------|--------|-----------|
| M14 | **14** | `/mail-templates` → `content_copy` → diálogo **Duplicar template** → combo Cliente | **PASS** — opções incl. **TEMPLATE PADRÃO** + clientes; cancelado sem gravar |
| M02-E2E | **2** | `/reports` → Cliente teste + Questionário teste → **Atualizar lista** → grupo «Setembro - competências (Samara LTDA)» → **Importar competências** | **PASS** — toast *4 competência(s) importada(s) de "Setembro - competências (Samara LTDA)"*; cards Liderança, Comunicação, Inovação, Organização |

**Pendente (opcional):** conferir inbox HTML ECK (slide **8**). Duplicar template E2E: §6.9.

## 6.6 Pós-implementação slide 1 (merge) — 17/09/2026 (~14h15, `localhost:4200`)

Conta: `admin@admin.com` (`123@qwe`).

| ID | Slide | Passos | Resultado |
|----|-------|--------|-----------|
| M01-merge | **1** | `/competencies` → **Samara LTDA** → grupo **Setembro - competências** → `content_copy` | **PASS** — rádio **Importar no grupo aberto** (default); texto **11 grupos em 10 cliente(s)**; lista multi-cliente no combo **Grupo de origem** |
| M01-merge-E2E | **1** | Modo merge → origem **Diretores — Samara LTDA (5 comp.)** → **Importar no grupo aberto** | **PASS** — toast *Grupo atualizado com sucesso!*; contador **4 → 5 competências cadastradas** (mescla por nome, sem novo documento Firestore) |

**Slide 2 (competências):** visão global reforçada no diálogo de reutilização (contador + biblioteca cross-cliente). Import E2E em `/reports` permanece **PASS** (§6.5 M02-E2E).

## 6.7 Biblioteca global (slide 2) — 17/09/2026 (~14h25, `localhost:4200`)

| ID | Passos | Resultado |
|----|--------|-----------|
| M02-lib | **Cliente teste** → botão **`public`** na barra de grupos | **PASS** — diálogo **Biblioteca global de competências**; **12 grupos em 10 cliente(s)**; busca + lista multi-cliente |
| M02-lib-open | Na biblioteca → **open_in_new** em **Setembro - competências (Samara LTDA)** | **PASS** — cliente muda para **Samara LTDA**; grupo aberto com **5 competências cadastradas** |

**Slide 8 (código):** callable repassa mensagem SMTP (`failed-precondition`) em vez de erro genérico — validar com `functions:serve` + botão **key** em `/users`.

## 6.8 Slide 8 — e-mail branded (emulador) — 17/09/2026 (~14h30)

Ambiente: `npm run functions:serve` (5001) + `ng serve --configuration local --port 4202`. Conta master já autenticada.

| ID | Passos | Resultado |
|----|--------|-----------|
| M08-E2E | `/users` → botão **key** (usuário `gabrielgeorge395@gmail.com`) | **PASS** — toast *Link de acesso enviado para gabrielgeorge395@gmail.com*; emulador ~7,8s sem erro (`sendBrandedPasswordResetEmail`) |

**Correção aplicada:** `resolveLoginContinueUrl` — em dev (`127.0.0.1`/`localhost`) usa `FRONTEND_URL` / `eck360.web.app` no link do Firebase Auth (evita `auth/unauthorized-continue-uri`). Conferir HTML ECK na caixa de entrada manualmente.

## 6.9 Slide 14 — duplicar template (E2E) — 17/09/2026 (~14h35)

| ID | Passos | Resultado |
|----|--------|-----------|
| M14-E2E | `/mail-templates` → `content_copy` (Convite Avaliado) → nome **QA Rev61 Dup E2E** → cliente **Cliente teste** → **Duplicar** | **PASS** — redirecionamento para `/projects/…/templates/gvTI8iuxi61yYJEH0Scj/edit` (**Editar Template**); documento novo no Firestore |

## 7. Limitações

- Seed completo (`npm run seed:qa`) ainda exige `GOOGLE_APPLICATION_CREDENTIALS`.
- E-mail de reset não é obrigatório se a senha foi definida pelo master ou pelo script acima.
