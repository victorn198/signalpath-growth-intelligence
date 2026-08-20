select
  cast(event_date as date) as event_date,
  count(*) as events,
  count(distinct user_id) as active_users,
  count(distinct session_id) as sessions,
  count(distinct case when is_purchase then transaction_id end) as purchases
from {{ source('raw', 'events') }}
group by 1
