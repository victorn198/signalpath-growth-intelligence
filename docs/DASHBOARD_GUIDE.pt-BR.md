# Guia do dashboard SignalPath

## Por que este case existe

O SignalPath foi desenhado para uma equipe de Produto e Growth separar crescimento de tráfego de comportamento qualificado. O GA4 foi escolhido porque análises por evento são comuns em produtos digitais e porque as granularidades de evento, sessão, usuário, item e compra exigem resolver problemas reais de atribuição e reconciliação de receita.

React e ECharts oferecem uma interface própria; DuckDB cria marts reproduzíveis; DuckDB-WASM executa os filtros no navegador sem servidor pago. O app é estático para que a demonstração pública tenha custo fixo zero.

## Como usar

1. Comece em **Crescimento Executivo** para identificar o maior desvio.
2. Mantenha o mesmo contexto de filtros ao navegar para o diagnóstico.
3. Use **Funil e Jornada** para progressão, **Qualidade de Aquisição** para canais, **Desempenho de Produtos** para demanda e **Coortes e Retenção** para retorno.
4. Leia a conclusão sustentada antes da ação recomendada.
5. Consulte **Confiança dos Dados** antes de apresentar a conclusão.
6. Use **Restaurar visão padrão** para voltar ao baseline documentado.

Os filtros globais são **Canal**, **Dispositivo** e **País**. A seleção recalcula KPIs e tendência compatíveis por SQL no mart Parquet. As comparações usam metades não sobrepostas da janela histórica selecionada.

## Dicionário de indicadores

| Indicador | Por que foi escolhido | Cálculo e granularidade | Interpretação correta |
|---|---|---|---|
| Usuários ativos | Mede alcance sem contar eventos repetidos como pessoas | user_id distintos na janela | Público com atividade observada, não usuários cadastrados ou pagantes |
| Sessões | Representa oportunidades de visita | Combinação distinta de usuário e session_id | Volume de visitas; um usuário pode criar várias sessões |
| Conversão de usuários | Liga alcance à intenção de compra | Compradores distintos / usuários ativos | Parcela de usuários observados que comprou |
| Compras | Mede resultados comerciais concluídos | Transações de compra distintas | Quantidade de pedidos sem multiplicação por joins de item ou evento |
| Receita rastreada | Quantifica o valor observado | Soma da receita nas linhas compradas | Receita da amostra GA4, não receita atual de uma empresa |
| Usuários em vários dias | Proxy defensável de retenção | Usuários ativos em mais de uma data / usuários ativos | Comportamento de retorno, não retenção contratual |
| Eventos modelados | Expõe o escopo processado | Contagem de eventos da fonte | Cobertura do pipeline, não desempenho |
| Cobertura de engajamento | Verifica preenchimento do sinal | Usuários com evidência de engajamento / usuários ativos | Cobertura de instrumentação |
| Dias cobertos | Expõe a janela histórica | Datas distintas | Horizonte da análise, não atualização em tempo real |

Cada card mostra valor atual, direção, variação percentual e comparação com a janela anterior. Verde e vermelho indicam se o movimento favorece aquela métrica.

## Página por página

### 1. Crescimento Executivo

- **Objetivo:** decidir se o crescimento é saudável e qual diagnóstico abrir.
- **Cards:** usuários, sessões, conversão, compras e receita cobrem alcance, oportunidade, taxa, volume e valor.
- **Usuários ativos por dia:** revela sazonalidade, picos e possíveis alterações de rastreamento.
- **Mix de aquisição:** mostra quais canais explicam volume, sem confundir volume com qualidade.
- **Detalhe por país:** apresenta usuários e compradores usados na priorização geográfica.
- **Ação:** seguir para a página relacionada ao estágio mais fraco.

### 2. Funil e Jornada

- **Objetivo:** localizar onde a jornada perde força.
- **Volume da jornada:** verifica se a perda acompanha mudança de tráfego.
- **Progressão de eventos:** torna visível a queda entre etapas.
- **Detalhe do funil:** expõe as contagens usadas no gráfico.
- **Ação:** investigar instrumentação ou experiência na primeira queda material; ordem de eventos não prova causalidade.

### 3. Qualidade de Aquisição

- **Objetivo:** separar canais de volume de canais associados a comportamento qualificado.
- **Usuários qualificados no tempo:** verifica estabilidade da qualidade.
- **Usuários por canal:** estabelece escala.
- **Detalhe de qualidade:** compara usuários e compradores.
- **Ação:** priorizar testes onde escala e conversão coexistem. Não há custo de mídia, portanto ROAS não é calculado.

### 4. Desempenho de Produtos

- **Objetivo:** identificar grupos associados a valor e demanda.
- **Sinal de demanda:** diferencia demanda persistente de pico isolado.
- **Receita por grupo:** ordena contribuição observada.
- **Detalhe de oportunidade:** fornece os valores usados no ranking.
- **Ação:** formular hipóteses de merchandising ou experimento; margem e estoque não existem na amostra.

### 5. Coortes e Retenção

- **Objetivo:** avaliar retorno sem fingir que existe churn de assinatura.
- **Usuários em vários dias:** proxy principal de repetição.
- **Atividade recorrente:** mostra quando o retorno acontece.
- **Retenção por dispositivo:** testa diferenças de contexto.
- **Contexto de retorno:** expõe as evidências das coortes.
- **Ação:** investigar fricção de jornada ou dispositivo; três meses não sustentam afirmações de LTV.

### 6. Confiança dos Dados

- **Objetivo:** impedir que o design esconda dados fracos.
- **Cards:** volume, completude de engajamento e cobertura temporal.
- **Volume diário:** evidencia lacunas de ingestão.
- **Cobertura de eventos:** mostra quais famílias dominam a fonte.
- **Checagens de linhagem:** documentam a origem dos cálculos.
- **Verificação DuckDB-WASM:** lê o Parquet publicado no navegador e confirma a quantidade de linhas.
- **Ação:** interromper ou qualificar a conclusão quando cobertura, granularidade ou linhagem forem insuficientes.

## Limites

Os dados são históricos e ofuscados; associação de canal não é causalidade; receita não é lucro; retorno em vários dias não é retenção contratual; e uma demo pública não substitui controles de produção.
# Interação principal: Árvore de Drivers

Leia da esquerda para a direita. Uma base grande de usuários e sessões com forte queda em compras indica atrito na jornada ou no merchandising; compras saudáveis com receita fraca indicam problema de mix ou ticket. Todos os nós, gráficos, tabela, achado e ação usam o mesmo recorte filtrado.

