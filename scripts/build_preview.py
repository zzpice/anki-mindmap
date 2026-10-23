"""Build an anonymous template debugging site using temporary official Anki collections."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

from anki.collection import Collection
from anki import buildinfo

from build_package import make_model
from preview_scenes import scenes
from sources import read_source

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def public_cases():
    cases = json.loads(read_source('samples.json'))
    for key, fields, tags in scenes():
        cases.append({'key': 'complex-' + key, 'type': key, 'label': '复杂图文与长内容',
                      'fields': fields, 'tags': tags, 'group': 'complex'})
    return cases


def render_version(cards_root, cases, destination):
    specs = {s['key']: s for s in json.loads(read_source('note-types.json', root=cards_root))}
    rendered = {}
    with tempfile.TemporaryDirectory() as temporary:
        collection = Collection(str(Path(temporary) / 'collection.anki2'))
        try:
            models = {key: make_model(collection, s, 1800000000, source_root=cards_root)
                      for key, s in specs.items()}
            for case in cases:
                spec = specs.get(case['type'])
                if not spec or any(value and field not in spec['fields'] for field, value in case['fields'].items()):
                    rendered[case['key']] = {'unavailable': '此版本没有对应类型或字段，无法用同一示例对照。'}
                    continue
                note = collection.new_note(models[case['type']])
                for field, value in case['fields'].items():
                    if field in spec['fields']:
                        note[field] = value
                note.tags = case.get('tags', [])
                collection.add_note(note, 1)
                cards = note.cards()
                rendered[case['key']] = {'cards': [{'front': c.question(), 'back': c.answer(),
                                                   'ordinal': c.ord + 1} for c in cards]}
        finally:
            collection.close()
    destination.mkdir(parents=True)
    (destination / 'media').mkdir()
    active_html = json.dumps(rendered, ensure_ascii=False)
    for asset in (cards_root / 'media').iterdir():
        if asset.is_file() and (asset.suffix != '.js' or asset.name in active_html):
            shutil.copy2(asset, destination / 'media' / asset.name)
    payload = json.dumps(rendered, ensure_ascii=False).replace('<', '\\u003c')
    (destination / 'cards.js').write_text('window.previewCards=' + payload + ';\n')
    for name in ['frame.html', 'frame.js']:
        shutil.copy2(ROOT / 'preview' / name, destination / name)
    return {key: len(value.get('cards', [])) for key, value in rendered.items()}


def native_assets(destination):
    assert importlib.metadata.version('anki') == importlib.metadata.version('aqt'), 'Use matching anki and aqt versions'
    web = Path(importlib.metadata.distribution('aqt').locate_file('_aqt/data/web'))
    for name in ['css/reviewer.css', 'js/reviewer.js', 'js/vendor/jquery.min.js']:
        target = destination / 'native' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(web / name, target)
    # Convey the matching upstream source alongside the unmodified AGPL reviewer.
    cache = ROOT / 'build' / ('anki-source-' + buildinfo.buildhash + '.tar.gz')
    if not cache.exists():
        cache.parent.mkdir(exist_ok=True)
        with urllib.request.urlopen('https://codeload.github.com/ankitects/anki/tar.gz/' + buildinfo.buildhash, timeout=60) as response:
            data = response.read()
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            assert any(n.endswith('/LICENSE') for n in archive.getnames())
        cache.write_bytes(data)
    target = destination / 'third-party'
    target.mkdir()
    shutil.copy2(cache, target / 'anki-source.tar.gz')
    with tarfile.open(cache) as archive:
        member = next(m for m in archive.getmembers() if m.name.count('/') == 1 and m.name.endswith('/LICENSE'))
        (target / 'Anki-LICENSE').write_bytes(archive.extractfile(member).read())
    return {'version': importlib.metadata.version('anki'), 'sourceCommit': buildinfo.buildhash,
            'source': 'third-party/anki-source.tar.gz',
            'sourceSha256': hashlib.sha256(cache.read_bytes()).hexdigest(),
            'reviewerSha256': {name: hashlib.sha256((web / name).read_bytes()).hexdigest()
                               for name in ['css/reviewer.css', 'js/reviewer.js', 'js/vendor/jquery.min.js']}}


def build_preview(output=ROOT / 'build/preview-site', baseline_ref=None):
    output = Path(output).resolve()
    if output.exists() and not (output / 'manifest.json').is_file():
        raise ValueError('Refusing to replace a directory not created by this preview builder')
    if output.exists():
        assert json.loads((output / 'manifest.json').read_text()).get('kind') == 'anki-template-preview'
    current = git('rev-parse', 'HEAD')
    baseline = git('rev-parse', '--verify', '--end-of-options', (baseline_ref or 'HEAD') + '^{commit}')
    cases = public_cases()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as temporary:
        stage = Path(temporary) / 'site'
        stage.mkdir()
        with tempfile.TemporaryDirectory() as previous:
            archive = subprocess.check_output(['git', 'archive', baseline, 'cards'], cwd=ROOT)
            with tarfile.open(fileobj=io.BytesIO(archive)) as files:
                files.extractall(previous, filter='data')
            versions = [
                {'key': 'current', 'label': '当前修改', 'commit': current,
                 'dirty': bool(git('status', '--porcelain', '--', 'cards')),
                 'counts': render_version(ROOT / 'cards', cases, stage / 'versions/current')},
                {'key': 'baseline', 'label': '对照版本', 'commit': baseline, 'dirty': False,
                 'counts': render_version(Path(previous) / 'cards', cases, stage / 'versions/baseline')},
            ]
        native = native_assets(stage)
        manifest = {'kind': 'anki-template-preview', 'generatedAt': datetime.now(timezone.utc).isoformat(),
                    'repository': 'https://github.com/zzpice/anki-mindmap', 'versions': versions, 'anki': native,
                    'types': [{'key': s['key'], 'name': s['name']} for s in json.loads(read_source('note-types.json'))],
                    'cases': [{k: case[k] for k in ['key', 'type', 'label']} for case in cases],
                    'verification': '官方 Anki 后端生成；网页为浏览器预览，不代表 AnkiMobile 实机验证。'}
        (stage / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        (stage / 'manifest.js').write_text('window.previewManifest=' + json.dumps(manifest, ensure_ascii=False).replace('<', '\\u003c') + ';\n')
        for name in ['index.html', 'app.css', 'app.js']:
            shutil.copy2(ROOT / 'preview' / name, stage / name)
        for name in ['LICENSE', 'NOTICE']:
            shutil.copy2(ROOT / name, stage / name)
        shutil.copytree(ROOT / 'licenses', stage / 'licenses')
        if output.exists():
            shutil.rmtree(output)
        shutil.move(str(stage), output)
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'build/preview-site')
    parser.add_argument('--baseline-ref', help='Git commit/ref for the same-data comparison; default HEAD')
    args = parser.parse_args()
    result = build_preview(args.output, args.baseline_ref)
    print('Preview built:', args.output, '|', len(result['cases']), 'anonymous scenes | Anki', result['anki']['version'])
