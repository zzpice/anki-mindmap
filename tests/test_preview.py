"""Preview safety and native rendering, exclusively in temporary directories."""
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_preview import ROOT, build_preview, render_version


class PreviewTests(unittest.TestCase):
    def test_same_data_native_ordinals_and_missing_old_type(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            cards = root / 'cards'
            shutil.copytree(ROOT / 'cards', cards)
            cases = [
                {'key':'mindmap-test', 'type':'mindmap', 'fields':{'Text':'{{c1::甲}} 与 {{c30::乙}}'}},
            ]
            result = render_version(cards, cases, root / 'current')
            self.assertEqual(result, {'mindmap-test':2})
            text = (root / 'current/cards.js').read_text()
            payload = json.loads(text.removeprefix('window.previewCards=').removesuffix(';\n'))
            self.assertEqual([c['ordinal'] for c in payload['mindmap-test']['cards']], [1,30])
            self.assertNotIn('include:', text)
            spec = cards / 'note-types.json'
            spec.write_text(json.dumps([s for s in json.loads(spec.read_text()) if s['key']!='mindmap']))
            result = render_version(cards, cases, root / 'baseline')
            self.assertEqual(result['mindmap-test'], 0)
            self.assertIn('unavailable', (root / 'baseline/cards.js').read_text())

    def test_output_guard_preserves_unrelated_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)
            sentinel = path / 'keep.txt'
            sentinel.write_text('keep')
            with self.assertRaises(ValueError):
                build_preview(path)
            self.assertEqual(sentinel.read_text(), 'keep')
