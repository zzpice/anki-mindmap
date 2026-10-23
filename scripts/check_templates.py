"""Compatibility CLI for the current React/native-template checks."""
from pathlib import Path
import runpy
if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('check_react.py')),run_name='__main__')
