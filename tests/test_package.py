"""在临时集合中检查官方导入、媒体、排程、更新和真实预览一致性。"""

import importlib.metadata
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from anki.collection import Collection
from anki.import_export_pb2 import ImportAnkiPackageRequest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_package as package

TEST_PACKAGE = Path(os.environ.get("ANKI_TEST_PACKAGE", package.OUTPUT)).resolve()
TEST_PREVIEW = Path(os.environ.get("ANKI_TEST_PREVIEW", package.PREVIEW)).resolve()


class PackageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)

    def collection(self, name="collection", source=TEST_PACKAGE):
        collection = Collection(str(self.directory / (name + ".anki2")))
        self.addCleanup(collection.close)
        self.import_into(collection, source)
        return collection

    @staticmethod
    def import_into(collection, path):
        collection.import_anki_package(ImportAnkiPackageRequest(package_path=str(path.resolve())))
        collection.models._clear_cache()

    def check_collection(self, collection):
        self.assertEqual(collection.note_count(), len(package.samples()))
        preview = json.loads(TEST_PREVIEW.read_text())
        self.assertEqual(len(collection.find_cards("")), sum(len(example["cards"]) for example in preview))
        self.assertEqual([s["name"] for s in package.specifications()], ["思维导图"])
        self.assertIsNotNone(collection.decks.id_for_name(package.DECK_NAME))
        for spec in package.specifications():
            model = collection.models.get(spec["id"])
            self.assertEqual(model["name"], spec["name"])
            self.assertEqual([f["name"] for f in model["flds"]], spec["fields"])
            expected_css = package.read_source(spec["css"])
            self.assertEqual(model["css"], expected_css)
            self.assertEqual(model["tmpls"][0]["qfmt"], package.read_source(spec["front"]))
            self.assertEqual(model["tmpls"][0]["afmt"], package.read_source(spec["back"]))
            self.assertEqual([f["id"] for f in model["flds"]],
                             [spec["id"] * 100 + i + 1 for i in range(len(spec["fields"]))])
            self.assertEqual(model['id'], 1303378414)
            self.assertEqual(model['type'], 1)
            self.assertEqual(model['originalStockKind'], 5)
            self.assertEqual([f['name'] for f in model['flds']], ['填写笔记', '导图', 'Text'])
            self.assertEqual(len(model['tmpls']), 1)
        self.assertFalse({1303378400, 1303378401, 1303378402, 1303378403} &
                         {m['id'] for m in collection.models.all()})
        for name in package.media_names():
            self.assertEqual((Path(collection.media.dir()) / name).read_bytes(),
                             (package.CARDS / "media" / name).read_bytes())
        for sample in package.samples():
            nid = collection.db.scalar("select id from notes where guid=?", package.sample_guid(sample["key"]))
            note = collection.get_note(nid)
            spec = next(s for s in package.specifications() if s["key"] == sample["type"])
            self.assertEqual(note.mid, spec["id"])
            self.assertEqual(note.fields, list(sample["fields"].values()))
            self.assertEqual(set(note.tags), set(sample["tags"]))
            for card in note.cards():
                self.assertNotIn("{{FrontSide}}", card.answer())
                self.assertEqual((card.type, card.queue, card.reps), (0, 0, 0))
        data = package.preview_data(collection)
        self.assertEqual(data, json.loads(TEST_PREVIEW.read_text()))
        return data

    def test_package_import_and_render(self):
        collection = self.collection()
        data = self.check_collection(collection)
        self.assertEqual(len(data), 1)
        self.assertEqual(len(data[0]['cards']), 3)
        self.assertIn('data-ordinal="1"', data[0]['cards'][0]['front'])
        self.assertIn('data-ordinal="2"', data[0]['cards'][1]['front'])
        if os.environ.get("ANKI_RENDER_OUTPUT"):
            path = Path(os.environ["ANKI_RENDER_OUTPUT"])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            (path.parent / "review.css").write_text(package.read_source(package.specifications()[0]["css"]))
            web = importlib.metadata.distribution("aqt").locate_file("_aqt/data/web")
            (path.parent / "anki-web.json").write_text(json.dumps(str(web.resolve())))
    def test_rebuild_from_sources(self):
        source = package.build_package(self.directory / "rebuilt.apkg", preview=None)
        self.check_collection(self.collection("rebuilt", source))

    def test_reimport_preserves_schedule_without_duplicates(self):
        collection = self.collection()
        schedules = {}
        for index, cid in enumerate(collection.find_cards("")):
            card = collection.get_card(cid)
            card.type = card.queue = 2
            card.ivl, card.reps, card.due = 23 + index, 7, 100 + index
            collection.update_card(card)
            schedules[cid] = (2, 2, 23 + index, 7, 100 + index)
        self.import_into(collection, TEST_PACKAGE)
        rebuilt = package.build_package(self.directory / "rebuilt.apkg", preview=None)
        self.import_into(collection, rebuilt)
        self.assertEqual(collection.note_count(), len(package.samples()))
        self.assertEqual(len(collection.find_cards("")), 3)
        for spec in package.specifications():
            self.assertEqual(len([m for m in collection.models.all() if m["name"] == spec["name"]]), 1)
        for cid, schedule in schedules.items():
            saved = collection.get_card(cid)
            self.assertEqual((saved.type, saved.queue, saved.ivl, saved.reps, saved.due), schedule)

    def test_template_update_preserves_user_notes(self):
        collection = self.collection()
        saved = []
        schedules = {}
        specs = package.specifications()
        for spec in specs:
            note = collection.new_note(collection.models.get(spec["id"]))
            note.fields = list(next(s for s in package.samples() if s["type"] == spec["key"])["fields"].values())
            note.tags = ["用户内容"]
            collection.add_note(note, collection.decks.id_for_name(package.DECK_NAME))
            saved.append(note)
            for card in note.cards():
                card.type = card.queue = 2
                card.ivl, card.reps, card.due = 60, 8, 120
                collection.update_card(card)
                schedules[card.id] = (2, 2, 60, 8, 120)
        original = package.read_source
        css_name = specs[0]["css"]
        css = original(css_name) + "\n/* update regression */\n"
        replacements = {css_name: css}
        for spec in specs:
            for side in ("front", "back"):
                name = spec[side]
                replacements[name] = original(name) + "\n<!-- update regression -->\n"
        timestamp = max(collection.models.get(s["id"])["mod"] for s in specs) + 10
        with patch.object(package, "read_source", side_effect=lambda name: replacements.get(name, original(name))):
            rebuilt = package.build_package(self.directory / "updated.apkg", preview=None, timestamp=timestamp)
        self.import_into(collection, rebuilt)
        for spec in specs:
            model = collection.models.get(spec["id"])
            self.assertEqual(model["css"], css)
            self.assertEqual(model["tmpls"][0]["qfmt"], replacements[spec["front"]])
            self.assertEqual(model["tmpls"][0]["afmt"], replacements[spec["back"]])
        for note in saved:
            self.assertEqual(collection.get_note(note.id).fields, note.fields)
            self.assertEqual(collection.get_note(note.id).tags, note.tags)
        for cid, schedule in schedules.items():
            card = collection.get_card(cid)
            self.assertEqual((card.type, card.queue, card.ivl, card.reps, card.due), schedule)
        self.assertEqual(collection.note_count(), len(package.samples()) + len(package.specifications()))



if __name__ == "__main__":
    unittest.main()
