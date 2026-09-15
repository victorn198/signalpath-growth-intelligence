# Post-export reconciliation

Reviewed 2026-09-14 after the complete BigQuery mart export.

## Source coverage

| Mart | Rows | First date | Last date | Active days |
|---|---:|---|---|---:|
| `mart_growth_sessions` | 360,974 | 2020-11-01 | 2021-01-31 | 92 |
| `mart_growth_products` | 13,661 | 2020-11-01 | 2021-01-31 | 92 |

The session mart represents 4,295,584 source events through its `events` measure. It is a compact analytical mart, not an event-level export.

## Independent checks

- Required session identity and date nulls: 0.
- Required product identity and date nulls: 0.
- Negative events, purchases, units, orders, or revenue: 0.
- Duplicate rows at the declared mart grain: 0.
- Full-history distinct users: 270,154.
- Full-history distinct user-session tuples: 360,129.
- Full-history product revenue: 362,110.
- Full-history session revenue: 362,165.

## Interpretation

Product revenue remains the authoritative revenue metric because session revenue is repeated across some multi-day session keys. The observed full-history difference is USD 55 and is disclosed as a diagnostic in Data Trust. Purchase counts in the products mart are product-order memberships, not certified unique orders across all products.

## Reproduction

```powershell
.venv\Scripts\python.exe scripts/audit-data.py
.venv\Scripts\python.exe scripts/validate-framework.py
.venv\Scripts\python.exe -m pytest tests -q
npm test
npm run build
```
