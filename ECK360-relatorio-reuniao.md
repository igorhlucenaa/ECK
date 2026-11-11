# Relatório — demandas da reunião (ECK360)

Documento incremental: cada nova demanda da reunião é registrada aqui com status e resumo do que foi feito (quando houver).

**Última atualização:** 06/11/2026

---

## Legenda de status

| Status | Significado |
|--------|-------------|
| **Verificado** | Já funcionava assim no sistema; conferido, sem mudança necessária. |
| **Implementado** | Novidade entregue ou regra aplicada. |
| **Corrigido** | Problema reportado e ajustado. |
| **Pendente** | Ainda não atendido ou aguardando detalhe. |

---

## Demandas

### 1. Grupos de usuários — nome único por cliente

**Status:** Verificado (já implementado)

**Regra acordada:**

- No **mesmo cliente**, **não** pode haver dois grupos com o **mesmo nome** (variações só de maiúsculas ou espaços contam como o mesmo nome).
- **Pode** haver mais de um grupo no mesmo cliente com **as mesmas pessoas**, desde que os **nomes** dos grupos sejam diferentes.

**Comportamento na tela:** ao tentar repetir o nome, o sistema avisa que já existe um grupo com esse nome para o cliente e pede outro nome.

**Alterações nesta sessão:** nenhuma.

---

### 2. Novo projeto — modal «Gerenciar Usuários e Grupos» cortado

**Status:** Corrigido

**Problema:** Ao abrir **Gerenciar Usuários e Grupos** na tela de **Novo Projeto**, a janela aparecia cortada e era difícil ver e rolar a lista de usuários.

**O que foi feito:** Ajuste de layout do modal para usar melhor a altura da tela, rolagem adequada na lista e painel de permissões fechado por padrão nesse atalho (mais espaço para usuários e grupos).

**Como validar:** `Projetos → Novo Projeto → Gerenciar Usuários e Grupos` — janela completa, lista rolando normalmente e opção de fechar visível.

---

### 3. Relatórios — lista de templates de outros clientes

**Status:** Corrigido

**Problema:** Com um cliente já escolhido (por exemplo «Igor E2E Out2026»), o campo **Template ativo** mostrava modelos de **vários clientes** (com indicação do nome de cada cliente), como se fosse uma lista geral da plataforma.

**O que foi feito:** A lista passa a mostrar apenas **templates globais** (compartilhados) e **templates daquele cliente**. Se o relatório ou projeto já estiver vinculado a um template de outro cliente, esse item continua aparecendo só nesse caso.

**Como validar:** `Relatórios → escolher cliente (e formulário, se for o fluxo normal) → Montar Relatório → abrir o seletor de template`. Não devem aparecer nomes de outros clientes, salvo o template já vinculado.

---

### 4. Relatórios — duplicar template de outro cliente (admin)

**Status:** Implementado

**Necessidade:** O administrador precisava criar um template novo a partir de um modelo já existente (às vezes de **outro cliente**), sem depender do que estava aberto no editor.

**O que foi feito:** No modal **Gerenciar templates**, ao selecionar um template, há a opção **Duplicar template**. A cópia usa a **estrutura salva** daquele modelo (não o que está aberto no editor) e fica vinculada ao **cliente escolhido no topo** da tela de Relatórios. Para o admin, a lista **deste modal** também mostra templates de outros clientes (só no gerenciador; o **Template ativo** na montagem do relatório continua restrito — ver demanda 3).

**Como validar:** `Relatórios → cliente destino → Gerenciar templates… → template de origem (pode ser de outro cliente) → informar o nome → Duplicar template → Concluir`.

---

### 5. Relatórios — nome ao duplicar template

**Status:** Corrigido

**Problema:** Na duplicação, o sistema preenchia automaticamente um nome do tipo «Cópia de …» e dava a impressão de que o título não podia ser escolhido livremente.

**O que foi feito:** O nome do novo template passa a ser **digitado por você** antes de duplicar; «Cópia de …» aparece apenas como **sugestão opcional**. Depois de criar a cópia, o modal permanece aberto para **renomear** (bloco **Nome do template selecionado → Salvar nome**) antes de **Concluir**.

**Como validar:** duplicar com um nome próprio (ex. `Padrão Igor 2026`); conferir na lista; renomear no mesmo modal e validar de novo.

---

### Resumo da sessão (Relatórios / templates)

| # | Tema | Status |
|---|------|--------|
| 3 | Template ativo não lista outros clientes | Corrigido |
| 4 | Duplicar template (admin, outro cliente) | Implementado |
| 5 | Nome livre ao duplicar / renomear no modal | Corrigido |

**Idiomas:** textos do modal **Gerenciar templates** (criar, duplicar, renomear) revisados em português, inglês, espanhol, francês e alemão (`reportTemplates.manage.*`).

---

### 6. Relatórios — loading ao exportar (modal em Projetos, sem “passo a passo” na tela)

**Status:** Implementado

**Necessidade:** O **modal em Projetos** continua (escolhas de template/competências quando não é PDF direto). Porém, ao ir para a página **Relatórios** para gerar o arquivo, não deve aparecer o wizard/etapas da tela — só um **overlay com loading** até o download.

**O que foi feito:** Com `exportAction` na URL (vindo de Projetos ou PDF direto de projeto concluído), a tela de Relatórios fica coberta por overlay único («Gerando relatório…»). O mecanismo roda em segundo plano (pré-visualização invisível). Exportações feitas **já dentro** de Relatórios (botão Exportar PDF) usam o loading global habitual.

**Como validar:** Projetos → ícone de relatório → **modal** de exportação → PDF individual: só overlay em Relatórios até baixar. Relatórios → Exportar PDF manual: loading global na mesma tela.

**Ajuste (modal):** projetos concluídos com template voltaram a abrir o **modal** antes (não pulam mais direto para Relatórios). Tooltip atualizado.

**Ajuste (UX):** na exportação vinda de Projetos, o conteúdo da tela (passos cliente/formulário) fica oculto atrás do overlay; ao voltar para Projetos, a URL perde `exportAction`. **Abrir tela de relatórios** cai na aba Formulário (não mais direto em Visualizar).

---

## Próximas demandas

_(Itens seguintes da reunião serão acrescentados abaixo como ### 7., ### 8., …)_
