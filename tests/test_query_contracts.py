"""Execute the browser's actual SQL in native DuckDB, including adversarial scopes."""
import json
import subprocess
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def queries():
    script = """
      const ts = await import('typescript'); const fs = await import('node:fs');
      const source = fs.readFileSync('src/queryMart.ts','utf8');
      const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
      const {buildMartQueries} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
      const result = {};
      for(const page of ['executive','funnel','acquisition','products','retention','trust']) {
        for(const period of ['7','30','all']) result[page+'_'+period]=buildMartQueries({period,channel:'',device:'',country:''},page);
        result[page+'_empty']=buildMartQueries({period:'30',channel:'not-a-channel',device:'',country:''},page);
      }
      result.retention_drill=buildMartQueries({period:'30',channel:'',device:'',country:''},'retention',[{dimension:'device',value:'desktop'}]);
      result.products_sparse=buildMartQueries({period:'30',channel:'',device:'',country:'Andorra'},'products');
      process.stdout.write(JSON.stringify(result));
    """
    return json.loads(subprocess.check_output(["node", "--input-type=module", "-e", script], cwd=ROOT, text=True))


@pytest.fixture(scope="module")
def con():
    return duckdb.connect()


def run(con, sql):
    for name, filename in [("growth.parquet", "mart_growth_sessions.parquet"), ("products.parquet", "mart_growth_products.parquet")]:
        sql = sql.replace(f"'{name}'", f"'{(ROOT / 'public/data' / filename).as_posix()}'")
    result = con.execute(sql)
    return [dict(zip([col[0] for col in result.description], row)) for row in result.fetchall()]


def test_all_page_queries_execute(queries, con):
    for name, query in queries.items():
        for key in ['bounds', 'current', 'previous', 'trend', 'breakdown', 'detail']:
            run(con, query[key])
        if name.startswith('products'):
            run(con, query['productCurrent'])
            run(con, query['productPrevious'])


def test_current_metrics_reconcile_independently(queries, con):
    actual = run(con, queries['executive_30']['current'])[0]
    expected = run(con, """select count(distinct user_id) users,
        count(distinct user_id) filter(where purchased=1) purchasers,
        sum(events) as "rows",sum(revenue) revenue,sum(purchases) orders
        from read_parquet('growth.parquet') where event_date>='2021-01-02' and event_date<='2021-01-31'""")[0]
    for key in expected:
        assert actual[key] == pytest.approx(expected[key])


def test_empty_scope_never_shifts_dates_or_returns_baseline(queries, con):
    for page in ['executive', 'products', 'retention', 'funnel', 'trust', 'acquisition']:
        query = queries[page+'_empty']
        bounds = run(con, query['bounds'])[0]
        assert bounds['current_start'] == '2021-01-02'
        assert bounds['current_end'] == '2021-01-31'
        assert run(con, query['current'])[0]['users'] == 0
        trend = run(con, query['trend'])
        assert len(trend) == 30
        assert all(row['value'] == 0 for row in trend)
        assert run(con, query['detail']) == []
        assert run(con, query['breakdown']) == []


def test_product_dates_and_totals_use_same_window(queries, con):
    assert run(con, queries['products_sparse']['bounds']) == run(con, queries['executive_30']['bounds'])
    query = queries['products_30']
    metrics = run(con, query['productCurrent'])[0]
    assert sum(row['value'] for row in run(con, query['breakdown'])) == pytest.approx(metrics['productRevenue'])
    assert sum(row['value'] for row in run(con, query['trend'])) == pytest.approx(metrics['productRevenue'])


def test_retention_drill_changes_the_grouping(queries, con):
    query = queries['retention_drill']
    assert query['dimension'] == 'country'
    rows = run(con, query['breakdown'])
    assert len(rows) > 3
    assert all(row['name'] != 'desktop' for row in rows)


def test_all_history_has_no_previous_window(queries, con):
    for page in ['executive', 'funnel', 'acquisition', 'products', 'retention', 'trust']:
        assert run(con, queries[page+'_all']['bounds'])[0]['comparison_available'] is False


def test_no_truncated_breakdowns(queries, con):
    query = queries['trust_30']
    total = sum(row['value'] for row in run(con, query['breakdown']))
    assert total == run(con, query['current'])[0]['rows']
