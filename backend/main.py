"""Application entry point for HighLyAgent.

All application modules live directly in src/. Run locally with: python main.py
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

app = importlib.import_module("application").app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
