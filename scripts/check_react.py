"""Fast source/identity/offline contract checks; runtime behavior is tested separately."""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
spec=json.loads((ROOT/'cards/note-types.json').read_text())[0]
assert spec['id']==1303378414 and spec['kind']=='cloze'
assert spec['fields']==['填写笔记','导图','Text']
for side in ('front','back'):
    text=(ROOT/f'cards/templates/mindmap/{side}.html').read_text()
    assert '{{cloze:Text}}' in text and '{{cloze:填写笔记}}' in text
    assert 'FrontSide' not in text
    assert not re.search(r'(?:src|href)=["\'](?:https?:)?//',text)
sources='\n'.join(p.read_text() for p in (ROOT/'src').glob('*') if p.suffix in ('.ts','.tsx'))
assert 'jquery' not in sources.lower()
assert 'data-mm-notes-fallback' in sources
assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|setInterval)\s*\(',sources)
assert '填写笔记' not in (ROOT/'src/ui.tsx').read_text()
assert '@import' not in (ROOT/'src/style.css').read_text()
assert not re.search(r'url\(', (ROOT/'src/style.css').read_text())
print('React source, native identity, field preservation and offline checks passed')
