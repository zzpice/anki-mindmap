function processCardContent() {
    var root = document.querySelector('.linkRender');
    if (!root) return;
    root.querySelectorAll('.tooltip[data-mindmap-annotation]').forEach(function (el) { el.remove(); });
    var currentTooltip = null;
    var links = Array.from(root.querySelectorAll('a[href^="#_msocom_"]'));
    var anchors = Array.from(root.querySelectorAll('a[name^="_msocom_"], a[id^="_msocom_"]'));
    anchors.forEach(function (anchor) {
        var id = anchor.getAttribute('name') || anchor.id;
        if (!/^_msocom_\d+$/.test(id) || anchor.hasAttribute('href') || anchor.childNodes.length) return;
        if (anchors.filter(function (a) { return (a.getAttribute('name') || a.id) === id; }).length !== 1) return;
        var references = links.filter(function (link) { return link.getAttribute('href') === '#' + id; });
        if (!references.length) return;
        var parent = anchor.parentElement;
        // Only a dedicated annotation paragraph/container is eligible; never hide preceding prose.
        if (!parent || parent === root || !parent.matches('p, div')) return;
        for (var previous = anchor.previousSibling; previous; previous = previous.previousSibling) {
            if (previous.nodeType !== Node.TEXT_NODE || previous.textContent.trim()) return;
        }
        if (references.some(function (link) { return parent.contains(link); })) return;
        var tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.dataset.mindmapAnnotation = id;
        for (var next = anchor.nextSibling; next; next = next.nextSibling) tooltip.appendChild(next.cloneNode(true));
        tooltip.querySelectorAll('a').forEach(function (link) {
            if (link.getAttribute('href') === '#_msoanchor_' + id.slice(8)) link.remove();
        });
        if (!tooltip.textContent.trim() && !tooltip.querySelector('img, math, audio, video')) return;
        root.appendChild(tooltip);
        setupTooltipImageHover(tooltip);
        parent.style.display = 'none';
        references.forEach(function (link) {
            link.onclick = function (event) {
                event.preventDefault();
                event.stopPropagation();
                var wasOpen = currentTooltip === tooltip && tooltip.style.display === 'block';
                if (currentTooltip) currentTooltip.style.display = 'none';
                currentTooltip = wasOpen ? null : tooltip;
                if (!currentTooltip) return;
                tooltip.style.display = 'block';
                var rect = link.getBoundingClientRect();
                tooltip.style.left = rect.left + 'px';
                tooltip.style.top = (rect.bottom + window.scrollY) + 'px';
                var overflow = tooltip.getBoundingClientRect().right - document.documentElement.clientWidth;
                if (overflow > 0) tooltip.style.left = Math.max(0, rect.left - overflow) + 'px';
            };
        });
    });
    if (window.ankiMindmapTooltipClick) {
        document.removeEventListener('click', window.ankiMindmapTooltipClick);
        document.removeEventListener('touchstart', window.ankiMindmapTooltipClick);
    }
    window.ankiMindmapTooltipClick = function (event) {
        if (!root.isConnected || !currentTooltip) return;
        var target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
        if (target && !currentTooltip.contains(target) && !target.closest('a[href^="#_msocom_"]')) {
            currentTooltip.style.display = 'none';
            currentTooltip = null;
        }
    };
    document.addEventListener('click', window.ankiMindmapTooltipClick);
    document.addEventListener('touchstart', window.ankiMindmapTooltipClick);
}
