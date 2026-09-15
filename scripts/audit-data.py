"""Read-only mart audit; writes only docs/audit-evidence.json.

Run from the repository: .venv/Scripts/python.exe scripts/audit-data.py
Optional authoritative cleaned facts: --events relative/path --products relative/path.
No source or mart is rebuilt. SQL receipts contain no individual user identifiers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--events', type=Path)
    parser.add_argument('--products', type=Path)
    args = parser.parse_args()
    con = duckdb.connect(':memory:')
    con.execute('SET threads=2')
    receipts = {}

    def query(name, sql):
        cursor = con.execute(sql)
        columns = [column[0] for column in cursor.description]
        result = [dict(zip(columns, row)) for row in cursor.fetchall()]
        receipts[name] = {'sql': sql, 'result': result}
        return result

    def view(name, path):
        con.read_parquet(str(path)).create_view(name)

    def relative(path):
        return Path(os.path.relpath(path, ROOT)).as_posix()

    source_files = [ROOT / name for name in (
        'public/data/mart_growth_sessions.parquet',
        'public/data/mart_growth_products.parquet', 'public/data/dashboard.json',
        'public/data/mart-manifest.json', 'pipeline/__main__.py',
        'sql/extract_ga4.sql', 'src/queryMart.ts', 'docs/METRIC_CATALOG.md')]
    fingerprints = {relative(path): {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'bytes': path.stat().st_size} for path in source_files}
    view('sessions', source_files[0])
    view('products', source_files[1])
    query('schemas', "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_name IN ('sessions','products') ORDER BY table_name,ordinal_position")
    query('bounds', 'SELECT \'sessions\' mart,min(event_date) first_date,max(event_date) last_date,count(DISTINCT event_date) active_days,count(*) row_count FROM sessions UNION ALL SELECT \'products\',min(event_date),max(event_date),count(DISTINCT event_date),count(*) FROM products')
    con.execute('CREATE VIEW bounds AS SELECT min(event_date) lo,max(event_date) hi FROM sessions')
    summary = {}
    for window, condition in [('all', 'true'), ('last30', 'event_date BETWEEN hi-29 AND hi'), ('previous30', 'event_date BETWEEN hi-59 AND hi-30')]:
        summary[window] = query(window + '_metrics', f'''SELECT '{window}' window_name,
          count(*) mart_rows,count(DISTINCT user_id) users,
          count(DISTINCT (user_id,session_id)) sessions,
          count(DISTINCT concat(user_id,'|',session_id)) concat_sessions,
          count(DISTINCT user_id) FILTER(WHERE purchased=1) purchasers,
          sum(purchases) summed_orders,sum(revenue) session_revenue,sum(events) events,
          count(DISTINCT event_date) active_days,
          (SELECT sum(revenue) FROM products,bounds WHERE {condition}) product_revenue,
          (SELECT sum(orders) FROM products,bounds WHERE {condition}) product_order_memberships,
          (SELECT sum(units) FROM products,bounds WHERE {condition}) product_units
          FROM sessions,bounds WHERE {condition}''')[0]
        query(window + '_segment_overlap', f'''WITH scoped AS (SELECT * FROM sessions,bounds WHERE {condition}),
          memberships AS (
          SELECT 'channel' dimension,user_id,count(DISTINCT channel) memberships FROM scoped GROUP BY user_id
          UNION ALL SELECT 'device',user_id,count(DISTINCT device) FROM scoped GROUP BY user_id
          UNION ALL SELECT 'country',user_id,count(DISTINCT country) FROM scoped GROUP BY user_id)
          SELECT dimension,count(*) users,sum(memberships) summed_segment_users,
          count(*) FILTER(WHERE memberships>1) multi_segment_users,
          sum(memberships)-count(*) excess_memberships FROM memberships GROUP BY dimension ORDER BY dimension''')
    query('session_declared_grain_duplicates', '''SELECT count(*) duplicate_groups,coalesce(sum(n-1),0) extra_rows FROM
      (SELECT count(*) n FROM sessions GROUP BY event_date,user_id,session_id,channel,device,country HAVING count(*)>1)''')
    query('product_declared_grain_duplicates', '''SELECT count(*) duplicate_groups,coalesce(sum(n-1),0) extra_rows FROM
      (SELECT count(*) n FROM products GROUP BY event_date,product_type,item_name,channel,device,country HAVING count(*)>1)''')
    query('split_session_revenue', '''WITH grouped AS (SELECT user_id,session_id,count(*) n,
      count(DISTINCT event_date) dates,count(DISTINCT (channel,device,country)) dimensions,
      min(revenue) min_revenue,max(revenue) max_revenue,sum(revenue) total_revenue,
      sum(purchases) purchases FROM sessions GROUP BY user_id,session_id)
      SELECT count(*) session_keys,count(*) FILTER(WHERE n>1) split_keys,
      sum(n-1) extra_rows,count(*) FILTER(WHERE dates>1) multi_day_keys,
      count(*) FILTER(WHERE dimensions>1) multi_dimension_keys,
      count(*) FILTER(WHERE n>1 AND max_revenue<>0) revenue_bearing_split_keys,
      count(*) FILTER(WHERE min_revenue<>max_revenue) nonconstant_revenue_keys,
      sum(total_revenue) stored_revenue,sum(max_revenue) revenue_once_per_key,
      sum(total_revenue-max_revenue) repeated_revenue_excess FROM grouped''')
    query('identity_nulls', '''SELECT count(*) FILTER(WHERE user_id IS NULL) null_users,
      count(*) FILTER(WHERE session_id IS NULL) null_sessions,
      count(*) FILTER(WHERE event_date IS NULL) null_dates,
      count(*) FILTER(WHERE purchased NOT IN (0,1)) invalid_purchase_flags FROM sessions''')
    query('revenue_without_purchase_flags', '''SELECT count(*) row_count,sum(revenue) revenue FROM sessions WHERE revenue<>0 AND purchased=0''')
    query('lagging_scope_anchors', '''WITH anchors AS (
      SELECT 'sessions' mart,channel,device,country,max(event_date) last_date,count(*) row_count FROM sessions GROUP BY ALL
      UNION ALL SELECT 'products',channel,device,country,max(event_date),count(*) FROM products GROUP BY ALL)
      SELECT mart,count(*) scopes,count(*) FILTER(WHERE last_date<hi) lagging_scopes,
      min(last_date) earliest_scope_anchor,max(hi-last_date) max_lag_days FROM anchors,bounds GROUP BY mart''')
    query('anchor_examples', '''WITH anchors AS (SELECT channel,device,country,max(event_date) last_date FROM products GROUP BY ALL)
      SELECT channel,device,country,last_date,hi global_anchor,
      (SELECT max(s.event_date) FROM sessions s WHERE s.channel=a.channel AND s.device=a.device AND s.country=a.country) session_scope_anchor,
      (SELECT sum(p.revenue) FROM products p WHERE p.channel=a.channel AND p.device=a.device AND p.country=a.country AND p.event_date BETWEEN hi-29 AND hi) global_last30_revenue,
      (SELECT sum(p.revenue) FROM products p WHERE p.channel=a.channel AND p.device=a.device AND p.country=a.country AND p.event_date BETWEEN last_date-29 AND last_date) local_last30_revenue
      FROM anchors a,bounds WHERE last_date<hi ORDER BY last_date,channel,device,country LIMIT 5''')
    query('empty_scope', '''SELECT count(*) row_count,count(DISTINCT user_id) users,sum(revenue) revenue,
      min(event_date) local_start,max(event_date) local_end FROM sessions WHERE channel='__audit_absent_scope__' ''')
    query('session_scopes_without_products', '''SELECT count(*) scopes FROM
      (SELECT DISTINCT channel,device,country FROM sessions EXCEPT SELECT DISTINCT channel,device,country FROM products)''')
    query('global_windows', 'SELECT lo,hi,hi-29 last30_start,hi-59 previous30_start,hi-30 previous30_end FROM bounds')
    query('unfiltered_product_anchor_difference', '''SELECT
      (SELECT max(event_date) FROM products) product_anchor,hi global_anchor,
      (SELECT sum(revenue) FROM products WHERE event_date BETWEEN
        (SELECT max(event_date)-29 FROM products) AND (SELECT max(event_date) FROM products)) product_local_last30_revenue,
      (SELECT sum(revenue) FROM products WHERE event_date BETWEEN hi-29 AND hi) product_global_last30_revenue
      FROM bounds''')

    raw = {'status': 'absent_in_checked_locations', 'facts': {}, 'search': []}
    # Bounded, reproducible discovery: likely source roots only; no whole-drive scan.
    candidates = [ROOT / 'data/raw', ROOT / '../agent-revenue-lab',
                  ROOT / '../../MovedFromC/Users/victo/AppData/Local/Temp/ga4-eda']
    skip = {'node_modules', '.git', '.venv', '.tmp', '.npm-cache', '.pip-cache', '.home', 'dist', '.wrangler'}
    found = {}
    for base in candidates:
        record = {'root': relative(base), 'exists': base.exists(), 'max_depth': 8,
                  'max_directories': 2500, 'skipped_directories': sorted(skip), 'directories_visited': 0, 'truncated': False}
        if base.exists():
            for folder, dirs, files in os.walk(base):
                record['directories_visited'] += 1
                depth = len(Path(folder).relative_to(base).parts)
                dirs[:] = [name for name in dirs if name not in skip and not (Path(folder) / name).is_symlink()]
                if depth >= 8:
                    if dirs:
                        record['truncated'] = True
                    dirs[:] = []
                for kind, filename in [('events', 'fact_events_cleaned.parquet'), ('products', 'fact_product_cleaned.parquet')]:
                    if filename in files:
                        found.setdefault(kind, Path(folder) / filename)
                if record['directories_visited'] >= 2500:
                    record['truncated'] = True
                    break
        raw['search'].append(record)
    for kind in ('events', 'products'):
        path = getattr(args, kind) or found.get(kind)
        if path and not path.is_absolute():
            path = ROOT / path
        raw['facts'][kind] = {'available': bool(path and path.exists()), 'path': relative(path) if path else None}
        if path and path.exists():
            view('raw_' + kind, path)
            raw['facts'][kind]['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    if all(fact['available'] for fact in raw['facts'].values()):
        raw['status'] = 'available_recomputed'
        for window, condition in [('all', 'true'), ('last30', 'event_date::DATE BETWEEN hi-29 AND hi')]:
            query('raw_' + window, f'''SELECT count(*) events,count(DISTINCT user_id) users,
              count(DISTINCT (user_id,session_id)) sessions,
              count(DISTINCT user_id) FILTER(WHERE is_purchase) purchasers,
              count(DISTINCT transaction_id) FILTER(WHERE is_purchase) distinct_orders,
              (SELECT sum(item_revenue) FROM raw_products,bounds WHERE is_purchase AND {condition}) revenue
              FROM raw_events,bounds WHERE {condition}''')
    elif any(fact['available'] for fact in raw['facts'].values()):
        raw['status'] = 'partial_source_available_not_fully_reconciled'

    db = duckdb.connect(str(ROOT / 'data/signalpath.duckdb'), read_only=True)
    # Do not copy absolute machine paths or source identifiers into public evidence.
    source_views = []
    for name in ('events', 'products'):
        try:
            db.execute(f'SELECT count(*) FROM {name}').fetchone()
            source_views.append({'view': name, 'readable': True})
        except duckdb.Error as exc:
            source_views.append({'view': name, 'readable': False, 'error_type': type(exc).__name__,
                                 'reason': 'Referenced source unavailable; absolute source path intentionally omitted.'})
    db.close()
    dashboard = json.loads((ROOT / 'public/data/dashboard.json').read_text(encoding='utf-8'))
    existing = {'meta_rows': dashboard['meta']['rows'], 'period': dashboard['meta']['period'],
                'executive_metrics': dashboard['pages'][0]['metrics']}
    manifest = json.loads((ROOT / 'public/data/mart-manifest.json').read_text(encoding='utf-8'))
    manifest_checks = []
    for mart, table in [('growth_sessions', 'sessions'), ('growth_products', 'products')]:
        spec = manifest['marts'][mart]
        count = con.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
        size = (ROOT / 'public/data' / spec['file']).stat().st_size
        manifest_checks.append({'mart': mart, 'actual_rows': count, 'declared_rows': spec['rows'],
                                'rows_match': count == spec['rows'], 'bytes_match': size == spec['bytes']})
    split = receipts['split_session_revenue']['result'][0]
    findings = [
        {'severity': 'P1', 'id': 'revenue_join_fanout', 'location': 'pipeline/__main__.py',
         'finding': 'Revenue keyed by user/session is repeated across session-day/dimension rows.',
         'evidence': split,
         'remedy': 'Rebuild from item facts at an explicitly aligned day/dimension grain; do not deduplicate filtered windows using max(revenue).'},
        {'severity': 'P1', 'id': 'cross_mart_revenue', 'location': 'public/data',
         'finding': 'Session and product revenues differ even with identical global date bounds.',
         'windows': {name: {'session_revenue': row['session_revenue'], 'product_revenue': row['product_revenue'],
                            'difference': round(row['session_revenue']-row['product_revenue'], 6)} for name, row in summary.items()},
         'remedy': 'Use purchased-item mart for item revenue and disclose mismatch until source reconciliation.'},
        {'severity': 'P1', 'id': 'source_reproducibility', 'location': 'sql/extract_ga4.sql',
         'finding': 'Checked source views cannot be read; event extractor omits marketing_channel and there is no purchased-item extractor. Existing pipeline validation checks shape/budgets, not reconciliation.',
         'remedy': 'Restore governed cleaned facts and include marketing-channel transformation and item extraction before claiming end-to-end reproduction.'},
        {'severity': 'P1', 'id': 'orders_nonadditive', 'location': 'pipeline/__main__.py',
         'finding': 'Product orders count transaction memberships per product/day/dimension, not unique overall purchases. Session summed purchases cannot establish unique transactions without raw IDs.',
         'all_product_order_memberships': summary['all']['product_order_memberships'],
         'all_session_summed_orders': summary['all']['summed_orders'],
         'remedy': 'Label product counts as product-order memberships; retain transaction grain for unique filtered purchases.'},
        {'severity': 'P1', 'id': 'scope_date_anchors', 'location': 'src/queryMart.ts',
         'finding': 'Original query computes maxima after filters separately per mart, allowing different periods and stale-scope resurrection. Main agent owns query changes; receipts establish data-level cases, not final UI behavior.',
         'remedy': 'Use one global session-calendar anchor for all marts and preserve empty/null states.'},
        {'severity': 'P2', 'id': 'overlapping_segment_users', 'location': 'public/data/mart_growth_sessions.parquet',
         'finding': 'Distinct segment users are overlapping memberships and must not be summed as a partition.',
         'remedy': 'Label segment reach as nonexclusive and use overall distinct users as the denominator.'},
        {'severity': 'P1', 'id': 'synthetic_static_comparisons', 'location': 'pipeline/__main__.py',
         'finding': 'dashboard.json previous sessions, conversion and revenue are fabricated multipliers (0.92, 0.94, 0.91); previous users/orders use half-history against full-history current values. This is a static payload issue, not a claim that the edited live query uses these baselines.',
         'remedy': 'Remove synthetic baselines or compute real equal-length comparisons before the static payload is used as evidence.'},
    ]
    evidence = {'generated_at_utc': datetime.now(timezone.utc).isoformat(), 'duckdb_version': duckdb.__version__,
                'assessment': 'Needs revision', 'scope': 'Independent numeric and lineage audit only; no UI or pipeline changes.',
                'inputs': fingerprints, 'source_views': source_views, 'raw_sources': raw,
                'existing_dashboard_evidence': existing, 'manifest_checks': manifest_checks,
                'findings': findings, 'queries': receipts,
                'limits': ['Public marts and dashboard.json share pipeline lineage; agreement is not raw-source verification.',
                           'No browser/render review; main agent owns query/App/components and another owns innovation.',
                           'Bounded raw search does not establish absence outside checked directories or under other filenames.',
                           'Distinct transaction IDs are absent from marts; summed orders are not independently certified unique.',
                           'Once-per-session revenue is a diagnostic, not an authoritative corrected revenue total.',
                           'Concurrent edits to other files can supersede the hashed code snapshot.']}
    output = ROOT / 'docs/audit-evidence.json'
    output.write_text(json.dumps(evidence, indent=2, default=str, ensure_ascii=True) + '\n', encoding='utf-8')
    print(json.dumps({'output': relative(output), 'raw_status': raw['status'], 'summary': summary,
                      'split_session_revenue': split}, indent=2, default=str))
    con.close()


if __name__ == '__main__':
    main()
