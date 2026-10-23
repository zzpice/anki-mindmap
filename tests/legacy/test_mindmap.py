"""Native Anki renders the current three-field offline mindmap template."""
import json
from html import unescape
import os
from pathlib import Path
import sys
import tempfile
import unittest

from anki.collection import Collection
from anki.import_export_pb2 import ExportAnkiPackageOptions, ImportAnkiPackageRequest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_package as package
from mindmap_examples import blank, node, tree, fields


def cases():
    image = '<img src="_rule-build.svg" alt="anonymous image">'
    deep = node(blank(1, 'Deep answer', 'deep'))
    for index in range(12):
        deep = node('Level ' + str(index), deep)
    result = {
        'overview': fields('Overview', node('Root', node(blank(1, 'Answer', 'answer'))) + node('Sibling', node('Other'))),
        'mixed': fields('Mixed', node('Root', node(blank(1, '<b>答案</b>', 'mixed-a') + ' / ' + blank(1, '第二', 'mixed-b')) + node(blank(2, '另一个编号', 'mixed-c')))),
        'image': fields('Image', node('图片题', node(blank(1, image, 'image-a'))) + node('普通图片', node(image)), '<p>Local personal note</p>', image),
        'flat': {'填写笔记': '', '导图': '', 'Text': blank(1, '<b>Flat answer</b>', 'flat')},
        'deep': fields('Deep', deep),
        'reading': {'填写笔记': blank(1, 'Whole-note card', 'reading'), '导图': '', 'Text': tree('Reading', node('Complete context', node(blank(2, 'Other body card', 'reading-body'))))},
        'table': fields('Table', node('Table', node('<table><tr><td>中文</td><td>'+blank(1, 'Cell answer', 'cell')+'</td></tr></table>'))),
        'math': fields('Math', node(blank(1, '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>', 'mathml')) + node(r'{{c30::\(x^2\)}}')),
        'nested': fields('Nested', node('{{c1::Outer {{c2::Inner}}}}')),
        'plain': fields('Native cloze', node('Root', node('{{c1::Plain answer::提示}}'))),
        'bookmark': fields('Bookmark', node('保留正文<a name="bookmark"></a> 后续正文', node(blank(1, 'Answer', 'bookmark')))),
        'annotations': fields('Annotations', node('Root', node(blank(1, 'Answer', 'annotation')))
            + '<li><a href="#_msocom_42">Note 42</a> / <a href="#_msocom_7">Note 7</a>'
            + ' / <a href="#_msocom_99">Missing</a> / <a href="#_msocom_8">Inline</a></li>'),
        'links': fields('Links', node('[Local|nid1234567890123]', node(blank(1, '<b>Rich</b> [Answer link|nid1234567890124]', 'link')))),

    }

    result['annotations']['Text'] += (
        '<p><a name="_msocom_7"></a>Second annotation</p>'
        '<p><a name="_msocom_42"></a>First annotation<img src="_rule-build.svg">'
        '<a href="#_msoanchor_42">Return</a></p>'
        '<p><a name="_msocom_88"></a>Unreferenced annotation</p>'
        '<p>Preceding prose<a name="_msocom_8"></a>Inline text</p>')
    return result


class MindMapTests(unittest.TestCase):
    def test_native_cloze_and_browser_fixtures(self):
        spec = next(s for s in package.specifications() if s['key'] == 'mindmap')
        self.assertEqual(spec['fields'], ['填写笔记', '导图', 'Text'])
        with tempfile.TemporaryDirectory() as directory:
            collection = Collection(str(Path(directory) / 'collection.anki2'))
            try:
                model = package.make_model(collection, spec, 1800000000)
                self.assertEqual(model['css'], package.read_source(spec['css']))
                rendered = {}
                for key, values in cases().items():
                    note = collection.new_note(model)
                    for field, value in values.items():
                        note[field] = value
                    collection.add_note(note, 1)
                    cards = note.cards()
                    self.assertEqual(len(cards), 2 if key in ('mixed', 'reading', 'math', 'nested') else 1)
                    rendered[key] = [{'front': c.question(), 'back': c.answer()} for c in cards]
                    for card in cards:
                        self.assertIn('class="linkRender"', card.question())
                        self.assertIn('custom2ButtonToggle', card.question())
                        self.assertNotIn('_mindmap.js', card.question())
                    if key != 'reading':
                        self.assertIn('data-cloze=', cards[0].question())
                        self.assertIn('data-ordinal="1"', cards[0].answer())
                self.assertEqual(rendered['mixed'][0]['front'].count('class="cloze"'), 2)
                self.assertTrue('cz-1' in unescape(rendered['image'][0]['front']))
                if os.environ.get('ANKI_RENDER_OUTPUT'):
                    target = Path(os.environ['ANKI_RENDER_OUTPUT']).parent / 'mindmap-cases.json'
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(json.dumps(rendered, ensure_ascii=False))
            finally:
                collection.close()

    def test_export_import_preserves_fields_and_media(self):
        spec = next(s for s in package.specifications() if s['key'] == 'mindmap')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = Collection(str(root / 'source.anki2'))
            try:
                model = package.make_model(source, spec, 1800000000)
                for key, values in cases().items():
                    note = source.new_note(model)
                    note.guid = 'offline-mindmap-' + key
                    note.fields = list(values.values())
                    source.add_note(note, 1)
                for name in package.media_names():
                    self.assertEqual(source.media.write_data(name, (package.CARDS / 'media' / name).read_bytes()), name)
                archive = root / 'mindmap.apkg'
                source.export_anki_package(out_path=str(archive), limit=None,
                    options=ExportAnkiPackageOptions(with_media=True, legacy=True, with_scheduling=False))
                target = Collection(str(root / 'target.anki2'))
                try:
                    target.import_anki_package(ImportAnkiPackageRequest(package_path=str(archive)))
                    self.assertEqual(target.note_count(), len(cases()))
                    self.assertEqual(len(target.find_cards('')), len(cases()) + 4)
                    for key, values in cases().items():
                        nid = target.db.scalar('select id from notes where guid=?', 'offline-mindmap-' + key)
                        self.assertEqual(target.get_note(nid).fields, list(values.values()))
                    for name in ['_rule-build.svg', '_jquery.mark.es6.js', '_guoqijihua_lxgwgbr.ttf']:
                        self.assertEqual((Path(target.media.dir()) / name).read_bytes(), (package.CARDS / 'media' / name).read_bytes())
                finally:
                    target.close()
            finally:
                source.close()


if __name__ == '__main__':
    unittest.main()
