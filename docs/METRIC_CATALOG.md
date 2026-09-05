# Metric catalog

| Metric | Grain | Definition |
|---|---|---|
| Active users | User / window | Distinct `user_id` with at least one event |
| Sessions | User-session / window | Distinct user plus `session_id` |
| User conversion | User / window | Distinct purchasers divided by active users |
| Purchases | Transaction / window | Distinct `transaction_id` on purchase events |
| Tracked revenue | Purchased item | Sum of `item_revenue` from purchased item rows |
| Multi-day users | User | Users active on more than one calendar date divided by users |

Finite periods use the immediately preceding window of equal length. Full history has no comparison unless a complete prior window exists.
