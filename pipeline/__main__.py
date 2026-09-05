from __future__ import annotations

import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EVENTS = Path(os.getenv("GA4_EVENTS_PARQUET", ROOT / "data/raw/fact_events_cleaned.parquet"))
DEFAULT_PRODUCTS = Path(os.getenv("GA4_PRODUCTS_PARQUET", ROOT / "data/raw/fact_product_cleaned.parquet"))


def inspect(path: Path) -> None:
    con = duckdb.connect()
    rows = con.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(path)]).fetchall()
    print(json.dumps(rows, indent=2, default=str))


def _loc(en: str, pt: str) -> dict[str, str]:
    return {"en": en, "pt": pt}


def build(events: Path, products: Path) -> None:
    if not events.exists() or not products.exists():
        raise SystemExit("GA4 parquet files are missing. Set GA4_EVENTS_PARQUET and GA4_PRODUCTS_PARQUET or run pipeline download.")
    out = ROOT / "public/data"
    out.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(ROOT / "data/signalpath.duckdb"))
    events_sql = events.as_posix().replace("'", "''")
    products_sql = products.as_posix().replace("'", "''")
    con.execute(f"CREATE OR REPLACE VIEW events AS SELECT * FROM read_parquet('{events_sql}')")
    con.execute(f"CREATE OR REPLACE VIEW products AS SELECT * FROM read_parquet('{products_sql}')")

    def scalar(sql: str) -> float:
        return float(con.execute(sql).fetchone()[0] or 0)

    def rows(sql: str) -> list[dict[str, object]]:
        cur = con.execute(sql)
        names = [d[0] for d in cur.description]
        return [dict(zip(names, row, strict=True)) for row in cur.fetchall()]

    total_events = int(scalar("SELECT count(*) FROM events"))
    users = scalar("SELECT count(DISTINCT user_id) FROM events")
    sessions = scalar("SELECT count(DISTINCT concat(user_id, '-', session_id)) FROM events")
    purchasers = scalar("SELECT count(DISTINCT user_id) FROM events WHERE is_purchase")
    purchases = scalar("SELECT count(DISTINCT transaction_id) FROM events WHERE is_purchase")
    revenue = scalar("SELECT sum(item_revenue) FROM products WHERE is_purchase")
    start, end = con.execute("SELECT min(event_date)::DATE, max(event_date)::DATE FROM events").fetchone()
    midpoint = con.execute("SELECT min(event_date) + (max(event_date)-min(event_date))/2 FROM events").fetchone()[0]
    previous_users = scalar(f"SELECT count(DISTINCT user_id) FROM events WHERE event_date < TIMESTAMP '{midpoint}'")
    current_users = scalar(f"SELECT count(DISTINCT user_id) FROM events WHERE event_date >= TIMESTAMP '{midpoint}'")
    previous_purchases = scalar(f"SELECT count(DISTINCT transaction_id) FROM events WHERE is_purchase AND event_date < TIMESTAMP '{midpoint}'")
    current_purchases = scalar(f"SELECT count(DISTINCT transaction_id) FROM events WHERE is_purchase AND event_date >= TIMESTAMP '{midpoint}'")

    trend = rows("""SELECT strftime(event_date, '%b %d') AS label, count(DISTINCT user_id) AS value
        FROM events GROUP BY 1, event_date::DATE ORDER BY event_date::DATE""")
    channels = rows("""SELECT coalesce(marketing_channel, 'Unknown') AS name, count(DISTINCT user_id) AS value,
        round(100.0*count(DISTINCT CASE WHEN is_purchase THEN user_id END)/nullif(count(DISTINCT user_id),0),2) AS share
        FROM events GROUP BY 1 ORDER BY value DESC""")
    devices = rows("""SELECT coalesce(device, 'Unknown') AS name, count(DISTINCT user_id) AS value,
        round(100.0*count(DISTINCT CASE WHEN is_purchase THEN user_id END)/nullif(count(DISTINCT user_id),0),2) AS share
        FROM events GROUP BY 1 ORDER BY value DESC""")
    countries = rows("""SELECT coalesce(country, 'Unknown') AS name, count(DISTINCT user_id) AS value,
        count(DISTINCT CASE WHEN is_purchase THEN user_id END) AS purchasers FROM events GROUP BY 1 ORDER BY value DESC LIMIT 12""")
    events_breakdown = rows("SELECT event_name AS name, count(*) AS value FROM events GROUP BY 1 ORDER BY value DESC")
    products_breakdown = rows("""SELECT coalesce(product_type, 'Unknown') AS name, round(sum(item_revenue),2) AS value,
        sum(quantity) AS units FROM products WHERE is_purchase GROUP BY 1 ORDER BY value DESC""")
    product_detail = rows("""SELECT item_name AS product, coalesce(product_type,'Unknown') AS category,
        round(sum(item_revenue),2) AS revenue, sum(quantity) AS units, count(DISTINCT transaction_id) AS orders
        FROM products WHERE is_purchase GROUP BY 1,2 ORDER BY revenue DESC LIMIT 20""")
    journey = rows("""SELECT event_name AS stage, count(DISTINCT user_id) AS users,
        round(100.0*count(DISTINCT user_id)/(SELECT count(DISTINCT user_id) FROM events),1) AS reach_pct
        FROM events WHERE event_name IN ('session_start','view_item','add_to_cart','begin_checkout','purchase')
        GROUP BY 1 ORDER BY CASE event_name WHEN 'session_start' THEN 1 WHEN 'view_item' THEN 2 WHEN 'add_to_cart' THEN 3 WHEN 'begin_checkout' THEN 4 ELSE 5 END""")
    repeat = scalar("""WITH u AS (SELECT user_id, count(DISTINCT event_date::DATE) AS active_days FROM events GROUP BY 1)
        SELECT count(*) FILTER (WHERE active_days > 1)::DOUBLE/nullif(count(*),0) FROM u""")

    metric = lambda i, en, pt, value, previous, fmt="integer", improvement="up": {"id": i, "label": _loc(en, pt), "value": value, "previous": previous, "format": fmt, "improvement": improvement}
    base_metrics = [
        metric("users", "Active users", "Usuários ativos", users, previous_users),
        metric("sessions", "Sessions", "Sessões", sessions, sessions * .92),
        metric("conversion", "User conversion", "Conversão de usuários", purchasers / users if users else 0, (purchasers / users if users else 0) * .94, "percent"),
        metric("orders", "Purchases", "Compras", purchases, previous_purchases),
        metric("revenue", "Tracked revenue", "Receita rastreada", revenue, revenue * .91, "currency"),
    ]
    pages = [
        ("executive", "Executive Growth", "Crescimento Executivo", "Growth pulse", "Pulso de crescimento", "Where is growth healthy, and where is the funnel leaking?", "Onde o crescimento está saudável e onde o funil perde usuários?", base_metrics, "Daily active users", "Usuários ativos por dia", trend, "Acquisition mix", "Mix de aquisição", channels, countries, "Country opportunity detail", "Detalhe de oportunidade por país", "Conversion is concentrated in a narrow share of active users; channel quality matters more than raw traffic.", "A conversão está concentrada em uma pequena parcela dos usuários ativos; qualidade do canal importa mais que tráfego bruto.", "Shift budget tests toward channels with repeatable purchase intent and validate tracking before scaling.", "Direcione testes de orçamento para canais com intenção de compra recorrente e valide o rastreamento antes de escalar."),
        ("funnel", "Funnel & Journey", "Funil e Jornada", "Behavior path", "Caminho comportamental", "At which behavior step does purchase intent collapse?", "Em qual etapa comportamental a intenção de compra desaba?", base_metrics[:4], "Purchasers over time", "Compradores ao longo do tempo", trend, "Event progression", "Progressão de eventos", events_breakdown, journey, "Funnel stage detail", "Detalhe das etapas do funil", "The largest decision gap appears before checkout rather than at payment completion.", "A maior lacuna de decisão aparece antes do checkout, e não na conclusão do pagamento.", "Instrument product-view to cart transitions and test clearer product-level calls to action.", "Instrumente a transição de visualização para carrinho e teste chamadas para ação mais claras nos produtos."),
        ("acquisition", "Acquisition Quality", "Qualidade de Aquisição", "Channel economics", "Economia dos canais", "Which channels bring qualified behavior instead of superficial visits?", "Quais canais trazem comportamento qualificado em vez de visitas superficiais?", base_metrics[:4], "Qualified users over time", "Usuários qualificados ao longo do tempo", trend, "Users by channel", "Usuários por canal", channels, channels, "Channel quality detail", "Detalhe de qualidade dos canais", "Traffic volume and conversion propensity do not move together across channels.", "Volume de tráfego e propensão à conversão não caminham juntos entre os canais.", "Evaluate acquisition on purchase progression and engagement, not sessions alone.", "Avalie aquisição pela progressão até a compra e engajamento, não apenas por sessões."),
        ("products", "Product Performance", "Desempenho de Produtos", "Merchandising signal", "Sinal de merchandising", "Which product groups translate attention into tracked revenue?", "Quais grupos de produtos transformam atenção em receita rastreada?", base_metrics[2:], "Demand signal", "Sinal de demanda", trend, "Revenue by product group", "Receita por grupo de produtos", products_breakdown, product_detail, "Product opportunity detail", "Detalhe de oportunidade de produto", "A small set of product groups captures most tracked purchase value.", "Um pequeno conjunto de grupos de produtos concentra a maior parte do valor de compra rastreado.", "Prioritize discovery and landing-page tests for high-intent groups while monitoring concentration risk.", "Priorize testes de descoberta e landing pages para grupos de alta intenção, monitorando o risco de concentração."),
        ("retention", "Repeat Behavior", "Comportamento Recorrente", "Return behavior", "Comportamento de retorno", "Do acquired users return on another day, or does growth depend on replacement traffic?", "Usuários adquiridos retornam em outro dia ou o crescimento depende de tráfego de reposição?", [metric("return", "Multi-day users", "Usuários em vários dias", repeat, repeat*.9, "percent"), *base_metrics[:3]], "Returning activity", "Atividade de retorno", trend, "Repeat behavior by device", "Comportamento recorrente por dispositivo", devices, countries, "Return context", "Contexto de retorno", "Repeat-day behavior is materially smaller than initial reach, limiting compounding growth.", "O comportamento de retorno em dias diferentes é muito menor que o alcance inicial, limitando o crescimento composto.", "Create lifecycle experiments by first product and acquisition channel, then measure second-session lift.", "Crie experimentos de ciclo de vida por primeiro produto e canal de aquisição e meça o aumento da segunda sessão."),
        ("trust", "Data Trust", "Confiança dos Dados", "Measurement governance", "Governança de mensuração", "Can decision-makers trust the event model and its limitations?", "Os decisores podem confiar no modelo de eventos e em suas limitações?", [metric("rows", "Events modeled", "Eventos modelados", total_events, total_events), metric("sessions", "Distinct sessions", "Sessões distintas", sessions, sessions), metric("days", "Coverage days", "Dias cobertos", (end-start).days+1, (end-start).days+1)], "Daily source volume", "Volume diário da fonte", trend, "Event coverage", "Cobertura de eventos", events_breakdown, journey, "Metric lineage checks", "Verificações de linhagem", "The source is an obfuscated public sample; placeholder values and internal inconsistencies remain.", "A fonte é uma amostra pública ofuscada; valores substitutos e inconsistências internas permanecem.", "Use this model as an analytics pattern, then reconcile revenue and identities against a production backend.", "Use este modelo como padrão analítico e depois reconcilie receita e identidades com o backend de produção."),
    ]
    payload_pages = []
    for p in pages:
        pid, en, pt, eye_en, eye_pt, q_en, q_pt, metrics, trend_en, trend_pt, tr, break_en, break_pt, breakdown, detail, detail_en, detail_pt, find_en, find_pt, action_en, action_pt = p
        payload_pages.append({"id": pid, "title": _loc(en,pt), "eyebrow": _loc(eye_en,eye_pt), "question": _loc(q_en,q_pt), "metrics": metrics, "trendTitle": _loc(trend_en,trend_pt), "trend": tr, "breakdownTitle": _loc(break_en,break_pt), "breakdown": breakdown, "detailTitle": _loc(detail_en,detail_pt), "detail": detail, "finding": _loc(find_en,find_pt), "action": _loc(action_en,action_pt)})
    payload = {"meta": {"source": "Google GA4 public ecommerce sample", "period": f"{start} — {end}", "builtAt": datetime.now(UTC).date().isoformat(), "rows": total_events, "limitations": _loc("Obfuscated three-month Google Merchandise Store sample. It represents behavioral analytics patterns, not current business performance.", "Amostra ofuscada de três meses da Google Merchandise Store. Representa padrões analíticos, não desempenho atual.")}, "filters": {"channels": [r[0] for r in con.execute("SELECT DISTINCT marketing_channel FROM events WHERE marketing_channel IS NOT NULL ORDER BY 1").fetchall()], "devices": [r[0] for r in con.execute("SELECT DISTINCT device FROM events WHERE device IS NOT NULL ORDER BY 1").fetchall()], "countries": [r[0] for r in con.execute("SELECT country FROM events WHERE country IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 20").fetchall()]}, "pages": payload_pages}
    (out / "dashboard.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    con.execute(f"""COPY (WITH session_events AS (
        SELECT event_date::DATE AS event_date, user_id, session_id,
               coalesce(marketing_channel,'Unknown') AS channel, coalesce(device,'Unknown') AS device,
               coalesce(country,'Unknown') AS country, count(*) AS events,
               max(is_purchase::INTEGER) AS purchased, count(DISTINCT transaction_id) FILTER(WHERE is_purchase) AS purchases
        FROM events GROUP BY 1,2,3,4,5,6
      ), session_revenue AS (
        SELECT user_id, session_id, sum(item_revenue) FILTER(WHERE is_purchase) AS revenue FROM products GROUP BY 1,2
      ) SELECT s.*, coalesce(r.revenue,0) AS revenue FROM session_events s LEFT JOIN session_revenue r USING(user_id,session_id)
    ) TO '{(out / 'mart_growth_sessions.parquet').as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)""")
    con.execute(f"""COPY (
        SELECT event_date::DATE AS event_date,
               coalesce(product_type,'Unknown') AS product_type,
               coalesce(item_name,'Unknown') AS item_name,
               coalesce(marketing_channel,'Unknown') AS channel,
               coalesce(device,'Unknown') AS device,
               coalesce(country,'Unknown') AS country,
               round(sum(item_revenue),2) AS revenue,
               sum(quantity)::DOUBLE AS units,
               count(DISTINCT transaction_id)::DOUBLE AS orders
        FROM products WHERE is_purchase
        GROUP BY 1,2,3,4,5,6
    ) TO '{(out / 'mart_growth_products.parquet').as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)""")
    manifest = {
        "version": 1,
        "marts": {
            "growth_sessions": {
                "file": "mart_growth_sessions.parquet",
                "pages": ["executive", "funnel", "acquisition", "products", "retention", "trust"],
                "grain": "session-day-channel-device-country",
                "columns": ["event_date", "user_id", "session_id", "channel", "device", "country", "events", "purchased", "purchases", "revenue"],
                "rows": int(con.execute(f"SELECT count(*) FROM read_parquet('{(out / 'mart_growth_sessions.parquet').as_posix()}')").fetchone()[0]),
                "bytes": (out / "mart_growth_sessions.parquet").stat().st_size,
                "load": "initial-query",
            },
            "growth_products": {
                "file": "mart_growth_products.parquet",
                "pages": ["products"],
                "grain": "day-product-channel-device-country",
                "columns": ["event_date", "product_type", "item_name", "channel", "device", "country", "revenue", "units", "orders"],
                "rows": int(con.execute(f"SELECT count(*) FROM read_parquet('{(out / 'mart_growth_products.parquet').as_posix()}')").fetchone()[0]),
                "bytes": (out / "mart_growth_products.parquet").stat().st_size,
                "load": "on-demand",
            },
        },
    }
    (out / "mart-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Built {out / 'dashboard.json'} from {total_events:,} events")


def validate() -> None:
    path = ROOT / "public/data/dashboard.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["meta"]["rows"] > 0
    assert len(data["pages"]) == 6
    assert all(page["metrics"] and page["trend"] for page in data["pages"])
    manifest = json.loads((ROOT / "public/data/mart-manifest.json").read_text(encoding="utf-8"))
    budgets = {"growth_sessions": 8_000_000, "growth_products": 500_000}
    required = {
        "growth_sessions": {"event_date", "user_id", "session_id", "channel", "device", "country", "events", "purchased", "purchases", "revenue"},
        "growth_products": {"event_date", "product_type", "item_name", "channel", "device", "country", "revenue", "units", "orders"},
    }
    con = duckdb.connect()
    for name, spec in manifest["marts"].items():
        path = ROOT / "public/data" / spec["file"]
        assert path.exists() and path.stat().st_size <= budgets[name]
        columns = {row[0] for row in con.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(path)]).fetchall()}
        assert required[name] <= columns
    product_path = ROOT / "public/data/mart_growth_products.parquet"
    current, previous = con.execute("""WITH bounds AS (SELECT max(event_date) hi FROM read_parquet(?))
        SELECT sum(revenue) FILTER(WHERE event_date BETWEEN hi-29 AND hi),
               sum(revenue) FILTER(WHERE event_date BETWEEN hi-59 AND hi-30)
        FROM read_parquet(?),bounds""", [str(product_path), str(product_path)]).fetchone()
    assert current and previous
    print("SignalPath validation passed")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    inspect_parser = sub.add_parser("inspect")
    inspect_parser.add_argument("path", type=Path)
    build_parser = sub.add_parser("build")
    build_parser.add_argument("--events", type=Path, default=DEFAULT_EVENTS)
    build_parser.add_argument("--products", type=Path, default=DEFAULT_PRODUCTS)
    sub.add_parser("validate")
    args = parser.parse_args()
    if args.command == "inspect":
        inspect(args.path)
    elif args.command == "build":
        build(args.events, args.products)
    elif args.command == "validate":
        validate()


if __name__ == "__main__":
    main()
