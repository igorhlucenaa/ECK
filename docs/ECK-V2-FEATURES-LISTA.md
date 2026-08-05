# ECK V2 — Lista de Features e Justificativas

---

## Pilar A — Operar com menos fricção

### 1. Centro de alertas acionáveis

Feed unificado de riscos (prazo, taxa de resposta baixa, créditos acabando, outliers) com ações em um clique — reenviar lembrete, estender prazo, notificar consultoria.

**Por que:** O dashboard hoje mostra KPIs, mas não intervém. Consultores descobrem problemas tarde demais; alertas proativos evitam ciclos incompletos e melhoram a taxa de resposta.

---

### 2. Playbooks de implantação por setor

Ao criar projeto, escolher playbook (Varejo, Financeiro, Indústria, Saúde) que pré-carrega competências, categorias, e-mails e seções de relatório.

**Por que:** Codifica o know-how da ECK no produto. Consultores juniores entregam com a mesma base metodológica dos sêniores, e a proposta comercial fica mais rápida e padronizada.

---

### 3. Cobertura inteligente de avaliadores

Validação antes de fechar o projeto: mínimo por categoria, autoavaliação obrigatória, alertas do tipo “faltam 2 pares para confiabilidade”.

**Por que:** Um 360° com poucos avaliadores perde credibilidade metodológica. A feature protege a qualidade da entrega antes que o relatório seja gerado.

---

### 4. Alinhar permissões do `admin_client`

Permitir que o RH do cliente tenha autonomia real (criar projetos, operar ciclos) conforme o modelo de negócio previsto.

**Por que:** Hoje há divergência entre o que o produto promete e o que o perfil consegue fazer. Autonomia do cliente reduz carga da consultoria e aumenta adoção.

---

## Pilar B — Decidir com mais credibilidade

### 5. Calibração e qualidade das respostas

Painel de integridade: avaliadores com padrão “tudo 5/1”, tempo anômalo de preenchimento, desvio por avaliador e simulador “e se removermos X?”.

**Por que:** RH enterprise precisa defender os números em comitês de calibragem. Poucas ferramentas de 360° no Brasil oferecem isso nativamente — é diferencial metodológico premium.

---

### 6. Benchmark interno anonimizado

Comparar competências dentro do mesmo cliente (áreas, cargos, ciclos) com regra de anonimização (mínimo N=5).

**Por que:** O cliente ganha contexto relativo sem comprar benchmark externo. “Como estou vs. minha área?” é uma pergunta que o relatório individual não responde hoje.

---

### 7. Assistente de insights qualitativos (IA)

LLM resume comentários abertos por competência: temas, tom e citações anonimizadas, com opt-in LGPD.

**Por que:** A análise qualitativa é manual, lenta e cara para a consultoria. IA escala esse trabalho sem substituir o consultor na devolutiva.

---

### 8. Relatório executivo automático (1 página)

PDF de uma página ao concluir o projeto: taxa de resposta, top forças/gaps, heatmap e recomendação para o RH.

**Por que:** O relatório individual é rico, mas o C-level quer síntese imediata. Entrega valor no dia do fechamento, enquanto os relatórios personalizados ainda são montados.

---

### 9. Nine-box e mapa de talentos

Matriz desempenho × potencial com eixos configuráveis a partir das competências do 360°.

**Por que:** É a linguagem que RH já usa em sucessão e calibragem. Conecta o 360° individual à gestão de talentos e abre upsell de programas de liderança.

---

### 10. Score de maturidade do ciclo 360°

Índice 0–100 combinando taxa de resposta, cobertura, dispersão de notas, qualidade e evolução vs. ciclo anterior.

**Por que:** Um KPI único facilita QBR com o cliente e conversas com o board — “o programa está saudável?” em um número, não em dez telas.

---

## Pilar C — Desenvolver continuamente

### 11. Portal do colaborador (“Meu Desenvolvimento”)

Área autenticada para o avaliado: histórico de ciclos, evolução por competência, status do ciclo atual e PDI ativo.

**Por que:** A pergunta mais comum após o 360° é “cadê meu feedback?”. Hoje o avaliado não tem lugar no sistema — isso prejudica NPS e percepção de valor do programa.

---

### 12. PDI inteligente pós-relatório

Plano de desenvolvimento gerado após publicação: ações por competência abaixo do threshold, checklist com prazos e, na evolução, sugestões por IA.

**Por que:** 90% das ferramentas de 360° param no PDF. Fechar o loop feedback → ação é o que transforma diagnóstico em desenvolvimento real e justifica renovação do contrato.

---

### 13. Pulse 360° (micro-pesquisas entre ciclos)

Formulários curtos trimestrais entre ciclos completos, com crédito fracionado e dashboard de tendência.

**Por que:** O cliente some da plataforma entre um ciclo anual e outro. Pulse mantém engajamento o ano todo e abre nova linha de receita recorrente.

---

### 14. Trilha de evolução ciclo a ciclo (Delta Analytics)

Relatório comparativo automático: delta por competência e categoria, semáforo melhorou/manteve/piorou e narrativa de evolução.

**Por que:** O 360° hoje é uma foto. Mostrar evolução ao longo do tempo é o principal argumento para renovar o programa — “você melhorou em Comunicação”.

---

### 15. Modo facilitador (workshop de devolutiva)

Tela de apresentação para o consultor: slides por competência, blur de nomes, timer e roteiro de facilitação.

**Por que:** A devolutiva presencial é onde a consultoria cobra fee alto. Produto para o workshop aumenta valor percebido e padroniza a entrega consultiva.

---

### 16. Academia do avaliador

Micro-treinamento de ~2 min antes do survey: o que é 360°, vieses comuns e exemplos de feedback construtivo.

**Por que:** Melhora a qualidade na origem, antes da coleta. Complementa a calibração pós-coleta e reduz respostas apressadas ou enviesadas.

---

## Pilar D — Plataforma e escala

### 17. Hub de integrações (HRIS / Slack / Teams)

Conectores pré-construídos para importar participantes (Totvs, Senior, SAP SF), alertas (Slack/Teams) e SSO (Google/Azure AD), além de webhooks.

**Por que:** Clientes enterprise já têm HRIS e não querem digitar participantes manualmente. Integração é pré-requisito para escala e contratos maiores.

---

### 18. Centro de privacidade e LGPD

Retenção automática de dados, exportação do titular, registro de consentimento e audit log de acessos/exportações.

**Por que:** Financeiro e saúde exigem compliance explícito. Sem isso, o produto trava em enterprise mesmo com funcionalidades excelentes.

---

### 19. White-label completo

Domínio customizado, e-mail com remetente do cliente, login branded e relatório sem menção ECK (opcional).

**Por que:** Grandes clientes querem que o 360° pareça *deles*, não da consultoria. White-label completo viabiliza contratos premium e maior ticket.

---

### 20. Marketplace de competências setoriais

Biblioteca ECK curada por setor (varejo, financeiro, saúde…) com importação em um clique e versionamento.

**Por que:** Acelera onboarding de novos clientes e monetiza a metodologia da consultoria como produto, não só como serviço hora/consultor.

---

### 21. Canais alternativos (WhatsApp / SMS)

Convites e lembretes além do e-mail, via WhatsApp Business API ou SMS.

**Por que:** Em varejo e operações, e-mail tem baixa abertura. WhatsApp pode dobrar a taxa de resposta e salvar ciclos que hoje ficam incompletos.

---

### 22. Copiloto da consultora (IA interna)

Assistente para o consultor ECK: resumir relatório, priorizar competências na devolutiva, gerar roteiro de workshop e comparar com base setorial.

**Por que:** Escala a capacidade da equipe interna sem contratar mais consultores. Diferente da IA de comentários (#9), foca na produtividade de quem opera o sistema.

---

*22 features · Baseado no ECK v1 em produção. Ver `ECK-V2-FEATURES-INOVADORAS.md` para priorização, roadmap e modelo de monetização.*
