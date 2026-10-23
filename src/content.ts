import {
  isExpanded,
  type ContentModel,
  type Match,
  type Side,
  type State,
} from "./core";

interface Branch {
  id: string;
  children: HTMLElement;
  bullet: HTMLElement;
}
interface Occurrence {
  id: string;
  element: HTMLElement;
  answer: Node[];
  hint: Node[];
  original: Node[];
  shown?: boolean;
}
interface GroupPart {
  id: string;
  element: HTMLElement;
  answer: boolean;
}
interface MathBridge {
  clear(element: HTMLElement): void;
  reveal(element: HTMLElement): void;
}
interface LocatedMatch extends Match {
  range: Range;
  element: HTMLElement;
}

/** Reads native Anki output; never parses Cloze source or changes note fields. */
export function readContent(root: HTMLElement, side: Side, math: MathBridge) {
  const original = root.innerHTML;
  const marker = document.createComment("mindmap-owned-content");
  root.prepend(marker);
  const diagnostics: string[] = [];
  const branches: Branch[] = [];
  root.querySelectorAll<HTMLElement>(".node").forEach((node, i) => {
    const children = [...node.children].filter((e) =>
      e.matches(".children"),
    ) as HTMLElement[];
    const bullet = [...node.children].find((e) => e.matches(".bullet")) as
      HTMLElement | undefined;
    if (!children.length) return;
    if (children.length !== 1 || !bullet) {
      diagnostics.push(`节点 ${i + 1} 结构不明确，保留原文并跳过折叠。`);
      return;
    }
    branches.push({ id: `n${i}`, children: children[0], bullet });
    bullet.removeAttribute("onclick");
    bullet.onclick = null;
    bullet.setAttribute("role", "button");
    bullet.tabIndex = 0;
    bullet.setAttribute("aria-label", "展开或折叠分支");
  });
  const ancestors = (element: Node) =>
    branches.filter((b) => b.children.contains(element)).map((b) => b.id);
  const occurrences: Occurrence[] = [];
  const active: ContentModel["active"][number][] = [];
  root.querySelectorAll<HTMLElement>(".cloze").forEach((element, i) => {
    if (element.parentElement?.closest(".cloze")) {
      diagnostics.push("嵌套原生答案保留在外层片段内。");
      return;
    }
    element.removeAttribute("onclick");
    element.onclick = null;
    const id = `a${i}`,
      originalNodes = [...element.childNodes];
    const payload = element.getAttribute("data-cloze");
    const fragment = document.createElement("template");
    if (payload !== null) fragment.innerHTML = payload;
    const answer =
      side === "back"
        ? originalNodes.map((n) => n.cloneNode(true))
        : payload === null
          ? originalNodes.map((n) => n.cloneNode(true))
          : [...fragment.content.childNodes];
    const hint =
      side === "front" ? originalNodes : [document.createTextNode("[…]")];
    occurrences.push({ id, element, original: originalNodes, answer, hint });
    active.push({
      id,
      ancestors: ancestors(element),
      canReveal: side === "back" || payload !== null,
    });
    if (side === "front" && payload === null)
      diagnostics.push(
        "当前客户端没有提供答案 payload，请使用 Anki 原生翻面。",
      );
  });
  const groupParts: GroupPart[] = [];
  root.querySelectorAll<HTMLElement>("cloze2,cloze2_w").forEach((element) => {
    if (element.closest(".cloze")) return;
    const id =
      [...element.classList].find((c) => /^cz-\d+$/.test(c)) ??
      element.dataset.clozeId;
    if (!id) {
      diagnostics.push("无法识别的自定义挖空保留可读，不猜测分组。");
      return;
    }
    const answer = element.localName === "cloze2";
    if (!answer && !element.textContent?.trim()) element.textContent = "~~";
    groupParts.push({ id, element, answer });
  });
  const model: ContentModel = {
    branches: branches.map((b) => b.id),
    active,
    groups: [...new Set(groupParts.map((p) => p.id))],
  };
  const annotations = new Map<string, string>();
  const hiddenAnnotationSources = new WeakSet<HTMLElement>();
  function prepareAnnotations() {
    root
      .querySelectorAll<HTMLAnchorElement>('a[href^="#_msocom_"]')
      .forEach((link) => {
        const id = link.getAttribute("href")!.slice(1);
        const candidates = [
          ...root.querySelectorAll<HTMLAnchorElement>("a[name],a[id]"),
        ].filter((a) => a.name === id || a.id === id);
        if (candidates.length !== 1) return;
        const anchor = candidates[0],
          paragraph = anchor.parentElement;
        if (
          !paragraph ||
          paragraph.tagName !== "P" ||
          paragraph.firstElementChild !== anchor ||
          paragraph.textContent?.trim() === ""
        )
          return;
        // Only a standalone source paragraph can be hidden; inline bookmarks remain untouched.
        if (
          [...paragraph.childNodes]
            .slice(0, [...paragraph.childNodes].indexOf(anchor))
            .some((n) => n.textContent?.trim())
        )
          return;
        annotations.set(id, paragraph.innerHTML);
        hiddenAnnotationSources.add(paragraph);
        paragraph.hidden = true;
      });
  }
  prepareAnnotations();
  let matches: LocatedMatch[] = [];
  let outline: HTMLElement | undefined;
  const highlightName = "anki-mindmap-search";
  type Highlights = Map<string, unknown>;
  const highlightApi = () =>
    (CSS as typeof CSS & { highlights?: Highlights }).highlights;
  const clearHighlights = () => {
    highlightApi()?.delete(highlightName);
    outline?.removeAttribute("data-mm-hit");
    outline = undefined;
  };
  function prepareLinks(area: HTMLElement) {
    const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT),
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
      const fragment = document.createDocumentFragment();
      while ((match = pattern.exec(source))) {
        fragment.append(source.slice(offset, match.index));
        const link = document.createElement("a");
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
  prepareLinks(root);
  return {
    model,
    diagnostics,
    isIntact: () => marker.parentNode === root,
    targetNode: (target: Element) =>
      branches.find((b) => b.bullet.contains(target))?.id,
    targetAnswer: (target: Element) =>
      occurrences.find((o) => o.element.contains(target))?.id,
    targetGroup: (target: Element) =>
      groupParts.find((p) => p.element === target.closest("cloze2,cloze2_w"))
        ?.id,
    firstActive: () => occurrences[0]?.element,
    activeElement: (id: string) =>
      occurrences.find((o) => o.id === id)?.element,
    annotation: (id: string) => annotations.get(id),
    project(state: State) {
      for (const b of branches) {
        b.children.hidden = !isExpanded(state, b.id);
        b.bullet.setAttribute("aria-expanded", String(isExpanded(state, b.id)));
      }
      for (const o of occurrences) {
        const shown = state.revealed[o.id];
        if (shown === o.shown) continue;
        const initial = o.shown === undefined;
        if (!initial) math.clear(o.element);
        const nodes = shown
          ? initial && side === "back"
            ? o.original
            : o.answer.map((n) => n.cloneNode(true))
          : o.hint;
        o.element.replaceChildren(...nodes);
        o.shown = shown;
        if (shown) {
          prepareLinks(o.element);
          prepareAnnotations();
          if (!initial) math.reveal(o.element);
        }
      }
      for (const p of groupParts)
        p.element.hidden = p.answer
          ? !state.groups[p.id]
          : !!state.groups[p.id];
    },
    search(query: string): readonly Match[] {
      clearHighlights();
      matches = [];
      if (!query.trim()) return [];
      const segments: { node: Text; start: number; end: number }[] = [];
      let text = "";
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode as Text,
          parent = node.parentElement;
        if (!parent || parent.closest("script,style,mjx-container,textarea"))
          continue;
        let excluded = false;
        for (
          let p: HTMLElement | null = parent;
          p && p !== root;
          p = p.parentElement
        ) {
          if (p.hidden && !branches.some((b) => b.children === p)) {
            excluded = true;
            break;
          }
          if (hiddenAnnotationSources.has(p)) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;
        // Block boundaries avoid concatenating unrelated paragraphs; inline fragments still match together.
        if (
          segments.length &&
          segments[segments.length - 1].node.parentElement?.closest(
            "p,li,td,th,div",
          ) !== parent.closest("p,li,td,th,div")
        )
          text += "\n";
        const start = text.length;
        text += node.data;
        segments.push({ node, start, end: text.length });
      }
      // Lowercasing can expand a character (for example İ). Ranges still use source UTF-16 offsets.
      let haystack = "",
        sourceOffset = 0;
      const starts: number[] = [],
        ends: number[] = [];
      for (const character of text) {
        const lower = character.toLowerCase();
        haystack += lower;
        for (let i = 0; i < lower.length; i++) {
          starts.push(sourceOffset);
          ends.push(sourceOffset + character.length);
        }
        sourceOffset += character.length;
      }
      const needle = Array.from(query.trim(), (character) =>
        character.toLowerCase(),
      ).join("");
      for (let offset = 0; matches.length < 1000;) {
        const found = haystack.indexOf(needle, offset);
        if (found < 0) break;
        const start = starts[found],
          end = ends[found + needle.length - 1];
        const a = segments.find((s) => s.start <= start && s.end > start),
          b = segments.find((s) => s.start < end && s.end >= end);
        if (a && b) {
          const range = document.createRange();
          range.setStart(a.node, start - a.start);
          range.setEnd(b.node, end - b.start);
          matches.push({
            id: `m${matches.length}`,
            ancestors: ancestors(a.node),
            range,
            element: a.node.parentElement!,
          });
        }
        offset = found + needle.length;
      }
      return matches.map(({ id, ancestors }) => ({ id, ancestors }));
    },
    highlight(selected: number) {
      clearHighlights();
      const match = matches[selected];
      if (!match) return;
      const Constructor = (
        window as Window & { Highlight?: new (...ranges: Range[]) => unknown }
      ).Highlight;
      if (Constructor && highlightApi())
        highlightApi()!.set(highlightName, new Constructor(match.range));
      else {
        outline = match.element;
        outline.dataset.mmHit = "true";
      }
    },
    matchElement: (index: number) => matches[index]?.element,
    restore() {
      clearHighlights();
      for (const o of occurrences) math.clear(o.element);
      if (marker.parentNode === root) root.innerHTML = original;
    },
  };
}
