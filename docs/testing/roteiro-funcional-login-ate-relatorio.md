### Roteiro Funcional: do Login à Geração de Relatório (ECK)

Este documento ensina, de forma simples e objetiva, como usar o ECK do zero: criar cliente, cadastrar usuários e papéis, criar projeto, questionário, avaliação, adicionar participantes, coletar respostas e gerar/exportar relatórios.

---

## 1) Para quem é este roteiro
- Usuários que precisam gerar relatórios de avaliação 360° no ECK.
- Não é necessário conhecimento técnico.

---

## 2) Pré‑requisitos rápidos
- Ter um usuário (e‑mail e senha) com acesso ao sistema.
- Ter perfil com permissões adequadas (ver seção Papéis).
- Para gerar relatórios: ter participantes com status Respondido.

Se sua organização é nova no ECK, siga as seções 4 a 10 para preparar tudo do zero.

---

## 3) Acessar o sistema (Login)
1. Abra o navegador e acesse a página inicial do ECK.
2. Vá para Login: caminho de menu "Autenticação" ou rota `/authentication/login`.
3. Informe seu e‑mail e senha e clique em Entrar.
4. Após o login, você será redirecionado ao Dashboard.

Se aparecer mensagem de acesso negado, procure um administrador para ajustar seu perfil.

---

## 4) Papéis e permissões (importante)
- admin_master: gestão global (ex.: `clients`, `users`, visão geral)
- admin_client: gestão do cliente (ex.: `projects`, `assessments`)
- viewer: leitura (ex.: `reports`)

Você precisará de `admin_master` para criar clientes e usuários, e de `admin_client` para projeto/avaliação.

---

## 5) Criar Cliente (admin_master)
1. Acesse `/clients`.
2. Clique em Adicionar Cliente.
3. Preencha nome, dados de contato e salve.
4. (Opcional) Customize em `/clients/:id/customization` e salve.

Critério de sucesso: cliente aparece na lista e customizações persistem.

---

## 6) Cadastrar Usuários e Papéis (admin_master/admin_client)
1. Acesse `/users`.
2. Clique em Novo Usuário.
3. Preencha nome, e‑mail e defina o papel (admin_master, admin_client, viewer).
4. Salve e confirme que o usuário aparece na lista.

Dica: usuários com `admin_client` gerenciarão projetos e avaliações do cliente.

---

## 7) Criar Projeto (admin_client)
1. Acesse `/projects`.
2. Clique em Novo (`/projects/new`).
3. Informe nome do projeto, cliente relacionado e datas relevantes.
4. Salve. O projeto aparecerá na lista.
5. (Opcional) Gerencie usuários do projeto em `/projects/:id/users`.
6. (Opcional) Crie/edite templates de e‑mail em `/projects/:id/templates`.

Critério de sucesso: projeto salvo e acessível para edição.

---

## 8) Criar Questionário (admin_client)
1. No projeto, vá em Questionários: `/projects/:id/questionnaires`.
2. Clique em Novo (`/projects/:id/questionnaires/new`).
3. Defina título, competências e perguntas (fechadas/abertas conforme necessidade).
4. Salve e faça Preview: `/projects/:id/questionnaires/:questionnaireId/preview`.

Critério de sucesso: preview renderiza corretamente; conteúdo salvo.

---

## 9) Criar Avaliação (admin_client)
1. Acesse `/assessments` e clique em Nova (`/assessments/new`).
2. Relacione o projeto e selecione o questionário.
3. Configure regras de avaliação (se aplicável) e salve.

Critério de sucesso: avaliação criada e visível na lista/painéis.

---

## 10) Adicionar Participantes (admin_client)
Opção A — Upload em lote:
1. Acesse `/assessments/upload`.
2. Baixe o modelo (se disponível), preencha avaliados/avaliadores e importe.

Opção B — Gestão manual:
1. Acesse `/assessments/participants`.
2. Adicione participantes individualmente, definindo papel (avaliado/avaliador).

Após adicionar, valide se todos os avaliados possuem avaliadores vinculados.

---

## 11) Enviar convites e acompanhar respostas (admin_client)
1. Dispare convites/reenvios pela tela de participantes (quando disponível) ou funcionalidade relacionada do projeto.
2. Acompanhe o status em `/assessments/participants`.
3. Use o Dashboard de avaliações em `/assessments/dashboard` para visão consolidada.

Critério de sucesso: participantes chegam a status Respondido.

---

---

## 12) Iniciar a geração do relatório
1. No projeto, localize o participante com status Respondido.
2. Clique em Gerar Relatório.
3. Você será levado à tela de configuração do relatório.

---

## 13) Configurar o relatório
Na tela de configuração, revise e selecione:

- Template de relatório
  - Completo 360°: relatório detalhado
  - Simples: visão objetiva e rápida
  - Executivo: foco em insights de liderança

- Competências a incluir
  - Selecione todas ou apenas as desejadas

- Tipos de perguntas (quando disponível)
  - Fechadas: escalas, múltipla escolha (recomendado)
  - Abertas: textos/comentários (opcional)

Confira o resumo (template, número de competências e seções geradas) e avance.

---

## 14) Gerar e visualizar
1. Clique em Gerar Relatório PDF.
2. Aguarde o processamento; o sistema mostrará o carregamento.
3. Você será direcionado à página de Relatórios.

Na página de Relatórios, utilize as abas:
- Visão Geral: resumo executivo e gráficos gerais
- Competências: análise por competência
- Configurar Relatório: ajustes finos (cores, gráficos, filtros)
- Visualizar: preview do relatório final e botões de exportação
- Dados Brutos: tabelas e dados não processados

---

## 15) Exportar
Na aba Visualizar:
- Exportar PDF: formato recomendado para compartilhamento
- Exportar Excel: para análises adicionais em planilhas
- Relatório Individual: documento focado em um participante

Verifique se o download inicia e se o arquivo abre corretamente.

---

## 16) Dicas rápidas
- Comece com o template Simples para validações iniciais.
- Use poucas competências se quiser relatórios mais leves.
- Revise o preview antes de exportar.
- Garanta que os dados estejam completos e atualizados.

---

## 17) Problemas comuns
- Não aparece Gerar Relatório: participante ainda não respondeu.
- PDF muito grande/demorado: reduza competências ou desative perguntas abertas.
- Acesso negado: seu perfil pode não ter permissão para aquela área.
- Erro inesperado: recarregue a página e tente novamente; se persistir, contate o suporte.

---

## 18) Glossário rápido
- Avaliado: quem recebe a avaliação e o relatório.
- Avaliador: quem responde sobre o avaliado (pares, gestor, autoavaliação).
- Competência: tema/habilidade avaliada (ex.: Comunicação, Liderança).

---

Pronto! Você concluiu o fluxo completo: criação (cliente/usuários/projeto/questionário/avaliação/participantes), coleta de respostas e geração/exportação do relatório no ECK.


