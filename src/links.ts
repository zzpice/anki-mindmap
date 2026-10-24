/** Linkify only the supplied rich-content region; never mutate its sibling UI. */
export function prepareNoteLinks(area: HTMLElement) {
    const walker = area.ownerDocument.createTreeWalker(area, NodeFilter.SHOW_TEXT),
      nodes: Text[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      if (!text.parentElement?.closest("a,script,style,mjx-container"))
        nodes.push(text);
    }
    for (const text of nodes) {
      const source = text.data,
        pattern = /\[([^\[\]]+)\|nid(\d{13})\]/g;
      let match: RegExpExecArray | null,
        offset = 0;
      const fragment = area.ownerDocument.createDocumentFragment();
      while ((match = pattern.exec(source))) {
        fragment.append(source.slice(offset, match.index));
        const link = area.ownerDocument.createElement("a");
        link.textContent = match[1];
        link.href = "#";
        link.dataset.mmNote = match[2];
        link.className = "mm-note-link";
        fragment.append(link);
        offset = pattern.lastIndex;
      }
      if (offset) {
        fragment.append(source.slice(offset));
        text.replaceWith(fragment);
      }
    }
  }
