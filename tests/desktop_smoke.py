"""Normal aqt previews in an independent temporary profile, without personal data."""
from pathlib import Path
import json
import os
import sys
import tempfile
import traceback
import uuid

ROOT = Path(__file__).resolve().parents[1]
os.environ['ANKI_SINGLE_INSTANCE_KEY'] = 'anki-mindmap-preview-' + uuid.uuid4().hex
os.environ['ANKI_SOFTWAREOPENGL'] = '1'
os.environ['QTWEBENGINE_CHROMIUM_FLAGS'] = '--disable-gpu'

import aqt
from aqt import gui_hooks
from aqt.browser.previewer import MultiCardPreviewer
from aqt.profiles import ProfileManager
from aqt.qt import QTimer
from aqt.theme import theme_manager, Theme
from anki.import_export_pb2 import ImportAnkiPackageRequest

base = Path(tempfile.mkdtemp(prefix='desktop-preview-', dir=ROOT / 'build'))
pm = ProfileManager(base)
pm.setupMeta()
pm.create('Template preview')
pm.load('Template preview')
pm.meta.update(firstRun=False, defaultLang='en_US', check_for_updates=False, check_for_addon_updates=False)
pm.profile['autoSync'] = False
pm.set_theme(Theme.LIGHT)
pm.save()
pm.db.close()

class TemplatePreview(MultiCardPreviewer):
    def __init__(self, card):
        self.selected_card, self.changed = card, True
        super().__init__(None, aqt.mw, lambda: None)
    def card(self): return self.selected_card
    def card_changed(self):
        changed, self.changed = self.changed, False
        return changed
    def select(self, card):
        self.selected_card, self.changed, self._last_state = card, True, None
        self.render_card()
    def type_ans_preview_filter(self, text, side):
        return super().type_ans_preview_filter(text, side) + f'<span hidden data-desktop-frame="{self.selected_card.id}:{side}"></span>'

preview = None
results, checks = [], []
step, finished, exit_error = 0, False, None

def stop(error=None):
    global finished, exit_error
    if finished: return
    finished, exit_error = True, error
    data = {'profile':str(base), 'status':'failed' if error else 'passed', 'checks':len(results), 'error':error, 'results':results}
    (ROOT / 'build/desktop-results.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print('FAIL ' + error if error else f'Desktop QtWebEngine: {len(results)} normal front/back previews passed', flush=True)
    if preview is not None: preview.close()
    aqt.mw.unloadProfileAndExit()

SNAPSHOT = r'''(() => {
  const root=document.querySelector('.linkRender');
  if(!root)return null;
  const mindmap=root.matches('.linkRender');
  const active=Array.from(root.querySelectorAll('span.cloze'));
  return {
    frame:document.querySelector('[data-desktop-frame]')?.dataset.desktopFrame,
    ready:mindmap?typeof custom2ButtonToggle==='function':root.dataset.ready==='true',
    type:mindmap?'mindmap':root.dataset.review,
    answerCount:document.querySelectorAll('#answer').length,
    overflow:document.documentElement.scrollWidth>innerWidth,
    hiddenActive:active.filter(el=>!el.getClientRects().length).length,
    bodyColor:getComputedStyle(document.body).color
  };
})()'''

def poll(cid, side, dark, attempt=0):
    if finished:return
    def got(value):
        try:
            expected=f'{cid}:{"question" if side=="front" else "answer"}'
            if not value or value.get('frame')!=expected or not value.get('ready'):
                if attempt>100:raise AssertionError(('preview timeout',cid,side,value))
                QTimer.singleShot(80,lambda:poll(cid,side,dark,attempt+1));return
            assert not value['overflow'],value
            if value['type']=='mindmap':assert not value['hiddenActive'],value
            results.append({'card':cid,'side':side,'dark':dark,**value})
            if len(results)<=6:
                folder=ROOT/'build/desktop-screenshots';folder.mkdir(exist_ok=True)
                preview._web.grab().save(str(folder/f'{len(results):03}-{side}.png'))
            QTimer.singleShot(30,advance)
        except Exception:stop(traceback.format_exc())
    preview._web.evalWithCallback(SNAPSHOT,got)

def advance():
    global step
    if finished:return
    if step>=len(checks):stop();return
    cid,side,dark=checks[step];step+=1
    try:
        if theme_manager.night_mode!=dark:
            aqt.mw.pm.set_theme(Theme.DARK if dark else Theme.LIGHT);theme_manager.apply_style()
        if side=='front':preview.select(aqt.mw.col.get_card(cid))
        else:preview._on_next()
        QTimer.singleShot(350,lambda:poll(cid,side,dark))
    except Exception:stop(traceback.format_exc())

def start():
    global preview
    try:
        sys.path.insert(0,str(ROOT/'scripts'))
        import build_package as package
        from preview_scenes import scenes
        mw=aqt.mw
        mw.col.import_anki_package(ImportAnkiPackageRequest(package_path=str(Path(os.environ.get('ANKI_TEST_PACKAGE',ROOT/'dist/anki-mindmap.apkg')))))
        mw.col.models._clear_cache()
        specs={s['key']:s for s in package.specifications()}
        for key,fields,tags in scenes():
            note=mw.col.new_note(mw.col.models.get(specs[key]['id']))
            for field,value in fields.items():note[field]=value
            note.tags=tags;mw.col.add_note(note,1)
        sys.path.insert(0,str(ROOT/'tests'))
        from test_mindmap import cases
        for key in ('math', 'nested'):
            note=mw.col.new_note(mw.col.models.get(1303378414))
            for field,value in cases()[key].items():note[field]=value
            mw.col.add_note(note,1)
        for dark in (False,True):
            for cid in mw.col.find_cards(''):checks.extend([(cid,'front',dark),(cid,'back',dark)])
        preview=TemplatePreview(mw.col.get_card(checks[0][0]));preview.open();preview.resize(960,880)
        QTimer.singleShot(900,advance)
    except Exception:stop(traceback.format_exc())

gui_hooks.profile_did_open.append(lambda:QTimer.singleShot(500,start))
app=aqt._run(['anki-mindmap-preview','-b',str(base),'-p','Template preview','-l','en_US','--safemode'],exec=False)
if app is None:raise RuntimeError('Isolated app did not start')
QTimer.singleShot(180000,lambda:stop('Desktop preview timeout'))
exit_code=app.exec()
sys.exit(1 if exit_error else exit_code)
