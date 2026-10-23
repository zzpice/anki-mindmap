"""Independent, anonymous native-device comparison; never updates daily templates.

Run prepare_visual_comparison.py first. The pinned main source lives only in
ignored build/visual-main; its legacy runtime is not an application dependency.
"""
from pathlib import Path
import importlib.util
import json
import tempfile
import time
import zipfile

from anki.collection import Collection
from anki.import_export_pb2 import ExportAnkiPackageOptions, ImportAnkiPackageRequest
from build_react_package import ROOT, BUILD, OUT, compiled, inputs, make_model, sha


def build():
    original_root = BUILD / 'visual-main'
    spec = importlib.util.spec_from_file_location('comparison_original', original_root / 'scripts/build_package.py')
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    assets, templates = compiled()
    font = next(name for name in assets if name.endswith('.ttf'))
    for file in (original_root / 'cards/media').iterdir():
        if not file.name.endswith('.ttf'):
            assets[file.name] = file.read_bytes()
    probe = (ROOT / 'tests/react/layout-probe.html').read_text()
    cases = {key: inputs()[key] for key in ('overview', 'deep', 'wide-review', 'image')}
    package = OUT / 'anki-mindmap-layout-comparison.apkg'
    site = BUILD / 'layout-comparison'; site.mkdir(exist_ok=True)
    renders = {}
    with tempfile.TemporaryDirectory(prefix='mindmap-layout-') as directory:
        col = Collection(str(Path(directory) / 'source.anki2'))
        try:
            # Neither the production model nor the normal React test model is included.
            for kind, mid in (('main', 1792748514), ('react', 1792748524)):
                name = f'边栏对照 · {kind}'
                if kind == 'main':
                    contract = json.loads((original_root / 'cards/note-types.json').read_text())[0]
                    contract.update(id=mid, name=name)
                    model = original.make_model(col, contract, int(time.time()), source_root=original_root / 'cards')
                    model['css'] = model['css'].replace('_guoqijihua_lxgwgbr.ttf', font)
                else:
                    model = make_model(col, mid, name, templates)
                for side, field in (('front', 'qfmt'), ('back', 'afmt')):
                    model['tmpls'][0][field] += probe.replace('__KIND__', kind).replace('__SIDE__', side)
                col.models.update(model)
                deck = col.decks.new_deck_legacy(False)
                deck.update(id=mid+1, name=f'Anki Mindmap · 边栏对照（独立样例）::{kind}')
                col.decks.update(deck)
                for key, values in cases.items():
                    note = col.new_note(model)
                    note.guid = f'mm-layout-v1-{kind}-{key}'
                    note.fields = list(values.values()); note.tags = ['mm-layout::'+key]
                    col.add_note(note, deck['id'])
                    renders[f'{kind}-{key}'] = [{'front': c.question(), 'back': c.answer()} for c in note.cards()]
            assert col.db.scalar('select count(*) from notes') == 8
            assert col.db.scalar('select count(*) from cards') == 8
            assert set(col.db.list('select distinct mid from notes')) == {1792748514, 1792748524}
            for name, data in assets.items():
                col.media.write_data(name, data); (site / name).write_bytes(data)
            col.export_anki_package(out_path=str(package), limit=None, options=ExportAnkiPackageOptions(
                with_media=True, legacy=True, with_scheduling=False, with_deck_configs=False))
        finally:
            col.close()
        target = Collection(str(Path(directory) / 'existing.anki2'))
        try:
            production = make_model(target, 1303378414, 'Preserved production', templates)
            note = target.new_note(production); note.fields = ['保留字段', '保留导图', '{{c1::保留答案}}']
            target.add_note(note, 1)
            card = note.cards()[0]; card.reps = 8; card.ivl = 20; target.update_card(card)
            before = (target.db.all('select * from notes'), target.db.all('select * from cards'),
                      json.dumps(target.models.get(1303378414), sort_keys=True))
            for _ in range(2):
                target.import_anki_package(ImportAnkiPackageRequest(package_path=str(package)))
                target.models._clear_cache()
                assert target.db.all('select * from notes where mid=1303378414') == before[0]
                assert target.db.all('select * from cards where nid=?', note.id) == before[1]
                assert json.dumps(target.models.get(1303378414), sort_keys=True) == before[2]
                assert target.db.scalar('select count(*) from notes') == 9
                assert target.models.get(1792748414) is None
        finally:
            target.close()
    with zipfile.ZipFile(package, 'a', zipfile.ZIP_DEFLATED) as z:
        for name in ('LICENSE', 'NOTICE'): z.write(ROOT/name, name)
        z.write(ROOT/'licenses/LXGW-OFL.txt', 'licenses/LXGW-OFL.txt')
        for name in ('react', 'react-dom', 'scheduler'):
            z.write(ROOT/'node_modules'/name/'LICENSE', f'licenses/{name}.txt')
    (site/'renders.json').write_text(json.dumps(renders, ensure_ascii=False))
    result = {'status': 'passed', 'baseline': 'f67c932a02bef79f0feab1121c6783a9a3ff9e17',
              'reactVersion': (ROOT/'VERSION').read_text().strip(), 'notes': 8, 'cards': 8,
              'modelIds': [1792748514, 1792748524], 'productionUnchanged': True,
              'repeatImportNoDuplicates': True, 'sha256': sha(package.read_bytes()),
              'physicalIOS': 'not yet measured; diagnosis only, not a claimed fix'}
    (OUT/'layout-comparison-manifest.json').write_text(json.dumps(result, indent=2))
    (BUILD/'layout-package-results.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    build()
