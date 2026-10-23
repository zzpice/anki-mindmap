"""Render identical anonymous cards through the pinned original Anki templates.

Requires the official Anki/aqt development dependencies. All collections are
created in temporary directories; no personal profile or checkout is changed.
"""
from pathlib import Path
import importlib.metadata
import importlib.util
import io
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile

from anki.collection import Collection

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_react_package import inputs

BASELINE = "f67c932a02bef79f0feab1121c6783a9a3ff9e17"
BUILD = ROOT / "build"
ORIGINAL = BUILD / "visual-main"
SITE = BUILD / "original-site"


def prepare():
    ORIGINAL.mkdir(parents=True, exist_ok=True)
    SITE.mkdir(parents=True, exist_ok=True)
    # Git archive only reads the committed baseline. Old JavaScript stays in
    # an ignored test fixture; it is never imported by the React application.
    archive = subprocess.check_output(
        ["git", "archive", BASELINE, "cards", "scripts"], cwd=ROOT
    )
    with tarfile.open(fileobj=io.BytesIO(archive)) as files:
        files.extractall(ORIGINAL, filter="data")

    spec = importlib.util.spec_from_file_location(
        "original_package", ORIGINAL / "scripts/build_package.py"
    )
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    for media in (ORIGINAL / "cards/media").iterdir():
        shutil.copy2(media, SITE / media.name)
    shutil.copy2(BUILD / "react-site/_mm_react_sample.svg", SITE / "_mm_react_sample.svg")

    with tempfile.TemporaryDirectory(prefix="visual-original-") as directory:
        collection = Collection(str(Path(directory) / "collection.anki2"))
        try:
            model = original.make_model(
                collection,
                json.loads((ORIGINAL / "cards/note-types.json").read_text())[0],
                1800000000,
                source_root=ORIGINAL / "cards",
            )
            deck = collection.decks.new_deck_legacy(False)
            deck.update(id=1792748415, name="Anki Mindmap · React 测试（独立样例）")
            collection.decks.update(deck)
            renders = {}
            for key, fields in inputs().items():
                note = collection.new_note(model)
                note.fields = list(fields.values())
                collection.add_note(note, deck["id"])
                renders[key] = [
                    {"front": card.question(), "back": card.answer()}
                    for card in note.cards()
                ]
            (BUILD / "original-renders.json").write_text(
                json.dumps(renders, ensure_ascii=False)
            )
        finally:
            collection.close()

    native_web = importlib.metadata.distribution("aqt").locate_file("_aqt/data/web")
    assert (native_web / "js/reviewer.js").is_file()
    (BUILD / "anki-web.json").write_text(json.dumps(str(native_web.resolve())))
    print(f"Official main native renders ready: {len(renders)} notes at {BASELINE[:7]}")


if __name__ == "__main__":
    prepare()
