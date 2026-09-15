# Analytics Quality Framework

This is the reusable operating standard for SignalPath and the future AisleFlow and Clearline cases. A dashboard is publishable only when the evidence, metric logic, comparison logic, and visual purpose all pass.

## 1. Source contract

Every source must record: owner or official URL, license, extraction timestamp, snapshot period, schema version, row count, grain, primary key, and known limitations. Raw facts stay separate from marts. A compact mart is not treated as raw evidence.

## 2. Grain before SQL

Write the grain in one sentence before joining tables. Examples: one row per user-session-day-dimension; one row per purchased item; one row per complaint. Joins may only happen on keys that preserve that grain. Revenue, orders, and users must each have an explicit authoritative grain.

## 3. Metric contract

Each KPI needs a name, formula, numerator, denominator, grain, filters, comparison rule, null/zero behavior, source, and owner. No KPI may be hardcoded in the frontend or inferred from a chart total. Non-additive metrics such as distinct users, conversion rates, and shares are recomputed at the selected scope.

## 4. Time contract

Use one global source anchor for every page and filter. “Last N days” means the final N calendar dates in the source, inclusive. The comparison is the immediately preceding window of equal length. Annual, quarterly, monthly, weekly, and daily views must use complete comparable periods. If the previous window is unavailable, show “Not available”, never zero or a fabricated percentage.

## 5. Reconciliation gates

Before release, automated checks must pass:

- schema and required columns;
- nulls and invalid dates;
- duplicate rows at declared grain;
- negative or impossible values;
- current and prior bounds;
- direct-source versus mart totals;
- revenue and order authority across marts;
- no join fan-out;
- empty-filter behavior;
- no synthetic baselines;
- no leakage in predictive features.

Any P1 failure blocks publication. P2 failures require a visible limitation in Data Trust.

## 6. Visual contract

Every visual must answer one decision question and list its unit, period, comparison, and denominator. Cards summarize; charts explain movement or composition; tables support action. Repeated numbers are allowed only when the second view adds a different interpretation and states that purpose. A page follows `situation -> explanation -> opportunity -> action`.

## 7. Model contract

Prediction uses only features available before the prediction point. Train/test splits are temporal. Baseline and candidate models are compared on the same holdout and metrics. A model is retained only with measurable improvement and calibration evidence. Predictions are signals, not causal conclusions.

## 8. Release checklist

Run the data audit, Python tests, frontend tests, end-to-end tests, production build, and desktop/mobile review. Record the commit or snapshot, test results, known limitations, and public source link in Data Trust. Do not publish a dashboard whose numbers cannot be traced to a source query or mart.

## Framework em portugues

O framework exige contrato da fonte, granularidade declarada antes do SQL, catálogo de métricas, uma âncora temporal global, reconciliação entre fonte e marts, testes de joins e estados vazios, propósito único por visual e validação temporal de modelos. Falha P1 bloqueia a publicação; falha P2 precisa aparecer como limitação. Assim, o processo detecta os problemas encontrados neste projeto antes que cheguem ao cliente.
