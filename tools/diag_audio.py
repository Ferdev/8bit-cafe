#!/usr/bin/env python3
"""Open the browser flow with Playwright tracing for audio diagnosis."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parent.parent

subprocess.run(
    [
        "npm",
        "run",
        "test:browser",
        "--",
        "--grep",
        "buffers Jev music",
        "--trace",
        "on",
    ],
    cwd=ROOT,
    check=True,
)
