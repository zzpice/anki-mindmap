"""Extraction contract pinned to the source commit, without accessing that repository."""
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from sources import read_source
from build_package import specifications, samples


class MigrationContractTests(unittest.TestCase):
    def test_original_runtime_and_model_are_unchanged(self):
        baseline = json.loads((ROOT / 'tests/migration-baseline.json').read_text())
        self.assertEqual(specifications(), [baseline['model']])
        self.assertEqual(samples(), [baseline['sample']])
        for name, expected in baseline['sha256'].items():
            with self.subTest(file=name):
                self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), expected)
        for side, expected in baseline['compiled_sha256'].items():
            self.assertEqual(hashlib.sha256(read_source(baseline['model'][side]).encode()).hexdigest(), expected)
