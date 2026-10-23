"""Build boundary regression: expansion, cycles, escaping, and package exports."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import json
import hashlib

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from sources import read_source
from release_assets import release_assets


class SourceTests(unittest.TestCase):
    def test_recursive_includes_and_rich_fields(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'front.html').write_text('A<!-- include:shared.html -->Z')
            (root / 'shared.html').write_text('{{#填写笔记}}<p>{{填写笔记}}</p>{{/填写笔记}}')
            self.assertEqual(read_source('front.html', root=root), 'A{{#填写笔记}}<p>{{填写笔记}}</p>{{/填写笔记}}Z')
            (root / 'data.json').write_text('"<!-- include:missing.html -->"')
            self.assertEqual(read_source('data.json', root=root), '"<!-- include:missing.html -->"')
            (root / 'style.css').write_text('/* include:base.css */')
            (root / 'base.css').write_text(':root {color:red}')
            self.assertEqual(read_source('style.css', root=root), ':root {color:red}')

    def test_cycle_traversal_missing_and_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'loop.html').write_text('<!-- include:loop.html -->')
            with self.assertRaisesRegex(ValueError, 'Circular'):
                read_source('loop.html', root=root)
            with self.assertRaisesRegex(ValueError, 'outside'):
                read_source('../outside.html', root=root)
            (root / 'escape.html').symlink_to(root.parent / 'outside.html')
            with self.assertRaisesRegex(ValueError, 'outside'):
                read_source('escape.html', root=root)
            with self.assertRaises(FileNotFoundError):
                read_source('missing.html', root=root)

    def test_release_exports_match_compiled_sources_and_checksums(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            apkg = directory / 'anki-mindmap.apkg'
            apkg.write_bytes(b'already tested package; do not rebuild')
            # Before the Initial commit exists, supply a deterministic test revision.
            with patch('release_assets.subprocess.check_output', return_value='a' * 40 + '\n'):
                release_assets(directory)
            self.assertEqual(apkg.read_bytes(), b'already tested package; do not rebuild')
            with zipfile.ZipFile(directory / 'anki-mindmap-templates.zip') as archive:
                specs = json.loads(archive.read('note-types.json'))
                for spec in specs:
                    for side in ('front', 'back'):
                        exported = archive.read(f"{spec['key']}/{side}.html").decode()
                        self.assertEqual(exported, read_source(spec[side]))
                        self.assertNotIn('include:', exported)
                    self.assertNotIn('include:', archive.read(f"{spec['key']}/style.css").decode())
                self.assertIn('LICENSE', archive.namelist())
                self.assertIn('NOTICE', archive.namelist())
                self.assertIn('media/_jquery.mark.es6.js', archive.namelist())
            for line in (directory / 'SHA256SUMS').read_text().splitlines():
                digest, name = line.split('  ')
                self.assertEqual(digest, hashlib.sha256((directory / name).read_bytes()).hexdigest())


if __name__ == '__main__':
    unittest.main()
