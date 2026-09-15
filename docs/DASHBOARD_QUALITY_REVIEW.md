# Dashboard quality review

## Decision contract

| Page | Primary question | Main evidence | Intended decision |
| --- | --- | --- | --- |
| Executive Growth | Is scoped growth healthy? | Users, sessions, purchasers, revenue and prior-period movement | Decide where to investigate before scaling acquisition |
| Journey Evidence | Which event audiences are closest to purchase? | Independent event reach and purchaser behavior | Prioritize instrumentation and journey hypotheses |
| Acquisition Quality | Which channels bring purchasers, not only reach? | Channel conversion, purchaser count and revenue | Compare channel quality before reallocating budget |
| Product Performance | Which products contribute value and concentration? | Item revenue, purchasers and product mix | Prioritize merchandising investigation |
| Repeat Behavior | What repeat-purchase evidence exists? | Purchase-frequency groups and revenue contribution | Define retention hypotheses without claiming cohorts |
| Data Trust | What can the source support? | Grain, coverage, reconciliation and limitations | Prevent unsupported use of the dashboard |

## Visual and analytical rules

- KPI cards summarize the selected period; charts explain time and segment structure.
- Filled marks show the current period and outlined marks show the comparable prior period.
- Green and red encode favorable and unfavorable movement according to metric semantics.
- The five-lens lab provides efficiency, change drivers, stability, concentration and scenario views without generative AI.
- Journey stages are independent event audiences. They are not a certified sequential funnel.
- Revenue uses the item mart as its authority; user-segment counts are non-additive across overlapping segments.

## Acceptance result

The dashboard passed Python data tests, Vitest component tests, Playwright interaction checks, desktop capture at 1440x900 and mobile capture at 390x844. Remaining limitations are source limitations, not hidden calculations.
