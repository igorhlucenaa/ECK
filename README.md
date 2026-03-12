# ECK - Plataforma de Avaliação 360°

[![Angular](https://img.shields.io/badge/Angular-18-red.svg)](https://angular.io/)
[![Firebase](https://img.shields.io/badge/Firebase-Hosted-orange.svg)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)

Plataforma multi-tenant para avaliações 360° com gestão de clientes, projetos, participantes e envio de avaliações por e-mail.

---

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Executando o Projeto](#-executando-o-projeto)
- [Deploy](#-deploy)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Papéis de Usuário](#-papéis-de-usuário)
- [Coleções Firestore](#-coleções-firestore)
- [API - Cloud Functions](#-api---cloud-functions)
- [Licença](#-licença)

---

## ✨ Funcionalidades

- **Gestão de Clientes** – Multi-tenant com customização de tema por cliente
- **Projetos** – Criação e gestão de projetos de avaliação com prazos
- **Avaliações 360°** – Formulários dinâmicos com Survey.js
- **Participantes** – Avaliados e avaliadores com envio de links por e-mail
- **Relatórios** – Exportação em PDF, Excel e gráficos interativos
- **Competências** – Gestão de competências avaliadas
- **Templates de E-mail** – Editor visual com placeholders dinâmicos
- **Pedidos de Crédito** – Sistema de créditos para avaliações
- **Internacionalização** – pt-BR, es, en, fr, de

---

## 🛠 Tecnologias

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | Angular 18, Angular Material 18, SCSS |
| **Formulários** | Survey.js, Formly, TinyMCE |
| **Gráficos** | ECharts, Plotly, ApexCharts |
| **Backend** | Firebase Auth, Firestore |
| **Cloud Functions** | Node.js 20, TypeScript, Nodemailer |
| **Deploy** | Firebase Hosting |

---

## 📦 Pré-requisitos

- **Node.js** 20 ou superior
- **npm** 9 ou superior
- **Angular CLI** 18 (`npm install -g @angular/cli@18`)
- **Firebase CLI** (`npm install -g firebase-tools`)
- Conta no [Firebase](https://console.firebase.google.com/)
- Conta Gmail com [Senha de App](https://support.google.com/accounts/answer/185833) (para envio de e-mails)

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/ECK.git
cd ECK
```

### 2. Instale as dependências do projeto principal

```bash
npm install
```

### 3. Instale as dependências das Cloud Functions

```bash
cd functions
npm install
cd ..
```

---

## ⚙️ Configuração

### Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative **Authentication** (método E-mail/Senha)
3. Crie um banco **Firestore**
4. Configure o **Hosting** (opcional para desenvolvimento)

### Variáveis de ambiente

#### Frontend (`src/enviroments/`)

Edite `environment.ts` e `environment.prod.ts` com as credenciais do seu projeto Firebase:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'SUA_API_KEY',
    authDomain: 'seu-projeto.firebaseapp.com',
    databaseURL: 'https://seu-projeto.firebaseio.com',
    projectId: 'seu-projeto-id',
    storageBucket: 'seu-projeto.firebasestorage.app',
    messagingSenderId: 'SEU_SENDER_ID',
    appId: 'SEU_APP_ID',
  },
  functions: {
    sendEmailUrl: 'https://us-central1-seu-projeto.cloudfunctions.net/sendEmail',
  },
};
```

#### Cloud Functions (`functions/.env`)

Crie o arquivo `functions/.env` com as credenciais de e-mail (Gmail):

```env
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-senha-de-app
```

> ⚠️ **Importante:** Use uma [Senha de App do Gmail](https://support.google.com/accounts/answer/185833), não a senha normal da conta.
>
> 🔒 **Segurança:** Adicione `functions/.env` ao `.gitignore` para não versionar credenciais.

#### Parâmetros do Firebase (alternativa ao .env)

Para produção, configure os parâmetros no Firebase:

```bash
firebase functions:config:set email.user="seu-email@gmail.com" email.pass="sua-senha-de-app"
```

---

## ▶️ Executando o Projeto

### Desenvolvimento (frontend)

```bash
npm start
```

Acesse: [http://localhost:4200](http://localhost:4200)

### Build de produção

```bash
npm run build
```

O build será gerado em `dist/Materialpro/`.

### Emulador das Cloud Functions (opcional)

```bash
cd functions
npm run serve
```

---

## 🚢 Deploy

### Deploy completo (Hosting + Functions)

```bash
# Build do Angular
npm run build

# Deploy
firebase deploy
```

### Deploy apenas do Hosting

```bash
npm run build
firebase deploy --only hosting
```

### Deploy apenas das Functions

```bash
cd functions
npm run deploy
```

### Configuração do Firebase (`firebase.json`)

O projeto está configurado para:

- **Hosting:** site `eck360`, pasta `dist/Materialpro`
- **Functions:** pasta `functions/`
- **SPA:** rewrites para `index.html`

---

## 📁 Estrutura do Projeto

```
ECK/
├── src/
│   ├── app/
│   │   ├── layouts/          # Layouts (blank, full)
│   │   ├── pages/             # Módulos de funcionalidade
│   │   ├── services/          # Serviços compartilhados
│   │   ├── guards/            # AuthGuard (controle de acesso)
│   │   ├── interceptors/      # Loading, Firestore
│   │   └── components/        # Componentes reutilizáveis
│   ├── assets/                # Imagens, i18n, temas
│   └── enviroments/           # environment.ts, environment.prod.ts
├── functions/                  # Cloud Functions
│   └── src/
│       └── index.ts           # sendEmail
├── collections/               # Dados seed/export Firestore
│   ├── users.json
│   ├── clients.json
│   ├── projects.json
│   ├── participants.json
│   ├── assessments.json
│   ├── mailTemplates.json
│   └── ...
├── angular.json
├── firebase.json
└── package.json
```

---

## 👥 Papéis de Usuário

| Papel | Descrição | Acesso |
|-------|-----------|--------|
| **admin_master** | Administrador geral | Clientes, projetos, templates de e-mail, todas as funcionalidades |
| **admin_client** | Administrador do cliente | Projetos, avaliações, relatórios, usuários do próprio cliente |
| **viewer** | Visualizador | Apenas leitura em avaliações e relatórios |

---

## 🗄 Coleções Firestore

| Coleção | Descrição |
|---------|-----------|
| `users` | Usuários, roles, clientId |
| `clients` | Clientes, tema (themeColor) |
| `projects` | Projetos, prazos (deadline) |
| `participants` | Participantes (avaliado/avaliador), assessmentLinks |
| `assessments` | Definições de avaliação |
| `forms` | Definições de formulários |
| `mailTemplates` | Templates de e-mail (JSON) |
| `assessmentLinks` | Tokens de links de avaliação |
| `reportTemplates` | Templates de relatório |
| `userGroups` | Grupos de usuários |
| `creditOrders` | Pedidos de crédito |

---

## 📡 API - Cloud Functions

### `sendEmail` (HTTP)

Envia e-mail com template personalizado e link de avaliação.

**URL:** `POST https://us-central1-SEU_PROJETO.cloudfunctions.net/sendEmail`

**Body (JSON):**

```json
{
  "email": "destinatario@exemplo.com",
  "templateId": "ID_DO_TEMPLATE",
  "participantId": "ID_DO_PARTICIPANTE",
  "assessmentId": "ID_DA_AVALIACAO",
  "evaluatedParticipantId": "ID_DO_AVALIADO"
}
```

**Placeholders nos templates:**

| Placeholder | Descrição |
|-------------|-----------|
| `$%NOME_DO_AVALIADO$%` | Nome da pessoa sendo avaliada |
| `$%NOME_DO_PARTICIPANTE$%` | Nome do participante (avaliador) |
| `$%DATA DE EXPIRAÇÃO DO PROJETO$%` | Data limite do projeto |
| `[LINK_AVALIACAO]` | Link para preencher a avaliação |
| `[LINK_RELATORIO]` | Link do relatório (se disponível) |

---

## 🔗 Rotas Principais

| Rota | Descrição | Papel |
|------|------------|-------|
| `/assessment` | Formulário público de avaliação (token) | Público |
| `/authentication/login` | Login | Público |
| `/dashboard` | Dashboard | admin_master, admin_client |
| `/clients` | Gestão de clientes | admin_master |
| `/projects` | Projetos | admin_client |
| `/assessments` | Avaliações, participantes, exportação | admin_master, admin_client, viewer |
| `/reports` | Relatórios | admin_master, admin_client, viewer |
| `/competencies` | Competências | admin_master, admin_client |
| `/users` | Usuários e grupos | admin_master, admin_client |
| `/mail-templates` | Templates de e-mail | admin_master |

---

## 📄 Licença

Este projeto é privado. Todos os direitos reservados.
