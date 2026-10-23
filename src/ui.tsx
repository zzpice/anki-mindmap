import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  isExpanded,
  type Command,
  type ContentModel,
  type Overlay,
  type Side,
  type Store,
} from "./core";

export function Interface({
  store,
  model,
  deck,
  diagram,
  annotation,
  annotationAnchor,
  dispatch,
  lifecycle,
}: {
  store: Store;
  model: ContentModel;
  side: Side;
  deck: string;
  diagram: string;
  annotation: (id: string) => string | undefined;
  annotationAnchor: (id: string) => DOMRect | undefined;
  dispatch: (command: Command) => void;
  lifecycle: (delta: number) => void;
}) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    lifecycle(1);
    return () => lifecycle(-1);
  }, [lifecycle]);
  useEffect(() => {
    if (state.searchOpen) search.current?.focus();
  }, [state.searchOpen]);
  const expanded = model.branches.every((id) => isExpanded(state, id));
  const othersVisible =
    model.groups.length > 0 && model.groups.every((id) => state.groups[id]);
  return (
    <>
      <button
        className="floating"
        aria-label="搜索"
        title="搜索内容"
        onClick={() =>
          dispatch({ type: state.searchOpen ? "closeSearch" : "openSearch" })
        }
      >
        {deck || "知识树"}
      </button>
      <nav aria-label="复习工具">
        <button
          className="floating-button"
          aria-label="定位"
          title="定位 · H"
          disabled={!model.active.length}
          onClick={() => dispatch({ type: "locate" })}
        >
          定位
        </button>
        {diagram.trim() && (
          <button
            id="left-floating-widget"
            aria-label="导图"
            title="导图 · J"
            onClick={() =>
              dispatch({
                type: "overlay",
                value:
                  state.overlay?.kind === "diagram"
                    ? null
                    : { kind: "diagram" },
              })
            }
          />
        )}
        <button
          className="custom2-button"
          aria-label={expanded ? "收起分支" : "展开分支"}
          title="伸/缩 · K"
          onClick={() => dispatch({ type: "toggleTree" })}
        >
          伸/缩
        </button>
        <button
          className="custom-button"
          aria-label={othersVisible ? "隐藏其他" : "揭示其他"}
          title="显/隐 · L"
          disabled={!model.groups.length}
          onClick={() => dispatch({ type: "toggleOther" })}
        >
          显/隐
        </button>
      </nav>
      <div className="search-box" role="search" hidden={!state.searchOpen}>
        <div className="sb-row">
          <input
            type="text"
            ref={search}
            aria-label="搜索正文"
            placeholder="搜索内容…"
            value={state.query}
            onChange={(e) =>
              dispatch({ type: "search", query: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                dispatch({
                  type: "searchMove",
                  direction: e.shiftKey ? -1 : 1,
                });
              }
            }}
          />
          <button
            id="searchButton"
            aria-label="执行搜索"
            onClick={() => dispatch({ type: "search", query: state.query })}
          >
            搜索
          </button>
          <button
            id="prevMark"
            aria-label="上一个命中"
            onClick={() => dispatch({ type: "searchMove", direction: -1 })}
          >
            ↑
          </button>
          <output className="search-results" aria-live="polite">
            {state.matches.length ? state.selected + 1 : 0}/
            {state.matches.length}
          </output>
          <button
            id="nextMark"
            aria-label="下一个命中"
            onClick={() => dispatch({ type: "searchMove", direction: 1 })}
          >
            ↓
          </button>
        </div>
        <div className="sb-row">
          <button
            className="mm-step"
            aria-label="揭示下一处"
            title="]"
            disabled={
              !model.active.some((o) => o.canReveal && !state.revealed[o.id])
            }
            onClick={() => dispatch({ type: "revealNext" })}
          >
            揭示
          </button>
          <button
            className="mm-step"
            aria-label="收回一处"
            title="["
            disabled={
              !model.active.some((o) => o.canReveal && state.revealed[o.id])
            }
            onClick={() => dispatch({ type: "hideLast" })}
          >
            收回
          </button>
          <span className="sb-spacer" />
          <button
            id="themeToggle"
            aria-label="切换主题"
            title="C"
            onClick={() =>
              dispatch({
                type: "theme",
                value: state.theme === "paper" ? "bamboo" : "paper",
              })
            }
          >
            {state.theme === "paper" ? "象牙笺" : "竹露"}
          </button>
          <button
            id="clearMarks"
            aria-label="清除搜索"
            onClick={() => dispatch({ type: "search", query: "" })}
          >
            ❌
          </button>
          <button
            id="hideSearchBox"
            aria-label="结束搜索"
            onClick={() => dispatch({ type: "closeSearch" })}
          >
            ➖
          </button>
        </div>
      </div>
      {state.overlay && (
        <OverlayView
          key={
            state.overlay.kind === "annotation"
              ? state.overlay.id
              : state.overlay.kind
          }
          overlay={state.overlay}
          diagram={diagram}
          annotation={annotation}
          annotationAnchor={annotationAnchor}
          close={() => dispatch({ type: "overlay", value: null })}
        />
      )}
    </>
  );
}
function OverlayView({
  overlay,
  diagram,
  annotation,
  annotationAnchor,
  close,
}: {
  overlay: NonNullable<Overlay>;
  diagram: string;
  annotation: (id: string) => string | undefined;
  annotationAnchor: (id: string) => DOMRect | undefined;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement as HTMLElement | null;
    if (!dialog.open) {
      if (overlay.kind === "image") dialog.showModal();
      else dialog.show();
    }
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useLayoutEffect(() => {
    if (overlay.kind !== "annotation") return;
    const anchor = annotationAnchor(overlay.id),
      dialog = ref.current!;
    if (!anchor) return;
    // Geometry is presentation only. core.ts remains the authority for the
    // open annotation; the native-content module only supplies its anchor.
    dialog.style.top = `${anchor.bottom + window.scrollY}px`;
    dialog.style.left = `${Math.max(0, Math.min(anchor.left, document.documentElement.clientWidth - dialog.getBoundingClientRect().width))}px`;
  }, [overlay, annotationAnchor]);
  return (
    <dialog
      className={`mm-dialog mm-dialog-${overlay.kind}`}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (overlay.kind === "image" && e.target === e.currentTarget) close();
      }}
    >
      <div className="mm-dialog-heading">
        <button aria-label="关闭弹窗" title="关闭" onClick={close}>
          ×
        </button>
      </div>
      {overlay.kind === "image" ? (
        <img className="mm-full-image" src={overlay.src} alt={overlay.alt} />
      ) : (
        <div
          className="mm-rich-overlay"
          dangerouslySetInnerHTML={{
            __html:
              overlay.kind === "diagram"
                ? diagram
                : (annotation(overlay.id) ?? "批注来源暂不可用，原文仍保留。"),
          }}
        />
      )}
    </dialog>
  );
}
