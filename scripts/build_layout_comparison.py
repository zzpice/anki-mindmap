"""Independent, anonymous native-device comparison; never updates daily templates.

Run prepare_visual_comparison.py first. The pinned legacy source lives only in
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
from mindmap_examples import blank, node, fields
from prepare_visual_comparison import BASELINE


def long_cases(images):
    """Same ordinary field HTML for both runtimes; no layout repair or timers."""
    def image(label, dimensions=True):
        size = ' width="720" height="8400"' if dimensions else ''
        return f'<img src="{images[label]}" alt="匿名长图 {label}，12 段" data-mm-long-image="{label}"{size}>'

    def prose(count, prefix):
        return ''.join(node(f'{prefix} {i+1:02d}：先确定比较对象，再保留已知条件，按正文顺序检查每一步推导。',
                            note='用于形成真实可滚动的正文，请观察边栏分界和文字是否移动。') for i in range(count))

    diagram = '<p>本组测试的长图在正文中，请保持此弹窗关闭。</p><img src="_mm_react_sample.svg">'
    return {
        'long-image-visible': fields('01 长图始终可见 · 先测这一张', node(
            '正面和背面都有长图。请滚到图片中部、底部，再翻面观察边栏。',
            node('当前考查：'+blank(1, '这是文字答案，长图不依赖答案显隐。', 'layout-long-visible'))+
            node('长图 A：请从 A01 滑到 A12。'+image('A'))+prose(4, '图片后正文')), diagram=diagram),
        'long-image-answer': fields('02 点击挖空或翻面 · 揭示长图', node(
            '当前答案是一张长图。先上下滑动，再点击挖空或使用 Anki 显示答案。',
            prose(24, '前置知识')+node('当前考查：'+blank(1,
                '长图答案开始'+image('B', dimensions=False)+'长图答案结束', 'layout-long-answer'))+
            prose(10, '答案后正文')), diagram=diagram),
        'long-image-pair': fields('03 连续两张长图 · 在中部翻面', node(
            '两张图之间是当前挖空，后面还有正文。请分别在上部、中部、底部翻面。',
            node('上半部 · 长图 A'+image('A'))+prose(8, '图间正文')+
            node('当前考查：'+blank(1, '这是两张长图之间的文字答案。', 'layout-long-pair'))+
            node('下半部 · 长图 B'+image('B', dimensions=False))+prose(12, '尾部正文')), diagram=diagram),
    }


def build():
    original_root = BUILD / 'visual-main'
    spec = importlib.util.spec_from_file_location('comparison_original', original_root / 'scripts/build_package.py')
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    assets, templates = compiled()
    images = {}
    for label in ('A', 'B'):
        data = (ROOT/f'tests/react/media/long-study-{label.lower()}.png').read_bytes()
        name = f'_mm_layout_{sha(data)[:12]}.png'
        assets[name] = data; images[label] = name
    font = next(name for name in assets if name.endswith('.ttf'))
    media_names = {'_guoqijihua_lxgwgbr.ttf': font}
    for file in (original_root / 'cards/media').iterdir():
        # The baseline needs its local helper script. Sample images already
        # use the React sample asset, so do not package an unused legacy SVG.
        if file.suffix == '.js':
            data = file.read_bytes()
            name = f'_mm_main_{sha(data)[:12]}{file.suffix}'
            assets[name] = data
            media_names[file.name] = name
    probe = (ROOT / 'tests/react/layout-probe.html').read_text()
    version = (ROOT / 'VERSION').read_text().strip()
    names = {'main': f'旧版基线 {BASELINE[:7]}', 'react': 'React'}
    labels = {**names, 'react': f'React {version}'}
    all_inputs = inputs()
    cases = {**long_cases(images), **{key: all_inputs[key] for key in ('overview', 'deep', 'wide-review', 'image')}}
    count = len(cases)*2
    package = OUT / 'anki-mindmap-layout-comparison.apkg'
    site = BUILD / 'layout-comparison'; site.mkdir(exist_ok=True)
    renders = {}
    with tempfile.TemporaryDirectory(prefix='mindmap-layout-') as directory:
        col = Collection(str(Path(directory) / 'source.anki2'))
        try:
            # Neither the production model nor the normal React test model is included.
            # Keep internal keys and GUIDs stable for repeat imports; display the
            # pinned legacy version explicitly now that main contains React.
            for kind, mid in (('main', 1792748514), ('react', 1792748524)):
                name = f'边栏对照 · {names[kind]}'
                if kind == 'main':
                    contract = json.loads((original_root / 'cards/note-types.json').read_text())[0]
                    contract.update(id=mid, name=name)
                    model = original.make_model(col, contract, int(time.time()), source_root=original_root / 'cards')
                    # Change asset aliases, never the pinned legacy business code.
                    # Generic legacy filenames must not collide with daily media.
                    for before, after in media_names.items():
                        model['css'] = model['css'].replace(before, after)
                        for field in ('qfmt', 'afmt'):
                            model['tmpls'][0][field] = model['tmpls'][0][field].replace(before, after)
                else:
                    model = make_model(col, mid, name, templates)
                for side, field in (('front', 'qfmt'), ('back', 'afmt')):
                    model['tmpls'][0][field] += probe.replace('__KIND__', kind).replace('__SIDE__', side).replace('__LABEL__', labels[kind])
                col.models.update(model)
                deck = col.decks.new_deck_legacy(False)
                deck.update(id=mid+1, name=f'Anki Mindmap · 边栏对照（独立样例）::{names[kind]}')
                col.decks.update(deck)
                long_deck = col.decks.new_deck_legacy(False)
                long_deck.update(id=mid+21, name=deck['name']+'::长图复现')
                col.decks.update(long_deck)
                for key, values in cases.items():
                    note = col.new_note(model)
                    note.guid = f'mm-layout-v1-{kind}-{key}'
                    note.fields = list(values.values()); note.tags = ['mm-layout::'+key]
                    col.add_note(note, long_deck['id'] if key.startswith('long-') else deck['id'])
                    renders[f'{kind}-{key}'] = [{'front': c.question(), 'back': c.answer()} for c in note.cards()]
            assert col.db.scalar('select count(*) from notes') == count
            assert col.db.scalar('select count(*) from cards') == count
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
            sentinel = b'Existing unrelated media must stay unchanged'
            target.media.write_data('_jquery.mark.es6.js', sentinel)
            before = (target.db.all('select * from notes'), target.db.all('select * from cards'),
                      json.dumps(target.models.get(1303378414), sort_keys=True))
            for _ in range(2):
                target.import_anki_package(ImportAnkiPackageRequest(package_path=str(package)))
                target.models._clear_cache()
                assert target.db.all('select * from notes where mid=1303378414') == before[0]
                assert target.db.all('select * from cards where nid=?', note.id) == before[1]
                assert json.dumps(target.models.get(1303378414), sort_keys=True) == before[2]
                assert target.db.scalar('select count(*) from notes') == count+1
                assert target.models.get(1792748414) is None
                assert (Path(target.media.dir())/'_jquery.mark.es6.js').read_bytes() == sentinel
                for name, data in assets.items():
                    assert (Path(target.media.dir())/name).read_bytes() == data
                for kind in ('main', 'react'):
                    for key, values in cases.items():
                        nid = target.db.scalar('select id from notes where guid=?', f'mm-layout-v1-{kind}-{key}')
                        assert target.get_note(nid).fields == list(values.values())
        finally:
            target.close()
    with zipfile.ZipFile(package, 'a', zipfile.ZIP_DEFLATED) as z:
        for name in ('LICENSE', 'NOTICE'): z.write(ROOT/name, name)
        z.write(ROOT/'licenses/LXGW-OFL.txt', 'licenses/LXGW-OFL.txt')
        z.write(ROOT/'licenses/mark.js-LICENSE.txt', 'licenses/mark.js-LICENSE.txt')
        for name in ('react', 'react-dom', 'scheduler'):
            z.write(ROOT/'node_modules'/name/'LICENSE', f'licenses/{name}.txt')
    (site/'renders.json').write_text(json.dumps(renders, ensure_ascii=False))
    result = {'status': 'passed', 'baseline': BASELINE,
              'reactVersion': version, 'fixtureRevision': 3, 'displayLabels': labels, 'notes': count, 'cards': count,
              'longImageCases': list(long_cases(images)), 'longImagePixels': [720, 8400],
              'modelIds': [1792748514, 1792748524], 'productionUnchanged': True,
              'existingLegacyMediaUnchanged': True, 'contentAddressedLegacyMedia': True,
              'repeatImportNoDuplicates': True, 'sha256': sha(package.read_bytes()),
              'physicalIOS': 'See verification.json for scoped user device feedback; browser checks are not device certification'}
    (OUT/'layout-comparison-manifest.json').write_text(json.dumps(result, indent=2))
    (BUILD/'layout-package-results.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    build()
