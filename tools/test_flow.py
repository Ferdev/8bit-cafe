#!/usr/bin/env python3
"""Run the complete browser room/player interaction test."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parent.parent

subprocess.run(
    ["npm", "run", "test:browser", "--", "--grep", "buffers Jev music"],
    cwd=ROOT,
    check=True,
)
