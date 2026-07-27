# ECK — Justificativas de Produto (respostas curtas)

> Referência interna para alinhar equipe, consultoria e clientes.  
> Atualizado: julho/2026

---

## Modelo de relatório

### Por que o template não é criado no Novo Projeto?
O template é **layout reutilizável**; o projeto é **operação do ciclo**. Criar o template em **Relatórios** separa metodologia (como o PDF fica) de execução (participantes, prazos, envios).

### Por que aparece “Nenhum template disponível para este cliente”?
Não há `reportTemplates` salvos com o `clientId` daquele cliente. Não é bloqueio de projeto — é ausência de template criado antes em Relatórios.

### O projeto precisa de template na criação?
**Não.** O campo é opcional (`— Nenhum —`). Serve só para pré-selecionar o layout na tela de Relatórios e na geração em lote.

### Por que o template fica vinculado ao cliente e não é global?
Multi-tenant B2B: cada empresa tem formulário, identidade e estrutura de relatório diferentes. O `clientId` isola dados e evita que o RH de um cliente veja layout de outro.

### Por que precisa de formulário para criar o template?
O construtor precisa das **competências** do survey para montar seções (gráficos, Johari, defasagem). Ao salvar, o sistema **remove** os IDs fixos — o layout fica reutilizável em outras avaliações do mesmo cliente.

### Template vs relatório salvo — qual a diferença?
| | Template (`reportTemplates`) | Relatório (`reports`) |
|---|---|---|
| **Guarda** | Estrutura/layout | Instância completa |
| **Vínculo** | Cliente | Cliente + avaliação |
| **Reutilização** | Vários projetos/ciclos | Referência de trabalho salvo |

### Posso usar o mesmo template em vários projetos?
**Sim**, desde que sejam do **mesmo cliente**. O `reportTemplateId` no projeto é atalho, não exclusividade.

---

## Créditos e comercial

### Por que não há self-service de créditos na plataforma?
A compra de pacotes segue pelo **canal comercial da consultoria** (contrato, negociação, aprovação). O produto controla saldo e consumo; a venda fica fora do app por decisão de negócio.

### Como funciona o crédito hoje?
1 crédito ≈ 1 avaliado com link concluído. `admin_master` aprova pedidos em `creditOrders`; o saldo do cliente é debitado na conclusão do link.

---

## Perfis e permissões

### Por que o `admin_client` tem escopo limitado?
O RH do cliente opera **dentro do seu tenant** (`clientId`). A consultoria (`admin_master`) mantém controle de metodologia, créditos e configurações sensíveis. Autonomia existe, mas não é acesso total ao sistema.

### Por que o avaliado não tem portal próprio?
Na V1 o fluxo é **link tokenizado** por e-mail — sem login para quem responde. Portal do colaborador está previsto como evolução (V2), não como lacuna do ciclo atual.

---

## Arquitetura e escopo V1

### O ECK é um formulário genérico?
**Não.** É infraestrutura da consultoria para rodar 360° multi-rater: competências → operação → relatórios consultivos → créditos → publicação para gestores.

### Por que Survey.js e não um builder próprio?
Flexibilidade metodológica com custo de manutenção aceitável. Competências importáveis e formulários complexos já funcionam — refazer o builder não agrega valor proporcional.

### Por que relatórios ricos (Johari, defasagem, abertas)?
Diferencial consultivo da ECK. O produto entrega **devolutiva**, não só médias — alinhado ao fee de consultoria, não a ferramentas de pesquisa simples.

### LGPD e audit log não estão no produto — é bug?
**Não.** Na V1 o compliance é operacional. Centro de privacidade como feature está no roadmap V2 para clientes enterprise (financeiro, saúde).

---

## Feedback vs. bug

### Menu hamburger não abre em tela menor — era bug?
**Sim.** Breakpoint do ícone (1200px) não coincidia com o sidenav mobile (1024px). Corrigido em `full.component`.

### Rotas `/export`, `/upload`, `/emails-notifications` — são promessa quebrada?
São **stubs** de menu legado do tema. Não fazem parte do fluxo 360° em produção. Completar é melhoria de housekeeping, não bloqueio operacional.

### “Não dá para criar template sem projeto” — procede?
**Não totalmente.** Não precisa de projeto; precisa de **cliente + formulário** em Relatórios. A confusão vem do dropdown vazio no Novo Projeto quando o template ainda não foi criado.

---

## V2 — o que muda (visão)

### Por que V2 e não refatorar tudo?
A V1 está **operacional em produção**. A V2 evolui em cima do que funciona (créditos, competências, relatórios) e fecha loops que a V1 abre: PDI, pulse, evolução ciclo a ciclo, alertas proativos.

### Marketplace / templates globais — quando?
Hoje templates são por cliente (isolamento). Biblioteca setorial ECK reutilizável entre clientes é feature V2 (`Marketplace de competências` / playbooks), não correção da V1.

---

## Respostas em uma linha (copy-paste)

| Pergunta | Resposta curta |
|----------|----------------|
| Onde crio o template? | Em **Relatórios**, com cliente + formulário. |
| Projeto sem template? | **Pode.** Campo opcional. |
| Template vazio no projeto? | Ainda **não foi criado** para aquele cliente. |
| Template entre clientes? | **Não hoje** — escopo por `clientId`. |
| Comprar créditos no app? | **Não** — via consultoria comercial. |
| Avaliado vê relatório? | Via publicação do gestor; **sem portal** na V1. |
| Self-service créditos na V2? | **Descartado** — não viável comercialmente. |

---

*Complementa `ECK-V2-FEATURES-LISTA.md` e `ECK-V2-FEATURES-INOVADORAS.md`.*
