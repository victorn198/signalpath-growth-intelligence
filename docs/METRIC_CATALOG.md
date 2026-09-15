# Metric catalog

| Metric | Grain | Definition |
|---|---|---|
| Observed users | User / window | Distinct `user_id` with at least one event; not GA4's engagement-based Active users definition |
| Sessions | User-session / window | Distinct `(user_id, session_id)` tuple; no concatenation and no null keys |
| User conversion | User / window | Distinct purchasers divided by active users |
| Purchase records | Session-day/dimensions / window | Sum of partition-level distinct transaction counts; unique orders across partitions cannot be certified from this mart |
| Tracked revenue | Purchased item | Sum of revenue from the item mart, never the legacy session-revenue column |
| Multi-day users | User | Users active on more than one calendar date divided by users |

Finite periods end at the global maximum event date, regardless of page or filters, and compare with the immediately preceding equal-length window only when fully covered by the source bounds. Full history has no comparison. The last 30 days are January 2-31, 2021; the prior window is December 3, 2020-January 1, 2021.

Shares of users/purchasers by segment use summed memberships across all groups: people can belong to multiple groups. Rate gaps use percentage points; percentage growth is unavailable when its prior base is zero. Product order occurrences cannot be added to infer basket size.

Journey stage references are archived independent event-user counts, not ordered conversion steps. Multi-day return is within-window behavior, not an acquisition-cohort retention rate. See [Data audit](DATA_AUDIT.md) for evidence and source-certification limits.
