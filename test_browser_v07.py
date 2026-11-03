"""Compatibility entry point retained for users of the original source archive."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).parent / 'tests' / 'browser_regression.py'), run_name='__main__')
