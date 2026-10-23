"""Anonymous, complex review scenes rendered by the official Anki backend."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

from anki.collection import Collection

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_package as package


from preview_scenes import scenes


class VisualTests(unittest.TestCase):
    def test_official_visual_scenes(self):
        rendered = []
        with tempfile.TemporaryDirectory() as directory:
            collection = Collection(str(Path(directory) / 'collection.anki2'))
            try:
                specs = {s['key']: s for s in package.specifications()}
                for key, fields, tags in scenes():
                    model = package.make_model(collection, specs[key], 1800000000)
                    note = collection.new_note(model)
                    for field, value in fields.items():
                        note[field] = value
                    note.tags = tags
                    collection.add_note(note, 1)
                    cards = note.cards()
                    self.assertEqual(len(cards), 2)
                    rendered.append({'key':key, 'css':model['css'], 'cards':[{'front':c.question(), 'back':c.answer()} for c in cards]})
            finally:
                collection.close()
        if os.environ.get('ANKI_RENDER_OUTPUT'):
            (Path(os.environ['ANKI_RENDER_OUTPUT']).parent / 'visual-cases.json').write_text(json.dumps(rendered, ensure_ascii=False))


if __name__ == '__main__':
    unittest.main()
