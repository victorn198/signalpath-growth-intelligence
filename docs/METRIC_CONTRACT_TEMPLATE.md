# Metric Contract Template

Copy one block for every new KPI.

```yaml
name: ""
business_question: ""
definition: ""
grain: ""
numerator: ""
denominator: ""
source_table: ""
filters: []
time_anchor: global_source_max_date
comparison: equal_length_previous_window
zero_and_null_behavior: unavailable
additivity: additive | non_additive | membership
owner: ""
visual_purpose: summary | movement | composition | diagnosis | action
provenance_query: ""
```

Required review questions:

1. Can another analyst reproduce the number from the source?
2. Does the declared grain survive every join?
3. Is the denominator valid for the selected scope?
4. Is the comparison period complete and equivalent?
5. Does the visual add an interpretation beyond the cards?
