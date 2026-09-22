# Relatório completo de QA — Revisão do sistema 6.1

**Projeto:** ECK — Avaliação 360°  
**Referência:** apresentação de revisão 6.1 (15 pontos / slides)  
**Período de validação:** 17/09/2026  
**Ambientes usados:** aplicação em `localhost:4200` e `127.0.0.1:4202` (configuração local com funções de e-mail no emulador)  
**Conta principal de testes:** administrador master (`admin@admin.com`)  
**Outras contas previstas no roteiro:** administrador de cliente e visualizador (senha padrão de QA `123@qwe`, quando existentes no ambiente)

---

## 1. Objetivo deste relatório

Registrar, em linguagem de negócio, **todos os pontos** da revisão 6.1 que foram verificados na interface: o que o usuário vê, o que consegue fazer e se o comportamento está alinhado ao pedido da revisão. Não descreve detalhes de programação, apenas **resultado do QA**.

**Legenda de status**

| Status | Significado |
|--------|-------------|
| **Aprovado** | Comportamento conferido na tela; atende ao pedido da revisão. |
| **Aprovado com ressalva** | Funciona na plataforma; falta apenas conferência manual externa (ex.: caixa de e-mail). |
| **Não aplicável nesta rodada** | Item depende de outro perfil ou dado que não foi repetido nesta sessão, mas já consta aprovado em rodada anterior documentada. |

---

## 2. Resumo executivo

A revisão 6.1 cobre **competências**, **formulários globais**, **créditos e validade**, **perfis de acesso**, **e-mails e templates**, **projetos** e **lembretes**.  

**Conclusão geral:** os itens de produto levantados na revisão foram **implementados e validados na interface**, com exceção de:

- **Conferência visual do e-mail** de redefinição de senha na caixa de entrada (envio confirmado; layout do e-mail não auditado neste QA).
- **Publicação em produção** (deploy), que é etapa operacional posterior ao QA.
- **Contas de teste dedicadas** (`qa.admin.rev61@…`, `qa.viewer.rev61@…`): podem não existir em todos os ambientes Firebase; parte do QA de perfis foi feita com contas reais ou em rodadas anteriores.

---

## 3. Competências e grupos (Slides 1 e 2)

### Slide 1 — Reutilizar competências sem obrigar novo grupo

**Pedido da revisão:** ao aproveitar competências de outro projeto/grupo, não ser obrigado a **sempre** criar um grupo novo; manter a opção de criar grupo quando precisar editar à parte.

**O que foi verificado**

- Na tela **Gerenciar Competências**, ao selecionar um cliente e abrir um grupo, o botão de **reutilizar** (ícone de cópia) abre um assistente claro.
- Duas opções visíveis:
  - **Importar no grupo aberto** — adiciona competências ao grupo que já está sendo editado.
  - **Criar novo grupo neste cliente** — cópia completa com novo nome (comportamento anterior preservado).
- Lista de origem mostra grupos de **vários clientes** (biblioteca compartilhada no escopo do administrador).
- Teste prático: importar competências de outro grupo (ex.: “Diretores”) para o grupo “Setembro” aumentou o número de competências na tela e exibiu mensagem de **grupo atualizado com sucesso**, sem criar um documento de grupo extra desnecessário.

**Status:** **Aprovado**

---

### Slide 2 — Visão global de grupos e importação em relatórios

**Pedido da revisão:** enxergar grupos de competência **além de um único cliente**; poder reutilizar/duplicar; evitar retrabalho ao montar análises.

**O que foi verificado**

**Na tela de competências**

- Novo acesso **Biblioteca global de grupos** (ícone “mundo” na barra lateral de grupos).
- Exibe quantos grupos existem e em quantos clientes; permite **buscar** por nome ou cliente.
- Ações por linha:
  - **Abrir** — muda para o cliente de origem e abre aquele grupo.
  - **Duplicar** — copia o grupo para o cliente selecionado na barra lateral.
- Teste: abrir grupo da Samara a partir da biblioteca enquanto “Cliente teste” estava selecionado → sistema mudou para Samara e abriu o grupo com competências visíveis.

**No assistente de reutilizar (cópia)**

- Texto informando total de grupos e clientes (ex.: “11 grupos em 10 clientes”).
- Mesma lista multi-cliente no campo “Grupo de origem”.

**Na tela de relatórios**

- Antes de escolher formulário, texto orientando que é possível **importar competências de outro grupo**.
- Após escolher cliente e questionário: bloco para escolher **grupo de origem** e **importar competências**.
- Teste ponta a ponta: importação de grupo “Setembro (Samara)” para relatório do Cliente teste → mensagem de **4 competências importadas** e cards (Liderança, Comunicação, Inovação, Organização) visíveis.

**Ressalva (escopo do PPT):** o slide também menciona o fluxo de **puxar “modelo anterior” no formulário** e vir competências já estruturadas (e não só perguntas soltas). O QA desta revisão **cobriu grupos, biblioteca global e importação em relatórios**. Se ainda houver queixa específica na **criação de formulário/avaliação** ao copiar modelo antigo, recomenda-se um teste dedicado com o mesmo caso que gerou o feedback no PPT.

**Status:** **Aprovado** (escopo grupos + relatórios + biblioteca global)

---

## 4. Formulários globais (Slide 3)

**Pedido da revisão:** formulário **padrão para todos os clientes** (template global), visível e reutilizável.

**O que foi verificado**

- Criação/edição de formulário com opção de **formulário padrão para todos os clientes**.
- Listagem de formulários exibe identificação clara de **template global / padrão**.
- Possibilidade de **copiar** formulário global para um cliente específico.
- Projetos e relatórios consideram formulários do cliente **e** globais no escopo correto.

**Status:** **Aprovado**

---

## 5. Créditos e validade (Slides 4 e 5)

**Pedido da revisão:** validade de créditos coerente entre pedidos, tela de cliente e indicadores (dias restantes, etc.).

**O que foi verificado**

- No diálogo **Editar Cliente** (ex.: Cliente teste): créditos disponíveis, data de validade e **dias restantes** exibidos de forma consistente.
- Link para **Ver pedidos de crédito** leva à listagem filtrada do cliente.
- Valores na listagem de pedidos **alinhados** ao que aparece no card do cliente (ex.: mesma data e contagem de dias).
- Fluxo de aprovação de pedido e mensagens ao usuário em idioma correto (checklist de correções 4–5).

**Status:** **Aprovado**

---

## 6. Textos e perfis — Grupos vs usuários (Slide 6)

**Pedido da revisão:** textos claros sobre o que **Administrador de Cliente** faz em **Grupos** vs o que é responsabilidade da consultoria em **Usuários**.

**O que foi verificado**

- Painel **Perfis e Permissões** descreve corretamente Admin Cliente e Visualizador.
- Logado como **Administrador de Cliente**: tela de usuários enfatiza **Grupos**; texto orienta que gestão ampla de usuários é da consultoria.
- Logado como **Master**: abas **Usuários** e **Grupos** disponíveis conforme esperado.

**Status:** **Aprovado**

---

## 7. Lembretes — Visualizador (Slide 7)

**Pedido da revisão:** visualizador consegue acessar lembretes com texto e menu adequados.

**O que foi verificado**

- Perfil **Visualizador**: item de menu **Lembretes Automáticos** presente.
- Acesso à tela de configurações de lembretes funciona.
- Tentativa de acessar **Usuários** → **acesso negado** (correto para o perfil).
- Textos no painel de perfis mencionam envio/configuração de lembretes para o visualizador.

**Status:** **Aprovado**

---

## 8. E-mail de redefinição de senha — marca ECK (Slide 8)

**Pedido da revisão:** e-mail de “esqueci minha senha” / link de acesso com **identidade ECK**, não template genérico do Firebase.

**O que foi verificado**

- Na tela **Usuários**, botão de **chave** (enviar link de acesso/redefinição) dispara o fluxo novo.
- Com ambiente local + servidor de funções de e-mail configurado: mensagem na tela **Link de acesso enviado** para o e-mail do usuário testado.
- Servidor registrou envio **sem erro** (inclui geração do link e disparo SMTP).
- Em desenvolvimento local, o link de retorno usa domínio **autorizado** (evita falha de “domínio não permitido” ao testar em `127.0.0.1`).

**O que não foi feito neste QA**

- Abrir a **caixa de entrada** e validar visualmente cabeçalho, botão e rodapé “ECK Avaliação 360”.

**Status:** **Aprovado com ressalva** (envio e UI OK; layout do e-mail = conferência manual)

---

## 9. Clientes — escopo do tenant (Slide 9)

**Pedido da revisão:** administrador de cliente **não** vê todos os clientes da plataforma.

**O que foi verificado**

- Admin Cliente vê apenas clientes do **seu escopo** (ex.: Teste Setembro).
- Detalhe do cliente permitido; listagem global de todos os clientes **não** aparece indevidamente.

**Status:** **Aprovado**

---

## 10. Menu e dashboard — Admin Cliente (Slide 10)

**Pedido da revisão:** admin de cliente **sem** atalhos indevidos a relatórios globais e modelos de e-mail da consultoria.

**O que foi verificado**

- Menu **sem** entradas **Relatórios** e **Modelos de E-mail** (escopo master/consultoria).
- Acesso direto por URL a `/reports` e `/mail-templates` → **Acesso negado**.
- Dashboard sem atalhos que contornem essas restrições.
- Admin Cliente mantém **Gerar Relatório** onde permitido (ex.: extrato Excel em projetos), sem abrir a área global de relatórios.

**Status:** **Aprovado**

---

## 11. Criar projeto — Admin Cliente (Slide 11)

**Pedido da revisão:** administrador de cliente pode **criar projetos** no seu escopo.

**O que foi verificado**

- Tela de **Projetos** com ação **Adicionar Projeto** disponível para Admin Cliente.

**Status:** **Aprovado**

---

## 12. Grupos ao editar usuário (Slide 12)

**Pedido da revisão:** gestão de **grupos de usuários** no fluxo correto (master e admin conforme perfil).

**O que foi verificado**

- Master: criação/edição de grupos e vínculo com usuários.
- Admin Cliente: **Adicionar Grupo** e gestão de grupos no escopo do cliente.

**Status:** **Aprovado**

---

## 13. Modelos de e-mail — listagem e global (Slide 13)

**Pedido da revisão:** listagem clara; destaque para **template padrão global**; filtro dedicado.

**O que foi verificado**

- Tela **Modelos de E-mail** com orientação sobre template base reutilizável.
- Coluna/indicador **TEMPLATE PADRÃO (global)** onde aplicável.
- Filtro **Somente TEMPLATE PADRÃO (global)** funcional.

**Status:** **Aprovado**

---

## 14. Duplicar template trocando cliente (Slide 14)

**Pedido da revisão:** duplicar modelo de e-mail e **associar a outro cliente** (ou ao template padrão), sem arrastar vínculo errado de projeto.

**O que foi verificado**

- Ação **Duplicar** abre diálogo com **nome da cópia** e seletor de **Cliente** (inclui opção template padrão global).
- Teste completo: duplicar template “Convite (Avaliado)” como **QA Rev61 Dup E2E** para **Cliente teste** → sistema abriu tela de **Editar Template** com o nome correto e novo registro criado.
- Ao mudar de cliente na duplicação, vínculo de projeto incompatível é **limpo** (não mantém projeto de outro cliente).

**Status:** **Aprovado**

---

## 15. Lembretes no fluxo do projeto (Slide 15)

**Pedido da revisão:** lembretes visíveis ao **editar projeto**, com orientação e atalho para configuração.

**O que foi verificado**

- Card de lembretes na **edição do projeto** com textos explicativos (bullets).
- Botão/atalho leva à configuração com **cliente e projeto** já contextualizados na URL.

**Status:** **Aprovado**

---

## 16. Checklist de correções transversais (itens 4–15 do roteiro interno)

Itens marcados como concluídos no roteiro de QA da revisão:

| # | Tema | Resultado QA |
|---|------|--------------|
| 4–5 | Aprovação de crédito, validade, mensagens ao usuário | Aprovado |
| 6 | Textos Grupos vs Usuários (Admin Cliente) | Aprovado |
| 7 | Textos e menu de lembretes (Visualizador) | Aprovado |
| 9 | Clientes só do tenant | Aprovado |
| 10 | Menu/dashboard Admin Cliente | Aprovado |
| 11 | Criar projeto | Aprovado |
| 12 | Grupos na edição de usuário | Aprovado |
| 13–14 | Templates globais + duplicar com cliente | Aprovado |
| 15 | Card de lembretes no projeto | Aprovado |

---

## 17. Matriz por perfil (visão rápida)

| Área | Master | Admin Cliente | Visualizador |
|------|--------|---------------|--------------|
| Competências — reutilizar / biblioteca global | Aprovado | (escopo do cliente) | — |
| Relatórios — importar competências | Aprovado | Acesso negado (correto) | — |
| Formulários globais | Aprovado | Conforme escopo | — |
| Créditos / validade | Aprovado | Aprovado (cliente do tenant) | — |
| E-mail reset (chave) | Aprovado com ressalva inbox | — | — |
| Modelos de e-mail | Aprovado | Acesso negado (correto) | — |
| Projetos / lembretes | Aprovado | Aprovado | Lembretes OK; usuários negado |
| Usuários / grupos | Aprovado | Só grupos + textos | Acesso negado |

---

## 18. Itens fora do escopo deste QA (mas relevantes para go-live)

| Item | Situação |
|------|----------|
| Deploy hosting + funções em produção | Pendente operacional |
| Commit / merge formal no repositório | A critério da equipe |
| Seed automático das três contas QA dedicadas | Requer chave Admin SDK no ambiente |
| Leitura do e-mail de reset na caixa de entrada | Conferência manual recomendada |
| Dado de teste criado na duplicação de template (“QA Rev61 Dup E2E”) | Pode ser removido ou mantido como referência |

---

## 19. Conclusão formal

Com base nas rodadas de teste em interface (17/09/2026), documentadas em detalhe técnico em `QA-REVISAO-6.1-VALIDACAO.md` e consolidadas neste relatório:

**A revisão 6.1 está apta do ponto de vista de produto e QA de interface**, ressalvadas a **validação visual do e-mail** e a **publicação em produção**.

Recomenda-se, antes do go-live:

1. Um responsável abrir o e-mail de reset e confirmar marca ECK.  
2. Publicar funções (especialmente envio de e-mail branded) no Firebase.  
3. Repetir smoke test com **Admin Cliente** e **Visualizador** no ambiente de produção ou homologação, se as contas QA dedicadas existirem lá.

---

*Relatório gerado para stakeholders — Revisão 6.1 — ECK Consulting.*
