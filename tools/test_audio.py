#!/usr/bin/env python3
"""Run the browser audio scheduler and fallback smoke tests."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parent.parent

subprocess.run(
    ["npm", "run", "test:browser", "--", "--grep", "buffers Jev music|falls back locally"],
    cwd=ROOT,
    check=True,
)
