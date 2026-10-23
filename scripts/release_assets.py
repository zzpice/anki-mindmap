"""Bundle fully expanded templates and checksums beside the tested .apkg; never rebuild it."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import subprocess
import zipfile

from sources import read_source

ROOT = Path(__file__).resolve().parents[1]


def release_assets(directory=ROOT / 'dist'):
    directory = Path(directory)
    package = directory / 'anki-mindmap.apkg'
    if not package.is_file():
        raise ValueError('Build and test dist/anki-mindmap.apkg before assembling release assets')
    version = (ROOT / 'VERSION').read_text().strip()
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('VERSION must use major.minor.patch')
    archive = directory / 'anki-mindmap-templates.zip'
    specs = json.loads(read_source('note-types.json'))
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
        for spec in specs:
            for side in ('front', 'back'):
                output.writestr(f"{spec['key']}/{side}.html", read_source(spec[side]))
            css = read_source(spec['css'])
            output.writestr(f"{spec['key']}/style.css", css)
        for path in sorted((ROOT / 'cards/media').iterdir()):
            if path.is_file():
                output.write(path, 'media/' + path.name)
        output.writestr('note-types.json', read_source('note-types.json'))
        for name in ('LICENSE', 'NOTICE', 'README.md', 'VERSION', 'AGENTS.md'):
            output.write(ROOT / name, name)
        for path in sorted((ROOT / 'licenses').glob('*')):
            if path.is_file():
                output.write(path, path.relative_to(ROOT))
        for path in sorted((ROOT / 'docs').rglob('*')):
            if path.is_file():
                output.write(path, path.relative_to(ROOT))
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    info = {'repository': 'zzpice/anki-mindmap', 'version': version, 'commit': commit,
            'anki': importlib.metadata.version('anki'),
            'note_types': [s['name'] for s in specs],
            'package': package.name, 'templates': archive.name}
    manifest = directory / 'build-info.json'
    manifest.write_text(json.dumps(info, ensure_ascii=False, indent=2) + '\n')
    files = [package, archive, manifest]
    (directory / 'SHA256SUMS').write_text(''.join(
        hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + path.name + '\n' for path in files))
    return files


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    for file in release_assets(args.directory):
        print(file)
