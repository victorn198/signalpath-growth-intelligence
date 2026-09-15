# SignalPath analysis readout

Snapshot: 2021-01-02 to 2021-01-31, compared with 2020-12-03 to 2021-01-01. Values were recomputed from the exported BigQuery marts on 2026-09-14.

## Executive answer

Reach weakened while purchase intent weakened more sharply. Users fell from 99,543 to 92,825 (-6.8%), sessions from 125,893 to 116,075 (-7.8%), and purchasers from 1,828 to 1,057 (-42.2%). The selected-scope purchaser rate is 1.14% (1,057 / 92,825), versus 1.84% in the prior window. This is a descriptive change in the public sample, not a causal diagnosis.

## What to investigate first

Referral is the strongest observed acquisition signal in the current window: 498 purchasers and 1.35% user conversion. Direct follows with 250 purchasers and 0.99%; organic brings the largest reach at 37,712 users but converts at 0.82%; paid has 5,119 users and 0.70%. Channel user counts are memberships and are not exclusive attribution, so they should not be added as unique people.

The largest current product category by item revenue is Apparel at USD 29,458, approximately 65% of the product-mart revenue in the window. Accessories, Bags, and New follow at USD 3,713, USD 3,119, and USD 2,829. This supports prioritizing Apparel journeys and checking whether the category is driving both demand and conversion, rather than assuming it causes the result.

The highest observed country conversion rates among countries with at least 100 users are Finland (2.84%, 141 users), Austria (2.42%, 248), Greece (2.05%, 341), Chile (1.96%, 153), and Colombia (1.94%, 464). These are small samples and should be treated as investigation candidates, not rankings of market quality.

Daily purchasers peak at 94 on 2021-01-20, while daily users peak at 5,486 on 2021-01-06. Volume and intent do not peak on the same day, which supports separating traffic quality from reach in the dashboard.

## Recommended action sequence

1. Inspect referral landing paths and purchase behavior, using the same date window and a minimum sample threshold.
2. Compare organic and referral journeys by device and country before changing budget.
3. Investigate the Apparel product path and instrumentation around the high-purchaser days.
4. Treat paid as a quality diagnostic until its conversion is understood; do not infer ROI because the public sample does not provide spend.

## Limits

The source is an obfuscated public ecommerce sample. Downloads, events, and purchases are not revenue statements for a real company. The session mart does not certify unique orders across all products, and the event-level source is not retained locally. The funnel page therefore reports independent event reach and filtered purchaser behavior, not sequential abandonment. These conclusions are observational and do not establish causality.
