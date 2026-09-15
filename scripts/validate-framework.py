"""Fast publication gates for the analytics quality framework."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    catalog = (ROOT / "docs/METRIC_CATALOG.md").read_text(encoding="utf-8")
    framework = (ROOT / "docs/ANALYTICS_QUALITY_FRAMEWORK.md").read_text(encoding="utf-8")
    manifest = json.loads((ROOT / "public/data/mart-manifest.json").read_text(encoding="utf-8"))
    required = ["grain", "comparison", "source", "period"]
    missing = [term for term in required if term not in catalog.lower() and term not in framework.lower()]
    assert not missing, f"missing framework concepts: {missing}"
    assert "fabricated" in framework.lower() or "synthetic" in framework.lower()
    assert "P1" in framework and "publish" in framework.lower()
    assert manifest.get("marts"), "mart manifest is empty"
    for name, spec in manifest["marts"].items():
        assert spec.get("file") and spec.get("rows") is not None, f"incomplete mart metadata: {name}"
    for path in [ROOT / "src/queryMart.ts", ROOT / "src/App.tsx"]:
        source = path.read_text(encoding="utf-8")
        assert "comparison" in source, f"comparison contract absent from {path.name}"
    print("Framework publication gates passed")


if __name__ == "__main__":
    main()
