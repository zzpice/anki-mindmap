"""Build standalone Anki packages, templates and test renders in temporary collections."""

import argparse
import json
from pathlib import Path
import re
import tempfile
import time
import zipfile

from anki.collection import Collection
from anki.import_export_pb2 import ExportAnkiPackageOptions
from anki.models import StockNotetypeKind

from sources import read_source

ROOT = Path(__file__).resolve().parents[1]
CARDS = ROOT / "cards"
OUTPUT = ROOT / "dist/anki-mindmap.apkg"
PREVIEW = ROOT / "build/rendered.json"
DECK_ID = 2040368696
DECK_NAME = "Anki 模板 · 示例"


def specifications():
    return json.loads(read_source("note-types.json"))


def samples():
    return json.loads(read_source("samples.json"))


def sample_guid(key):
    return next(sample["guid"] for sample in samples() if sample["key"] == key)


def media_names():
    return sorted(path.name for path in (CARDS / "media").iterdir() if path.is_file())


def make_model(collection, spec, timestamp, *, source_root=None):
    def source(name):
        return read_source(name, root=source_root) if source_root else read_source(name)
    if spec["key"] != "mindmap" or spec["kind"] != "cloze":
        raise ValueError("Only the native Cloze mindmap model is supported")
    kind = StockNotetypeKind.KIND_CLOZE
    model = json.loads(collection._backend.get_stock_notetype_legacy(kind))
    css = source(spec["css"])
    model.update(id=spec["id"], name=spec["name"], mod=timestamp, css=css)
    model["flds"] = [collection.models.new_field(name) for name in spec["fields"]]
    for index, field in enumerate(model["flds"]):
        # Preserve the source field IDs for rebuilding and importing into existing models.
        field.update(id=spec["id"] * 100 + index + 1, ord=index)
    template = model["tmpls"][0]
    template.update(id=spec["id"] * 100, name=spec["name"],
                    ord=0, qfmt=source(spec["front"]), afmt=source(spec["back"]))
    collection.models.update(model)
    return collection.models.get(spec["id"])


def preview_data(collection, records=None):
    """Render official HTML for local tests; shared CSS is compiled separately."""
    def without_style(html):
        return re.sub(r"^<style>.*?</style>", "", html, count=1, flags=re.S)

    result = []
    specs = {spec["key"]: spec for spec in specifications()}
    for sample in samples() if records is None else records:
        spec = specs[sample["type"]]
        note_id = collection.db.scalar("select id from notes where guid=?", sample["guid"])
        card_ids = collection.db.list("select id from cards where nid=? order by ord", note_id)
        result.append({"key": sample["key"], "label": sample["label"], "type": sample["type"],
                       **({"css": read_source(spec["css"])} if spec.get("css") else {}),
                       "cards": [{"front": without_style(collection.get_card(cid).question()),
                                  "back": without_style(collection.get_card(cid).answer())}
                                 for cid in card_ids]})
    return result


def build_package(output=OUTPUT, preview=PREVIEW, timestamp=None):
    timestamp = int(time.time()) if timestamp is None else timestamp
    output = Path(output).resolve()
    if preview is not None and Path(preview).resolve() == output:
        raise ValueError("Package and render output must have distinct paths")
    records = samples()
    deck_id = DECK_ID
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        collection = Collection(str(Path(temporary) / "collection.anki2"))
        try:
            deck = collection.decks.new_deck_legacy(False)
            deck.update(id=deck_id, name=DECK_NAME, mod=timestamp)
            collection.decks.update(deck)
            specs = {spec["key"]: spec for spec in specifications()}
            models = {key: make_model(collection, spec, timestamp) for key, spec in specs.items()}
            seen, guids = set(), set()
            for sample in records:
                spec = specs[sample["type"]]
                if (sample["key"] in seen or sample["guid"] in guids
                        or list(sample["fields"]) != spec["fields"]):
                    raise ValueError("示例 key 和 guid 必须唯一，字段顺序必须与 note-types.json 一致")
                seen.add(sample["key"])
                guids.add(sample["guid"])
                note = collection.new_note(models[sample["type"]])
                note.guid = sample["guid"]
                note.fields = list(sample["fields"].values())
                note.tags = sample["tags"]
                collection.add_note(note, deck_id)
            for name in media_names():
                stored_name = collection.media.write_data(name, (CARDS / "media" / name).read_bytes())
                if stored_name != name:
                    raise ValueError(f"Anki renamed runtime media {name!r} to {stored_name!r}; "
                                     "normalize the filename and template references")
            data = preview_data(collection, records)
            collection.export_anki_package(
                out_path=str(output), limit=deck_id,
                options=ExportAnkiPackageOptions(with_media=True, legacy=True,
                                                with_scheduling=False, with_deck_configs=False),
            )
            with zipfile.ZipFile(output, 'a', zipfile.ZIP_DEFLATED) as archive:
                for path in sorted((ROOT / 'licenses').glob('*')):
                    if path.is_file():
                        archive.write(path, 'licenses/' + path.name)
                for name in ('LICENSE', 'NOTICE'):
                    archive.write(ROOT / name, name)
            if preview is not None:
                Path(preview).parent.mkdir(parents=True, exist_ok=True)
                Path(preview).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        finally:
            collection.close()
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--render", type=Path, default=PREVIEW, help="Local test fixture only")
    args = parser.parse_args()
    print(build_package(args.output, args.render))
