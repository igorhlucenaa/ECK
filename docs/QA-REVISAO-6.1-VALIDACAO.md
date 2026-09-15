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
- [x] **13–14** — Templates globais + alterar cliente no form (master); rotas `default-template/*` só master  
- [x] **15** — Atalho lembretes no detalhe do projeto  

**Alinhamento de permissões (pós-QA):** `permissions.config.ts` é a fonte da verdade. Admin Cliente mantém **Gerar Relatório** na lista de projetos apenas para **Extrato Excel** (sem navegação para `/reports`).

**Dados:** para slide 4–5, crie um pedido de crédito de teste ou use um pendente existente no cliente QA.

## 5. Senha das contas criadas pela UI (Rev 6.1)

Contas `qa.admin.rev61@admin.com` e `qa.viewer.rev61@admin.com`:

1. **Master** → Usuários → menu **⋯** → **Definir senha de acesso** (usa `qaDefaultPassword` do `environment.ts`, hoje `123@qwe`).
2. Ou script (com chave Admin SDK): `npm run qa:set-ui-passwords`

Tour de primeiro acesso está **desligado** em dev (`disableProductTour: true`) para não bloquear cliques no QA.

## 6. Limitações

- Seed completo (`npm run seed:qa`) ainda exige `GOOGLE_APPLICATION_CREDENTIALS`.
- E-mail de reset não é obrigatório se a senha foi definida pelo master ou pelo script acima.
