# Pente-fino de tradução ECK360 (15/09/2026)

Fonte: `eck360_pente_fino_traducao.docx` — auditoria PT × EN × ES em eck360.web.app.

## Resumo

| Idioma | Itens | Situação |
|--------|-------|----------|
| **EN** | 29 | Boa cobertura; gaps em contadores dinâmicos, vínculos em Usuários, card créditos a vencer, Competências, Participantes, Modelos de E-mail |
| **ES** | 66 | Muito incompleto: Dashboard misto EN/PT/ES; Pedidos de Crédito e Competências quase sem ES |

## Oito padrões recorrentes (causa raiz)

1. Contagens `X cliente(s)/projeto(s)/grupo(s)` montadas em PT no template/código  
2. Categorias de participante traduzidas no gráfico do Dashboard, não na tabela Participantes  
3. Contadores de lista (`X resultados`, `X modelos`, …) sem chave i18n  
4. Tela **Gerenciar Competências** com HTML fixo em PT  
5. **Pedidos de Crédito** sem ES (EN ok)  
6. Mistura de idiomas na mesma célula (sobretudo Dashboard ES)  
7. Rótulo `viewer` minúsculo na coluna Perfil  
8. Datas: EN usa MM/DD no Dashboard, DD/MM em Formulários  

## Correções já iniciadas no código (branch local)

- `app-page-header`: `eyebrow` / `title` / `subtitle` passam pelo `translate`  
- Usuários: contagens cliente/projeto/grupo via i18n  
- Dashboard master: subtítulo EN faltante; contadores cliente/alerta; funil “Todos os clientes”  
- Widget `app-project-data`: card créditos a vencer traduzível  
- Participantes: tipo/categoria via `translateParticipantCategory` / `translateParticipantType`  
- Chaves novas em `pt-BR.json`, `en.json`, `es.json` (contagens, competências, modelos de e-mail)

## Pendente (prioridade sugerida)

1. **Competências** — passos 1–4, sidebar, textos da barra lateral (i18n + HTML)  
2. **ES — Pedidos de Crédito** — título, colunas, botões (espelhar chaves do EN)  
3. **ES — Dashboard master** — cards créditos/alertas/funil (muitos labels ainda hardcoded em EN no HTML/TS)  
4. **Menu lateral ES** — `sidebar-data` / labels `displayName` traduzíveis  
5. **Contadores globais** — padrão único `count.item` para resultados/modelos/formulários/participantes  
6. **Participantes** — status chips (Responded, Blocked, …) e textos de busca/banner  
7. **Datas** — `DatePipe` com locale por idioma ativo  
8. **Perfil viewer** — exibir chave i18n “Visualizador” / “Viewer” na tabela  

Checklist item a item: ver seções “Erros — Inglês” e “Erros — Espanhol” no DOCX original.
