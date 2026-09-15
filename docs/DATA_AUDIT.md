# SignalPath: Data audit

Reviewed 2026-09-14 (America/Sao_Paulo). **Share as a historical demonstration with explicit caveats, not as production performance.** Complete compact marts are now exported from the official BigQuery public sample; event-level and unique-order certification remain limited by the published mart grain.

## Resumo em portugues

A receita do mart de sessoes estava repetida entre dias. O dashboard agora usa diretamente a receita dos itens. Todas as paginas usam as mesmas datas globais. Consultas vazias ou com erro nao mostram mais numeros antigos.

As cinco lentes distinguem alcance de eventos, diferenca descritiva de alcance, evolucao de compradores, comparacao de segmentos e cenario. Nao representam um funil sequencial comprovado. Os marts completos exportados foram revalidados; os fatos brutos em nivel de evento nao fazem parte do artefato publicado.

## Repairs and evidence

| Finding | Before | Replacement |
|---|---|---|
| Cross-day revenue multiplication | USD 336,422 in session mart vs USD 328,475 in item mart | Revenue KPIs use items. Legacy discrepancy remains in Data Trust. Future joins include date/dimensions and pass a two-day fixture. |
| Last-30-day revenue | USD 56,670 from sessions; product-local date anchor yielded USD 56,213 | USD 55,240 from items for Jan 2-31, 2021, across both pages. |
| Session identity collisions | Concatenated IDs counted 115,713 sessions in that window | Distinct tuples give 115,509. |
| Shifting date windows | Each selected segment/product set its own maximum | Global sample bounds for every page, filter and drill; exact dates visible. |
| False baseline fallback | Empty/error/loading reused full-history numbers | Analytical results suppressed while unavailable; empty scope stays empty. |
| Wrong denominators | Top-eight shares and top-20 product-order sums | All groups for shares, complete item mart for product totals. |
| Unsupported funnel claims | Independent event audiences called abandonment | Descriptive reach gaps, not ordered transitions; archived reference unverified. |
| Five lenses | Users called purchasers; tiny segments ranked; unconstrained conversion | Accurate units, minimum samples, membership denominators, capped scenarios and assumptions. |
| Synthetic comparisons | Static metadata used multiplier-based priors | Metadata has no comparison. Live comparisons use actual equal-length windows. |

All-history channel counts sum to 327,580 user-channel memberships, not 269,504 unique people. Shares describe memberships, not exclusive attribution. Product-order memberships are not unique orders. Zero baselines have no percentage growth; share changes use percentage points.

## Coverage

Six page purposes and 30 lens states were inspected in code and exercised in browser tests. These are scoped inventory counts, not accuracy percentages; 0 observed defects does not certify every possible control combination. Desktop/narrow rendering was sampled. Firefox, raw extraction and complete per-figure provenance were not certified.

### Dashboard quality

| Category | Observed defects | Assessment |
|---|---|---|
| Usefulness/completeness | 1 / 6 pages | Ordered journey abandonment still requires event-level evidence. |
| Analytical clarity | 0 / 6 pages | Material unit and scenario errors repaired; archival limitation explicit. |
| Visual/interaction consistency | 0 / 6 pages | All lens states exercised; two screenshot paths sampled, not every filter. |

### Analytical correctness

| Category | Observed defects | Assessment |
|---|---|---|
| Source authority/confidence | 2 / 4 artifacts | Missing cleaned facts and incomplete source extraction contract. |
| SQL/value accuracy | 0 / 6 query families | Actual frontend SQL tested in DuckDB for 7/30/all, empty scopes and drills. Raw reconciliation unavailable. |
| Within-chart agreement | 0 / 12 charts | Bindings and denominators traced; rendered coverage sampled. |
| Complete source details | 6 / 6 pages | General source stamp exists, but no complete per-figure SQL/preview interface. |
| Cross-artifact consistency | 0 / 2 revenue groups | Executive/products agree; legacy session discrepancy disclosed. |
| Data-quality controls | 0 / 6 query families | Bounds, empty states, grouping and identities checked; raw deduplication not certified. |
| Conclusion support | 0 / 30 lenses | Observational statements and conditional scenarios, not causal or ordered-funnel certification. |

## Remaining priorities

1. Preserve the BigQuery export receipt and extraction metadata for future refreshes. Reconcile transaction identity before claiming unique orders or production-grade revenue certification.
2. Define and materialize ordered journeys, including conversion window, population and exclusion rules. Independent event reach does not establish abandonment.
3. Add complete per-figure provenance. This audit supersedes conflicting legacy documentation about MAD anomaly detection, HHI or the old driver tree.

Evidence: [numeric audit](audit-evidence.json), [reproducible audit script](../scripts/audit-data.py), [SQL regression tests](../tests/test_query_contracts.py). The JSON hashes preserve the pre-repair snapshot; current behavior is verified separately by regression tests.

```powershell
.venv\Scripts\python.exe scripts/audit-data.py
.venv\Scripts\python.exe -m pytest tests -q
npm test
npm run test:e2e -- --workers=1
npm run build
```

The existing headless Playwright setup was used because the in-app browser plugin failed with a trusted-code-path initialization error. No signed-in profile was accessed. No commit or deployment was made.
