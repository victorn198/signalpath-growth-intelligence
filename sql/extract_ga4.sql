-- Run in BigQuery. Set the destination tables to Parquet exports before the local build.
-- Source grain: one row per GA4 event. Purchases are counted by transaction_id.
SELECT
  user_pseudo_id AS user_id,
  event_name,
  ecommerce.transaction_id AS transaction_id,
  PARSE_DATE('%Y%m%d', event_date) AS event_date,
  TIMESTAMP_MICROS(event_timestamp) AS event_ts,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
  device.category AS device,
  geo.country,
  traffic_source.source,
  traffic_source.medium,
  event_name = 'purchase' AS is_purchase
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`;
