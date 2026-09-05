# SignalPath Growth Intelligence

**[Abrir demo ao vivo](https://signalpath-growth-intelligence.pages.dev/)** · [Read in English](README.md)

## Documentação

- [Guia completo do dashboard](docs/DASHBOARD_GUIDE.pt-BR.md)
- [Catálogo de métricas](docs/METRIC_CATALOG.md)
- [Roteiro de demonstração](docs/DEMO_GUIDE.md)

![Visão executiva do SignalPath](docs/images/pt/overview.png)

Case bilíngue de Product Analytics que transforma eventos públicos do GA4 em decisões sobre aquisição, fricção do funil, produtos e retorno de usuários.

## Problema de negócio

Equipes de Growth frequentemente otimizam sessões e cliques sem distinguir tráfego de comportamento qualificado. O SignalPath mostra onde a intenção de compra se perde, quais canais geram jornadas melhores e quais grupos de produtos merecem experimentação.

## Dados e arquitetura

- Fonte oficial: amostra pública `ga4_obfuscated_sample_ecommerce` da Google Merchandise Store.
- Pipeline: `BigQuery → Python/DuckDB → dbt → Parquet/JSON → React/ECharts`.

### Estratégia e carregamento dos marts

- `mart_growth_sessions.parquet` preserva o menor grão de usuário/sessão necessário para usuários distintos, funil, aquisição, retenção e confiança dos dados.
- `mart_growth_products.parquet` contém somente agregados diários de produtos comprados e é carregado sob demanda ao abrir Desempenho de Produtos.
- O DuckDB-WASM usa projeção de colunas e pushdown de filtros do Parquet, lendo apenas colunas e grupos de linhas necessários ao período e aos filtros selecionados.
- `mart-manifest.json` documenta grão, capacidades, linhas, tamanho e política de carregamento. A validação do pipeline impõe colunas obrigatórias e limites de tamanho.
- Toda nova pergunta de negócio deve declarar métricas, dimensões, grão e comportamento dos filtros antes da redução do mart. Uma visão não suportada deve ser identificada claramente, nunca substituída silenciosamente por um total estático.

### Laboratórios de decisão em todas as páginas

Todas as páginas oferecem cinco lentes analíticas determinísticas no lugar de uma narrativa repetida. A página executiva cobre:

1. **Eficiência**: sessões por usuário, taxa de compradores, compras por comprador e receita por compra.
2. **Drivers da mudança**: maiores variações absolutas por canal contra a janela anterior selecionada.
3. **Anomalias**: escores z robustos baseados no desvio absoluto mediano, com limite transparente de `|z| ≥ 3,5`.
4. **Concentração**: participação dos três maiores e índice Herfindahl-Hirschman como diagnósticos de distribuição, não conclusões causais ou regulatórias.
5. **Cenário**: aumento relativo de conversão controlado pelo usuário e traduzido linearmente em compras e receita; é uma análise de sensibilidade, não uma previsão.

O desenho segue padrões consolidados de exploração de funil e segmentos do GA4 e de decomposição, influenciadores e anomalias do Power BI. Todos os resultados respondem ao período e aos filtros; nenhum valor de insight é hardcoded.

Os laboratórios secundários são próprios de cada pergunta: saúde e abandono da jornada, qualidade de aquisição e sensibilidade de verba, mix e velocidade de produtos, comportamento de retorno e atualização, integridade, reconciliação e prontidão dos dados.
- A demo foi construída com 2,25 milhões de eventos e publica somente marts compactos.
- Os dados são ofuscados, históricos e podem conter valores substitutos ou inconsistências.

## Execução

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
npm install
python -m pipeline build --events D:\caminho\events.parquet --products D:\caminho\products.parquet
npm run dev
```

O case demonstra granularidade correta, reconciliação de compras, catálogo de métricas, interface responsiva em dois idiomas e limitações visíveis. Para adaptar a solução a GA4, pedidos, mídia e testes de uma empresa real: [contato](mailto:victorn198@outlook.com).
# Inovação de design

A **Árvore de Drivers de Crescimento** conecta usuários ativos, sessões, compras e receita rastreada em um único caminho decisório. Ela é recalculada com cada filtro e mostra onde o crescimento perde força antes de ampliar aquisição.
