# SignalPath Growth Intelligence

A bilingual product analytics case that turns public GA4 event data into decisions about acquisition quality, funnel friction, product demand, and return behavior.

**[Open the live demo](https://signalpath-growth-intelligence.pages.dev/)** · [Leia em português](README.pt-BR.md)

![SignalPath Executive Growth](docs/images/en/executive-growth.png)

## Business problem

Growth teams often optimize sessions and clicks while losing sight of qualified behavior. SignalPath answers where users abandon purchase intent, which channels bring stronger journeys, and which product groups deserve experimentation.

## Data

- Official source: `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`.
- Public Google Merchandise Store sample, 1 Nov 2020 to 31 Jan 2021.
- Demo built from 2.25M event rows; only compact derived marts are published.
- The sample is obfuscated and may contain placeholders or internal inconsistencies.

## Decision experience

`Executive Growth` → `Funnel & Journey` → `Acquisition Quality` → `Product Performance` → `Repeat Behavior` → `Data Trust`

Each page follows situation, explanation, opportunity, and action. KPIs and comparisons are computed by the pipeline rather than written into the interface.

## Architecture

`GA4 BigQuery → Python/DuckDB → dbt marts → Parquet/JSON → React + ECharts + TanStack Table`

The public app is static and can be hosted at zero fixed cost. The compact Parquet mart is compatible with DuckDB-WASM for client-side SQL exploration.

### Mart strategy and loading

- `mart_growth_sessions.parquet` preserves the user/session/day grain required for reach, purchases, acquisition, multi-day return behavior, and trust calculations. Intermediate funnel flags remain available only as a full-source reference.
- `mart_growth_products.parquet` materializes only purchased product-day aggregates and is loaded on demand when Product Performance is opened.
- DuckDB-WASM applies Parquet column projection and filter pushdown, so queries scan only the columns and row groups needed by the selected period and filters.
- `mart-manifest.json` documents grain, capabilities, row counts, byte size, and loading policy. Pipeline validation enforces required columns and size budgets.
- New business questions must be mapped to required metrics, dimensions, grain, and filter behavior before a mart is reduced. Unsupported views must be labeled explicitly rather than silently falling back to static totals.

### Decision Labs on every page

Every page includes five deterministic analytical lenses instead of a repeated generated narrative. The executive page covers:

1. **Efficiency**: sessions per user, purchaser rate, purchases per buyer, and revenue per purchase.
2. **Change drivers**: largest absolute channel changes against the selected prior window.
3. **Anomalies**: robust z-scores based on the median absolute deviation, with a transparent `|z| ≥ 3.5` threshold.
4. **Concentration**: top-three share and the Herfindahl-Hirschman Index as distribution diagnostics, not causal or regulatory conclusions.
5. **Scenario**: a user-controlled relative conversion uplift translated linearly into purchases and revenue; explicitly a sensitivity calculation, not a forecast.

The design is informed by established exploration patterns such as GA4 funnel/segment explorations and Power BI decomposition, influencer, and anomaly views. Every result responds to the current period and filters; no insight value is hardcoded.

The secondary labs are specific to their questions: full-source journey stages and filtered purchaser behavior, acquisition quality and reach sensitivity, product mix and velocity, multi-day return behavior, and data coverage, grain, reconciliation, and readiness. This dataset does not support true acquisition cohorts.

## Run locally

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
npm install
python -m pipeline build --events D:\path\fact_events_cleaned.parquet --products D:\path\fact_product_cleaned.parquet
npm run dev
```

Validate with `python -m pipeline validate`, `pytest`, `npm test`, `npm run build`, and `npm run test:e2e`. Filters execute client-side SQL against the compact Parquet mart through DuckDB-WASM.

## Portfolio evidence

- Correct event, session, user, item, and transaction grains.
- Revenue counted from purchased items without multiplying event joins.
- Funnel and channel metrics with explicit definitions and limitations.
- Persistent English/Portuguese UI and responsive layouts.
- Source lineage and measurement caveats visible in the product.

## Client adaptation

The same model can connect to a company's GA4 export, backend orders, media costs, and experimentation data. [Discuss a similar project](mailto:victorn198@outlook.com).

See also [Portuguese documentation](README.pt-BR.md), [complete dashboard guide](docs/DASHBOARD_GUIDE.md), [metric catalog](docs/METRIC_CATALOG.md), and [demo guide](docs/DEMO_GUIDE.md).
# Design innovation

The **Growth Driver Tree** links active users, sessions, purchases, and tracked revenue in one decision path. It is recalculated with every filter and is designed to reveal where growth loses momentum before a team scales acquisition.
