# Data model

The pipeline preserves two facts: event grain and purchased-item grain. User, session, date, device, geography, acquisition, and product attributes are dimensions. Revenue is never summed from an event-item multiplication. Static hosting consumes compact JSON and Parquet marts; raw BigQuery exports remain private.
