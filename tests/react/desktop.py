"""Actual aqt previewer/reviewer, unique disposable profile, auto-sync disabled."""
from pathlib import Path
import os
import json
import sys
import tempfile
import traceback
import uuid
import platform
import importlib.metadata

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / 'build'
os.environ['ANKI_SINGLE_INSTANCE_KEY'] = 'mindmap-stage01-' + uuid.uuid4().hex
os.environ['ANKI_SOFTWAREOPENGL'] = '1'
os.environ['QTWEBENGINE_CHROMIUM_FLAGS'] = '--disable-gpu'
import aqt
from aqt import gui_hooks
from aqt.profiles import ProfileManager
from aqt.browser.previewer import MultiCardPreviewer
from aqt.qt import QTimer, QT_VERSION_STR, PYQT_VERSION_STR
from aqt.theme import Theme
from anki.import_export_pb2 import ImportAnkiPackageRequest
from anki.collection import Config
from PyQt6.QtWebEngineCore import QWebEngineUrlRequestInterceptor

base = Path(tempfile.mkdtemp(prefix='isolated-qt-', dir=BUILD))
assert base.parent == BUILD
pm = ProfileManager(base)
pm.setupMeta(); pm.create('Stage01 isolated'); pm.load('Stage01 isolated')
pm.meta.update(firstRun=False, defaultLang='en_US', check_for_updates=False, check_for_addon_updates=False)
pm.profile['autoSync'] = False
pm.set_theme(Theme.LIGHT); pm.save(); pm.db.close()

class Preview(MultiCardPreviewer):
    def __init__(self, card):
        self.selected, self.changed = card, True
        super().__init__(None, aqt.mw, lambda: None)
    def card(self): return self.selected
    def card_changed(self):
        value, self.changed = self.changed, False
        return value
    def select(self, card):
        self.selected, self.changed, self._last_state = card, True, None
        self.render_card()
    def type_ans_preview_filter(self, text, side):
        return super().type_ans_preview_filter(text, side) + f'<i hidden data-frame="{self.selected.id}:{side}"></i>'

result = {'status': 'running', 'anki': importlib.metadata.version('anki'), 'aqt': importlib.metadata.version('aqt'), 'qt': QT_VERSION_STR, 'pyqt': PYQT_VERSION_STR, 'os': platform.platform(), 'profile': str(base), 'autoSync': False, 'preview': [], 'review': [], 'limitations': ['no physical mobile devices or gamepad', 'Desktop test is software-driven in isolated profile; no human touchscreen/keyboard usability certification']}
class LocalOnly(QWebEngineUrlRequestInterceptor):
    def interceptRequest(self, info):
        url=info.requestUrl()
        if url.scheme() in ('http','https') and url.host() not in ('127.0.0.1','localhost'):
            info.block(True)
            result.setdefault('blockedExternalRequests',[]).append(url.toString())
        if url.fileName().startswith('_mm_react_'):
            result.setdefault('localMediaRequests',[]).append(url.toString())
interceptor=None
preview = None
finished = False
checks = []
index = 0

SNAPSHOT = r'''(() => {
 const runtime=typeof AnkiMindmap==='undefined'?null:AnkiMindmap.current();
 if(!runtime||!document.querySelector('[data-mm-ui] button'))return null;
 const c=document.querySelector('[data-mm-content]');
 const info=runtime.inspect();
 return {frame:document.querySelector('[data-frame]')?.dataset.frame, ...info,
 font:{family:getComputedStyle(document.body).fontFamily,ready:document.fonts.check("16px lxgw")},
 ua:navigator.userAgent, images:[...c.querySelectorAll('img')].map(x=>({src:x.getAttribute('src'),loaded:x.complete&&x.naturalWidth>0})),
 mathML:c.querySelectorAll('math').length, typeset:c.querySelectorAll('mjx-container').length,
 edgeFrame:(() => {
 const frame=document.querySelector('nav').getBoundingClientRect();
 return {height:frame.height, bars:[...document.querySelectorAll('nav button')].map(b=>{
 const r=b.getBoundingClientRect(),t=b.querySelector('.mm-edge-label > span').getBoundingClientRect();
 return {height:r.height, centerError:Math.abs(t.y+t.height/2-r.y-r.height/2)};})};})(),
 activeTypeset:[...c.querySelectorAll('.cloze')].map(x=>x.querySelectorAll('mjx-container').length),
 mathItems:window.MathJax?.startup?.document?.getMathItemsWithin(c)?.length,
 text:c.textContent, hooks:{shown:typeof onShownHook==='undefined'?null:onShownHook.length, update:typeof onUpdateHook==='undefined'?null:onUpdateHook.length}};
})()'''

def stop(error=None):
    global finished
    if finished: return
    finished = True
    result['status'] = 'failed' if error else 'passed'
    if error: result['error'] = error
    (BUILD / 'desktop-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({'status':result['status'], 'preview':len(result['preview']), 'review':len(result['review']), 'error':error}), flush=True)
    if preview is not None and preview._web is not None: preview.close()
    # Do not enter the interactive close-all-windows/media-sync dialog workflow.
    # Only this disposable profile exists in this uniquely keyed process.
    mw=aqt.mw
    mw.moveToState('deckBrowser')
    mw.restoring_backup=True  # no disposable-profile backup on shutdown
    mw._unloadCollection()
    mw._unloadProfile()
    mw.cleanupAndExit()

def poll_preview(cid, side, attempt=0):
    def got(value):
        try:
            if not value or value.get('frame') != f'{cid}:{side}' or value['side'] != ('front' if side=='question' else 'back') or not value.get('font',{}).get('ready'):
                if attempt > 100: raise AssertionError(('preview timeout', cid, side, value))
                QTimer.singleShot(60, lambda:poll_preview(cid, side, attempt+1)); return
            assert value['alive'] and value['resources']['reactRoots']==1
            for bar in value['edgeFrame']['bars']:
                assert abs(bar['height']-value['edgeFrame']['height']/2)<1,value['edgeFrame']
                assert bar['centerError']<1,value['edgeFrame']
            assert value['font']['family'].startswith('lxgw')
            assert all(v==(side=='answer') for v in value['state']['revealed'].values()), value
            result['preview'].append(value)
            if len(result['preview']) <= 4: preview._web.grab().save(str(BUILD / f'desktop-preview-{len(result["preview"])}.png'))
            QTimer.singleShot(30, advance_preview)
        except Exception: stop(traceback.format_exc())
    preview._web.evalWithCallback(SNAPSHOT, got)

def advance_preview():
    global index
    if finished:return
    if index >= len(checks):
        preview.close()
        QTimer.singleShot(100, direct_back); return
    cid,side = checks[index]; index += 1
    if side=='question': preview.select(aqt.mw.col.get_card(cid))
    else: preview._on_next()
    QTimer.singleShot(150, lambda:poll_preview(cid,side))

def poll_review(side, callback, attempt=0):
    if finished:return
    def got(value):
        try:
            if not value or value['side']!=side:
                if attempt>100:raise AssertionError(('review timeout', side, value))
                QTimer.singleShot(60,lambda:poll_review(side,callback,attempt+1));return
            result['review'].append({'stage':side, 'card':aqt.mw.reviewer.card.id, **value})
            callback(value)
        except Exception:stop(traceback.format_exc())
    aqt.mw.web.evalWithCallback(SNAPSHOT,got)

def start_review():
    try:
        # Select only anonymous rich cards so actual scheduling flow exercises complex content.
        col=aqt.mw.col
        rich_nid=col.db.scalar('select id from notes where guid=?','mm-react-test-v1-rich')
        keep=col.db.list('select id from cards where nid=?',rich_nid)
        other=[cid for cid in col.find_cards('') if cid not in keep]
        col.sched.suspend_cards(other)
        result['revlogBefore']=col.db.scalar('select count(*) from revlog')
        result['reviewDeck']=col.get_card(keep[0]).did
        col.decks.select(result['reviewDeck'])
        aqt.mw.moveToState('review')
        QTimer.singleShot(400,lambda:poll_review('front',reveal_front))
    except Exception:stop(traceback.format_exc())

def direct_back():
    global preview
    try:
        col=aqt.mw.col
        nid=col.db.scalar('select id from notes where guid=?','mm-react-test-v1-rich')
        card=col.get_note(nid).cards()[0]
        col.set_config_bool(Config.Bool.PREVIEW_BOTH_SIDES,True)
        preview=Preview(card)
        preview.open();preview.resize(1000,850)
        def check(attempt=0):
            def got(value):
                try:
                    if not value or value['side']!='back':
                        if attempt>100:raise AssertionError(('direct back timeout',value))
                        QTimer.singleShot(60,lambda:check(attempt+1));return
                    assert all(value['state']['revealed'].values()),value
                    result['directBack']=value
                    preview.close();QTimer.singleShot(100,start_review)
                except Exception:stop(traceback.format_exc())
            preview._web.evalWithCallback(SNAPSHOT,got)
        QTimer.singleShot(250,check)
    except Exception:stop(traceback.format_exc())

def reveal_front(value):
    assert all(not v for v in value['state']['revealed'].values()),value
    aqt.mw.web.eval("AnkiMindmap.current().dispatch({type:'toggleAnswer',id:'a0'});")
    # The prototype deliberately does not assume a cross-client dynamic math API.
    QTimer.singleShot(400,lambda:poll_review('front',after_reveal))

def after_reveal(value):
    assert value['state']['revealed'].get('a0') is True,value
    assert value['images'] and all(x['loaded'] for x in value['images']),value
    result['dynamicTexTypeset']=value['activeTypeset']
    assert value['activeTypeset']==[1], 'Basic dynamic TeX did not typeset'
    aqt.mw.web.eval("for(let i=0;i<10;i++){AnkiMindmap.current().dispatch({type:'toggleAnswer',id:'a0'});AnkiMindmap.current().dispatch({type:'toggleAnswer',id:'a0'});}")
    QTimer.singleShot(200,lambda:poll_review('front',after_math_repeat))

def after_math_repeat(value):
    assert value['activeTypeset']==[1] and value['typeset']==2,value
    assert value['mathItems']==2,value
    result['repeatedDynamicMath']={'cycles':10,'activeTypeset':value['activeTypeset'],'mathItems':value['mathItems'],'math':value['math']}
    aqt.mw.web.grab().save(str(BUILD/'desktop-review-rich.png'))
    aqt.mw.reviewer._showAnswer()
    QTimer.singleShot(300,lambda:poll_review('back',grade))

def grade(value):
    assert all(value['state']['revealed'].values()),value
    result['nativeBackTexTypeset']=value['activeTypeset']
    result['gradedCard']=aqt.mw.reviewer.card.id
    aqt.mw.reviewer._answerCard(1)
    QTimer.singleShot(350,lambda:wait_grade(0))

def wait_grade(attempt):
    if finished:return
    try:
        count=aqt.mw.col.db.scalar('select count(*) from revlog')
        if count <= result['revlogBefore']:
            if attempt>100:raise AssertionError('native grading did not write isolated revlog')
            QTimer.singleShot(100,lambda:wait_grade(attempt+1));return
        result['revlogAfter']=count
        # Add a fresh anonymous note in the isolated profile to ensure a different-card transition.
        col=aqt.mw.col
        note=col.new_note(col.models.get(1792748414));note['Text']='<p>{{c1::独立下一张卡}}</p>';note.guid='mm-react-test-v1-qt-next'
        col.add_note(note,result['reviewDeck'])
        aqt.mw.reviewer.nextCard()
        QTimer.singleShot(250,lambda:poll_review('front',finish_review))
    except Exception:stop(traceback.format_exc())

def finish_review(value):
    assert all(not v for v in value['state']['revealed'].values()),value
    assert aqt.mw.reviewer.card.id != result['gradedCard'], 'expected a different native card'
    assert value['resources']['reactRoots']==1
    aqt.mw.web.grab().save(str(BUILD/'desktop-review-next.png'))
    # Remove the host from the actual reviewer and inspect captured old runtime after observer cleanup.
    js="""window.__stage01Old=AnkiMindmap.current();document.querySelector('#mm-react').remove();"""
    aqt.mw.web.eval(js)
    QTimer.singleShot(150,check_disposed)

def check_disposed():
    def got(value):
        try:
            assert not value['alive'] and all(not x for x in value['resources'].values()),value
            result['reviewHostRemoval']=value
            stop()
        except Exception:stop(traceback.format_exc())
    aqt.mw.web.evalWithCallback('window.__stage01Old.inspect()',got)

def start():
    global preview,interceptor
    try:
        col=aqt.mw.col
        interceptor=LocalOnly(aqt.mw)
        aqt.mw.web.page().profile().setUrlRequestInterceptor(interceptor)
        result['networkPolicy']='WebEngine HTTP(S) restricted to localhost; local Anki media server allowed'
        assert str(col.path).startswith(str(base)), 'Refuse non-isolated collection'
        col.import_anki_package(ImportAnkiPackageRequest(package_path=str(ROOT/'dist/anki-mindmap-react-test.apkg')))
        col.models._clear_cache()
        for cid in col.find_cards(''):checks.extend([(cid,'question'),(cid,'answer')])
        preview=Preview(col.get_card(checks[0][0]));preview.open();preview.resize(1000,850)
        QTimer.singleShot(700,advance_preview)
    except Exception:stop(traceback.format_exc())

gui_hooks.profile_did_open.append(lambda:QTimer.singleShot(400,start))
app=aqt._run(['stage01-isolated','-b',str(base),'-p','Stage01 isolated','-l','en_US','--safemode'],exec=False)
if app is None:raise RuntimeError('Isolated Desktop could not start')
QTimer.singleShot(180000,lambda:stop('Desktop timeout'))
code=app.exec()
result['qtEventLoopExitCode']=code
result['processTeardownCompleted']=True
if code!=0:result['status']='failed'
(BUILD/'desktop-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(1 if result['status']=='failed' else code)
