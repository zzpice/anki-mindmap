"""Check compiled templates, fields, offline resources, links and repository scope."""
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit

from sources import read_source

ROOT = Path(__file__).resolve().parents[1]
CARDS = ROOT / 'cards'


def check_paths():
    for source in [*ROOT.glob('*.md'), *(ROOT / 'docs').rglob('*.md')]:
        text = re.sub(r'```.*?```', '', source.read_text(), flags=re.S)
        text = re.sub(r'`[^`]*`', '', text)
        links = re.findall(r'\]\(([^\s)]+)\)', text)
        links += re.findall(r'<(?:a|img)\b[^>]*\b(?:href|src)="([^"]+)"', text)
        for value in links:
            url = urlsplit(value)
            if url.scheme or url.netloc:
                continue
            target = (source.parent / unquote(url.path)).resolve() if url.path else source
            assert target.is_relative_to(ROOT) and target.exists(), f'{source}: missing {value}'
            if url.fragment and target.suffix == '.md':
                headings = re.findall(r'^#+ (.+)$', target.read_text(), re.M)
                anchors = {re.sub(r'[^\w\s-]', '', h.lower()).replace(' ', '-') for h in headings}
                assert unquote(url.fragment) in anchors, f'{source}: missing anchor {value}'


def check():
    check_paths()
    specs = json.loads(read_source('note-types.json'))
    assert [s['key'] for s in specs] == ['mindmap']
    assert specs[0]['id'] == 1303378414 and specs[0]['kind'] == 'cloze'
    assert specs[0]['fields'] == ['填写笔记', '导图', 'Text']
    assert {p.name for p in (CARDS / 'templates').iterdir()} == {'mindmap'}
    assert {p.name for p in (CARDS / 'media').iterdir()} == {
        '_jquery.mark.es6.js', '_guoqijihua_lxgwgbr.ttf', '_rule-build.svg'}
    for spec in specs:
        fields = set(spec['fields']) | {'FrontSide', 'Tags', 'Deck'}
        assert len(fields) == len(spec['fields']) + 3
        for side in ('front', 'back'):
            source = read_source(spec[side])
            assert 'include:' not in source
            stack = []
            for token in re.findall(r'{{(.*?)}}', source):
                if token.startswith(('#', '^')):
                    stack.append(token[1:])
                elif token.startswith('/'):
                    assert stack and stack.pop() == token[1:], spec[side]
                assert token.lstrip('#/^').split(':')[-1] in fields, spec[side]
            assert not stack, spec[side]
            assert not re.search(r'(?:src|href)=["\'](?:https?:)?//', source), spec[side]
            for media in re.findall(r'<script src="([^"]+)"', source):
                assert media.startswith('_') and (CARDS / 'media' / media).is_file(), media
            for code in re.findall(r'<script\b[^>]*>(.*?)</script>', source, re.S):
                assert '{{' not in code
                assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(', code)
                subprocess.run(['node', '--check'], input=code, text=True, check=True)
        css = read_source(spec['css'])
        assert '@import' not in css and 'include:' not in css
        for resource in re.findall(r'url\([\"\']?([^\)\"\']+)', css):
            assert not urlsplit(resource).scheme and (CARDS / 'media' / resource).is_file(), resource
    for path in (CARDS / 'media').glob('*.js'):
        code = path.read_text()
        assert '{{' not in code
        assert not re.search(r'\b(?:fetch|XMLHttpRequest|localStorage|setInterval)\b', code)
        assert not re.search(r'<script[^>]+https?://', code)
        subprocess.run(['node', '--check', str(path)], check=True)
    for name in ('web', 'downloads', 'index.html', 'preview.html', 'tools.html', '.nojekyll', 'scripts/authoring.py'):
        assert not (ROOT / name).exists(), f'Out-of-scope website artifact: {name}'
    for path in (ROOT / 'preview').glob('*.js'):
        subprocess.run(['node', '--check', str(path)], check=True)
        assert not re.search(r'localhost:8765|127\.0\.0\.1:8765|AnkiConnect', path.read_text()), 'Preview must not connect to personal Anki'
    package = json.loads((ROOT / 'package.json').read_text())
    assert not package.get('dependencies'), 'Card runtime must not have npm dependencies'
    assert package['version'] == (ROOT / 'VERSION').read_text().strip()
    print('Template Check passed')


if __name__ == '__main__':
    check()
