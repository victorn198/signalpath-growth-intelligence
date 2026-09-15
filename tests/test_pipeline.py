import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_dashboard_contract():
    path = ROOT / "public/data/dashboard.json"
    if not path.exists():
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["meta"]["rows"] > 0
    assert {page["id"] for page in data["pages"]} == {"executive", "funnel", "acquisition", "products", "retention", "trust"}
    assert all(metric["previous"] is None for page in data["pages"] for metric in page["metrics"])


def test_cross_day_revenue_does_not_multiply(tmp_path, monkeypatch):
    import duckdb
    from pipeline import __main__ as pipeline

    monkeypatch.setattr(pipeline, 'ROOT', tmp_path)
    (tmp_path / 'data').mkdir()
    con = duckdb.connect()
    events = tmp_path / 'events.parquet'
    products = tmp_path / 'products.parquet'
    con.execute(f"""COPY (SELECT CAST(d AS TIMESTAMP) event_date,'u' user_id,'s' session_id,
        'organic' marketing_channel,'desktop' device,'US' country,true is_purchase,t transaction_id,
        'purchase' event_name FROM (VALUES ('2021-01-01','t1'),('2021-01-02','t2')) v(d,t))
        TO '{events.as_posix()}' (FORMAT PARQUET)""")
    con.execute(f"""COPY (SELECT *, CASE WHEN transaction_id='t1' THEN 10 ELSE 20 END item_revenue,
        'shirt' product_type,'Test shirt' item_name,1 quantity FROM read_parquet('{events.as_posix()}'))
        TO '{products.as_posix()}' (FORMAT PARQUET)""")
    pipeline.build(events, products)
    result = con.execute("SELECT sum(revenue) FROM read_parquet(?)", [str(tmp_path / 'public/data/mart_growth_sessions.parquet')]).fetchone()[0]
    assert result == 30
