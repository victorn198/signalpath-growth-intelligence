from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def test_framework_gates_pass():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/validate-framework.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr + result.stdout
