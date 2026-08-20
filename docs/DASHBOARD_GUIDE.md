# SignalPath dashboard guide

## Why this case exists

SignalPath was designed for a Product Growth team that needs to distinguish traffic growth from qualified behavior. GA4 was chosen because event analytics is common in digital products and because its event, session, user, item, and purchase grains force the analyst to solve realistic attribution and revenue-reconciliation problems.

React and ECharts provide a custom product interface; DuckDB builds reproducible marts; DuckDB-WASM lets filters execute SQL in the browser without a paid server. The app is static by design so the public demo has zero fixed infrastructure cost.

## How to use it

1. Start at **Executive Growth** to identify the largest deviation.
2. Keep the same filter context while moving to the diagnostic page.
3. Use **Funnel & Journey** for progression problems, **Acquisition Quality** for channel problems, **Product Performance** for demand problems, and **Cohorts & Retention** for return behavior.
4. Read the dark evidence statement before the recommended action.
5. Use **Data Trust** before presenting a conclusion.
6. Use **Restore default view** to return to the documented baseline.

Global filters are **Channel**, **Device**, and **Country**. A selection recalculates the compatible KPIs and trend with SQL against the compact Parquet mart. Comparisons use non-overlapping halves of the selected historical window.

## Indicator dictionary

| Indicator | Why it was chosen | Calculation and grain | Correct interpretation |
|---|---|---|---|
| Active users | Measures reach without counting repeated events as people | Distinct user_id in the window | Audience with observed activity, not registered or paying users |
| Sessions | Represents visit opportunities | Distinct user plus session_id | Visit volume; one user can create several sessions |
| User conversion | Connects reach to purchase intent | Distinct purchasers / active users | Share of observed users with a purchase, not event conversion |
| Purchases | Measures completed commercial outcomes | Distinct purchase transactions | Order count; it must not be multiplied by item or event joins |
| Tracked revenue | Quantifies observed purchase value | Sum of revenue on purchased rows | GA4 sample revenue, not current company revenue |
| Multi-day users | Provides a defensible retention proxy | Users active on more than one date / active users | Return behavior inside the sample, not contractual retention |
| Events modeled | Makes processing scope visible | Count of source events | Pipeline coverage, not business performance |
| Engaged-user coverage | Checks whether engagement signals are populated | Users with engagement evidence / active users | Instrumentation coverage |
| Coverage days | Exposes the historical window | Distinct source dates | Analysis horizon, not freshness |

Each KPI card contains the current value, direction, percentage change, and prior-window comparison. Green/red indicates whether the movement is favorable for that metric, not whether the number is intrinsically good.

## Page-by-page reference

### 1. Executive Growth

**Purpose:** decide whether growth is healthy enough to investigate or scale.

- **KPI row:** active users, sessions, user conversion, purchases, and tracked revenue. They combine reach, engagement opportunity, outcome rate, volume, and value.
- **Daily active users:** reveals seasonality, spikes, and abrupt tracking changes that totals hide.
- **Acquisition mix:** shows which channels explain audience volume. A large bar is not automatically a high-quality channel.
- **Country opportunity detail:** provides the underlying user and purchaser context for geographic prioritization.
- **Decision use:** select the weakest stage and continue to the relevant diagnostic page.

### 2. Funnel & Journey

**Purpose:** locate where observed journeys lose momentum.

- **KPI row:** users, sessions, conversion, and purchases establish the denominator and outcome.
- **Journey volume:** checks whether progression changes coincide with overall traffic shifts.
- **Event progression:** compares key event stages and makes step loss visible.
- **Funnel stage detail:** exposes stage-level counts used by the chart.
- **Decision use:** investigate tracking or experience changes at the first materially weak step; do not treat event order as causal proof.

### 3. Acquisition Quality

**Purpose:** separate channels that generate volume from channels associated with qualified behavior.

- **KPI row:** reach and purchase outcomes under the selected channel context.
- **Qualified users over time:** shows whether channel quality is stable or concentrated in a short period.
- **Users by channel:** establishes channel scale.
- **Channel quality detail:** compares users and purchasers so a high-volume channel is not selected on traffic alone.
- **Decision use:** prioritize experiments where scale and conversion evidence coexist; media cost is absent, so ROAS is intentionally not calculated.

### 4. Product Performance

**Purpose:** identify product groups associated with purchase value and demand.

- **KPI row:** conversion, purchases, and revenue focus the page on commercial outcomes.
- **Demand signal:** shows whether product demand is persistent or episodic.
- **Revenue by product group:** ranks observed revenue contribution.
- **Product opportunity detail:** provides the values behind the ranking for review and export.
- **Decision use:** formulate merchandising or experimentation hypotheses. The sample has no margin, inventory, or causal exposure.

### 5. Cohorts & Retention

**Purpose:** evaluate return behavior without pretending the sample contains subscription churn.

- **Multi-day users:** primary repeat-activity proxy.
- **Active users, sessions, and conversion:** keep return behavior tied to scale and outcomes.
- **Returning activity:** shows when repeat behavior occurs.
- **Retention by device:** tests whether return behavior differs by device context.
- **Return context:** exposes the cohort evidence supporting the summary.
- **Decision use:** investigate device or journey friction; the three-month sample cannot support lifetime-value claims.

### 6. Data Trust

**Purpose:** prevent a polished interface from hiding weak data.

- **Events modeled, engaged-user coverage, and coverage days:** describe volume, instrumentation completeness, and time coverage.
- **Daily source volume:** makes ingestion gaps or abnormal source days visible.
- **Event coverage:** shows which event families dominate the source.
- **Metric lineage checks:** documents the evidence behind the calculations.
- **Verify mart with DuckDB-WASM:** independently reads the published Parquet file in the browser and returns its row count.
- **Decision use:** stop or qualify the analysis when coverage, grain, or lineage is insufficient.

## What the dashboard does not claim

- GA4 sample data is historical and obfuscated.
- Channel association is not causal attribution.
- Tracked revenue is not profit.
- Multi-day activity is not subscription retention.
- A public demo does not replace production identity, privacy, observability, or access controls.

