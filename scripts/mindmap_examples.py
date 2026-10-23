"""Anonymous source-shaped example HTML; Anki itself generates all Cloze cards."""
from html import escape


def blank(ordinal, answer, identifier):
    token = escape(str(identifier), quote=True)
    payload = (f'<cloze2_w class="cz-{ordinal}" data-cloze-id="{token}"></cloze2_w>'
               f'<cloze2 class="cz-{ordinal} czi-{token}">{answer}</cloze2>')
    return '{{c' + str(ordinal) + '::' + payload + '}}'


def node(content, children='', note=''):
    tail = '<div class="children"><ul class="node-list">' + children + '</ul></div>' if children else ''
    return ('<li class="node"><div class="bullet"><div class="bullet-dot"></div></div>'
            '<div class="content mm-editor">' + content + '</div>' + tail +
            ('<div class="note mm-editor">' + note + '</div>' if note else '') + '</li>')


def tree(title, nodes):
    return '<div class="title">' + escape(title) + '</div><ul class="node-list">' + nodes + '</ul>'


def fields(title, nodes, notes='', diagram=''):
    return {'填写笔记': notes, '导图': diagram, 'Text': tree(title, nodes)}
