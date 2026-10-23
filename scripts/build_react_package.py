"""Build collision-safe native Cloze test package in new disposable collections only."""
from pathlib import Path
import sys,json,time,tempfile,hashlib,zipfile,re
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from anki.collection import Collection
from anki.import_export_pb2 import ExportAnkiPackageOptions,ImportAnkiPackageRequest
from anki.models import StockNotetypeKind
from mindmap_examples import blank,node,fields
TEST_MODEL_ID=1792748414
TEST_DECK_ID=1792748415
TEST_NAME='思维导图 · React 测试版'
OUT=ROOT/'dist';OUT.mkdir(exist_ok=True)
BUILD=ROOT/'build';BUILD.mkdir(exist_ok=True)
SITE=BUILD/'react-site';SITE.mkdir(exist_ok=True)
PRODUCTION_MODEL_ID=1303378414

def sha(data):return hashlib.sha256(data).hexdigest()

def compiled():
    assets={}
    for suffix in ('js','css'):
        data=(BUILD/'runtime'/f'_mm_react.{suffix}').read_bytes()
        name=f'_mm_react_{sha(data)[:12]}.{suffix}';assets[name]=data
    templates={}
    for side in ('front','back'):
        text=(ROOT/f'cards/templates/mindmap/{side}.html').read_text()
        for suffix,token in [('js','__MM_SCRIPT__'),('css','__MM_STYLE__')]:text=text.replace(token,next(name for name in assets if name.endswith('.'+suffix)))
        templates[side]=text
    assets['_mm_react_sample.svg']=('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180"><rect width="640" height="180" rx="12" fill="#edf2e8"/><g fill="#3c5946" font-family="sans-serif" font-size="24" text-anchor="middle"><text x="110" y="98">记忆</text><text x="320" y="98">理解</text><text x="530" y="98">应用</text><text x="215" y="98">→</text><text x="425" y="98">→</text></g></svg>').encode()
    return assets,templates

def inputs():
    cases=json.loads((ROOT/'tests/react/fixtures.json').read_text())
    for values in cases.values():
        for field in values:values[field]=values[field].replace('_rule-build.svg','_mm_react_sample.svg')
    cases['welcome']=fields('推理与判断 · React 体验卡',
        node('从结论回到证据',node('一个有效的推理需要什么？',node(blank(1,'<b>前提能够支持结论</b>，并且推理形式有效。','demo-a')+'<br>先想一想，再点击答案或按 ]。')+node('相同编号的另一处：'+blank(1,'结论不能超出前提提供的支持。','demo-b'))))
        +node('阅读辅助',node('试着搜索“必要条件”，搜索不会揭示答案。')+node('必要条件：如果没有它，结果便不能成立。')+node('其他编号：'+blank(2,'充分条件：有它就足以保证结果。','demo-c')))
        +node('公式、表格和图片',node(r'\(P \Rightarrow Q\)'+'<table><tr><th>关系</th><th>含义</th></tr><tr><td>必要</td><td>没有就不行</td></tr><tr><td>充分</td><td>有了就够</td></tr></table><img src="_mm_react_sample.svg" alt="记忆理解应用">'))
        +'<p><a href="#_msocom_1">[1] 查看批注</a> · [关联知识|nid1234567890123]</p><p><a name="_msocom_1"></a>测试批注：条件关系需要结合具体语境理解。批注不会改变答案状态。</p>',
        notes='这是保留下来的填写笔记字段。没有独立弹窗，也不会删除这个字段或内容。',diagram='<h2>复习路线</h2><p>前提 → 推理 → 结论</p><img src="_mm_react_sample.svg" alt="复习路线">')
    # Put the experience card first in the test deck.
    return {'welcome':cases.pop('welcome'),**cases}

def make_model(col,model_id,name,templates):
    # Preserve the established field and template IDs for the requested identity.
    spec=json.loads((ROOT/'cards/note-types.json').read_text())[0]
    model=json.loads(col._backend.get_stock_notetype_legacy(StockNotetypeKind.KIND_CLOZE))
    model.update(id=model_id,name=name,mod=int(time.time()),css='')
    model['flds']=[col.models.new_field(field) for field in spec['fields']]
    for index,field in enumerate(model['flds']):field.update(id=model_id*100+index+1,ord=index)
    model['tmpls'][0].update(id=model_id*100,name=name,ord=0,qfmt=templates['front'],afmt=templates['back'])
    col.models.update(model);return col.models.get(model_id)

def identity(model):return {'id':model['id'],'kind':model['type'],'fields':[(f['id'],f['name'],f['ord']) for f in model['flds']],'templates':[(t['id'],t['ord']) for t in model['tmpls']]}

def build():
    assets,templates=compiled();cases=inputs();renders={};package=OUT/'anki-mindmap-react-test.apkg'
    with tempfile.TemporaryDirectory(prefix='mindmap-react-') as tmp:
        col=Collection(str(Path(tmp)/'source.anki2'))
        try:
            deck=col.decks.new_deck_legacy(False);deck.update(id=TEST_DECK_ID,name='Anki Mindmap · React 测试（独立样例）',mod=int(time.time()));col.decks.update(deck)
            model=make_model(col,TEST_MODEL_ID,TEST_NAME,templates)
            for key,values in cases.items():
                note=col.new_note(model);note.guid='mm-react-test-v1-'+key;note.fields=list(values.values());note.tags=['anki-mindmap::react-test'];col.add_note(note,TEST_DECK_ID)
                renders[key]=[{'id':c.id,'ord':c.ord,'front':c.question(),'back':c.answer()} for c in note.cards()]
            assert [c['ord'] for c in renders['mixed']]==[0,1]
            assert [c['ord'] for c in renders['math']]==[0,29]
            assert [c['ord'] for c in renders['nested']]==[0,1]
            for name,data in assets.items():assert col.media.write_data(name,data)==name
            col.export_anki_package(out_path=str(package),limit=TEST_DECK_ID,options=ExportAnkiPackageOptions(with_media=True,legacy=True,with_scheduling=False,with_deck_configs=False))
            test_identity=identity(model)
        finally:col.close()
        target=Collection(str(Path(tmp)/'existing-production.anki2'))
        try:
            # A pre-existing real-identity model and synthetic scheduled note must remain untouched.
            production=make_model(target,PRODUCTION_MODEL_ID,'思维导图',templates)
            note=target.new_note(production);note.guid='synthetic-existing-production';note.fields=['私人笔记保持不动','<p>原导图</p>','{{c1::已有答案}}'];target.add_note(note,1)
            card=note.cards()[0];card.reps=9;card.ivl=15;target.update_card(card)
            before_note=target.db.all('select * from notes where mid=?',PRODUCTION_MODEL_ID)
            before_card=target.db.all('select * from cards where nid=?',note.id)
            before_model=json.dumps(target.models.get(PRODUCTION_MODEL_ID),sort_keys=True)
            target.import_anki_package(ImportAnkiPackageRequest(package_path=str(package)));target.models._clear_cache()
            assert target.db.all('select * from notes where mid=?',PRODUCTION_MODEL_ID)==before_note
            assert target.db.all('select * from cards where nid=?',note.id)==before_card
            assert json.dumps(target.models.get(PRODUCTION_MODEL_ID),sort_keys=True)==before_model
            for key,values in cases.items():
                nid=target.db.scalar('select id from notes where guid=?','mm-react-test-v1-'+key)
                assert target.get_note(nid).fields==list(values.values())
                assert [c.ord for c in target.get_note(nid).cards()]==[c['ord'] for c in renders[key]]
            for name,data in assets.items():assert (Path(target.media.dir())/name).read_bytes()==data
            # Production compatibility: template-only update does not regenerate identity or scheduling.
            production['tmpls'][0].update(qfmt=templates['front'],afmt=templates['back']);target.models.update(production)
            assert target.db.all('select * from notes where mid=?',PRODUCTION_MODEL_ID)==before_note
            assert target.db.all('select * from cards where nid=?',note.id)==before_card
            target.import_anki_package(ImportAnkiPackageRequest(package_path=str(package)))
            assert target.db.scalar('select count(*) from notes where mid=?',TEST_MODEL_ID)==len(cases)
        finally:target.close()
    licenses={name:(ROOT/'node_modules'/name/'LICENSE').read_bytes() for name in ('react','react-dom','scheduler')}
    with zipfile.ZipFile(package,'a',zipfile.ZIP_DEFLATED) as z:
        for name,data in licenses.items():z.writestr('licenses/'+name+'.txt',data)
        for name in ('LICENSE','NOTICE'):z.write(ROOT/name,name)
    for name,data in assets.items():(SITE/name).write_bytes(data)
    for key,cards in renders.items():
        for i,card in enumerate(cards):
            for side in ('front','back'):(SITE/f'{key}-{i}-{side}.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+card[side])
    links=''.join(f'<li><a href="{key}-{i}-front.html">{key} c{card["ord"]+1}</a></li>' for key,cards in renders.items() for i,card in enumerate(cards))
    (SITE/'index.html').write_text('<!doctype html><meta charset="utf-8"><h1>React 本地调试</h1><ul>'+links+'</ul>')
    (BUILD/'react-renders.json').write_text(json.dumps(renders,ensure_ascii=False))
    manifest={'version':(ROOT/'VERSION').read_text().strip(),'testModel':test_identity,'productionModelId':PRODUCTION_MODEL_ID,'notes':len(cases),'cards':sum(map(len,renders.values())),'checks':['native same/multiple/gapped/nested Cloze ordinals','full fields/media/identity round trip','existing production model/note/scheduling untouched by test import','repeat import does not duplicate test notes','template update preserves original note/card rows'],'assets':{name:sha(data) for name,data in assets.items()},'apkgSha256':sha(package.read_bytes())}
    (OUT/'react-test-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    (BUILD/'native-results.json').write_text(json.dumps({'status':'passed',**manifest},ensure_ascii=False,indent=2))
    (OUT/'SHA256SUMS').write_text(sha(package.read_bytes())+'  '+package.name+'\n')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
    return package
if __name__=='__main__':build()
