// Resolve only local client links. Unsupported clients retain the readable title.
function renderMindmapLinks(root) {
    if (!root || window.AnkiNoteLinkerIsActive) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
        if (!walker.currentNode.parentElement.closest('a, script, style, .cloze-placeholder')) nodes.push(walker.currentNode);
    }
    nodes.forEach(function (text) {
        var pattern = /\[((?:[^\[]|\\\[)*)\|nid(\d{13})\]/g;
        var source = text.nodeValue;
        var fragment = document.createDocumentFragment();
        var offset = 0;
        var match;
        while ((match = pattern.exec(source))) {
            fragment.appendChild(document.createTextNode(source.slice(offset, match.index)));
            var title = match[1].replace(/\\\[/g, '[');
            var nid = match[2];
            var link = document.createElement('a');
            link.className = 'noteLink';
            link.textContent = title;
            if (document.documentElement.classList.contains('iphone') || document.documentElement.classList.contains('ipad')) {
                link.href = 'anki://x-callback-url/search?query=nid%3a' + nid;
            } else {
                try {
                    window.jsAPI = window.jsAPI || new AnkiDroidJS({version: '0.0.3', developer: 'github.com/gugutu'});
                    link.href = '#';
                    link.dataset.mindmapNote = nid;
                } catch (e) { link = document.createTextNode(title); }
            }
            fragment.appendChild(link);
            offset = pattern.lastIndex;
        }
        if (!offset) return;
        fragment.appendChild(document.createTextNode(source.slice(offset)));
        text.replaceWith(fragment);
    });
}
renderMindmapLinks(document.querySelector('.linkRender'));
(function () {
    if (window.ankiMindmapNoteClick) document.removeEventListener('click', window.ankiMindmapNoteClick, true);
    var root = document.querySelector('.linkRender');
    window.ankiMindmapNoteClick = function (event) {
        if (!root || !root.isConnected || !root.contains(event.target)) return;
        var link = event.target.closest && event.target.closest('a[data-mindmap-note]');
        if (!link || !/^\d{13}$/.test(link.dataset.mindmapNote)) return;
        event.preventDefault();
        event.stopPropagation();
        window.jsAPI.ankiSearchCard('nid:' + link.dataset.mindmapNote);
    };
    document.addEventListener('click', window.ankiMindmapNoteClick, true);
})();
