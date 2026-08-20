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
    assert all(metric["previous"] is not None for page in data["pages"] for metric in page["metrics"])
