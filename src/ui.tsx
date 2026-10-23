import { useEffect, useRef, useSyncExternalStore } from "react";
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
  side,
  deck,
  diagram,
  annotation,
  dispatch,
  lifecycle,
}: {
  store: Store;
  model: ContentModel;
  side: Side;
  deck: string;
  diagram: string;
  annotation: (id: string) => string | undefined;
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
      <header className="mm-toolbar">
        <div className="mm-heading">
          <span className="mm-deck">{deck || "知识树"}</span>
          <span className="mm-side">{side === "front" ? "回忆" : "答案"}</span>
        </div>
        <nav aria-label="复习工具">
          <button title="K" onClick={() => dispatch({ type: "toggleTree" })}>
            {expanded ? "收起分支" : "展开分支"}
          </button>
          <button
            title="H"
            disabled={!model.active.length}
            onClick={() => dispatch({ type: "locate" })}
          >
            定位
          </button>
          <button
            title="]"
            disabled={
              !model.active.some((o) => o.canReveal && !state.revealed[o.id])
            }
            onClick={() => dispatch({ type: "revealNext" })}
          >
            揭示下一处
          </button>
          <button
            title="["
            disabled={
              !model.active.some((o) => o.canReveal && state.revealed[o.id])
            }
            onClick={() => dispatch({ type: "hideLast" })}
          >
            收回一处
          </button>
          <button
            title="L"
            disabled={!model.groups.length}
            onClick={() => dispatch({ type: "toggleOther" })}
          >
            {othersVisible ? "隐藏其他" : "揭示其他"}
          </button>
          <button
            onClick={() =>
              dispatch({
                type: state.searchOpen ? "closeSearch" : "openSearch",
              })
            }
          >
            搜索
          </button>
          {diagram.trim() && (
            <button
              title="J"
              onClick={() =>
                dispatch({ type: "overlay", value: { kind: "diagram" } })
              }
            >
              导图
            </button>
          )}
          <button
            title="C"
            aria-label="切换主题"
            onClick={() =>
              dispatch({
                type: "theme",
                value: state.theme === "paper" ? "bamboo" : "paper",
              })
            }
          >
            ◐
          </button>
        </nav>
        {state.searchOpen && (
          <div className="mm-search" role="search">
            <input
              ref={search}
              aria-label="搜索正文"
              placeholder="搜索正文；不检索未揭示答案"
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
            <output aria-live="polite">
              {state.matches.length ? state.selected + 1 : 0}/
              {state.matches.length}
            </output>
            <button
              aria-label="上一个命中"
              onClick={() => dispatch({ type: "searchMove", direction: -1 })}
            >
              ↑
            </button>
            <button
              aria-label="下一个命中"
              onClick={() => dispatch({ type: "searchMove", direction: 1 })}
            >
              ↓
            </button>
            <button onClick={() => dispatch({ type: "closeSearch" })}>
              结束搜索
            </button>
          </div>
        )}
      </header>
      {state.overlay && (
        <OverlayView
          overlay={state.overlay}
          diagram={diagram}
          annotation={annotation}
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
  close,
}: {
  overlay: NonNullable<Overlay>;
  diagram: string;
  annotation: (id: string) => string | undefined;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      className="mm-dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="mm-dialog-heading">
        <strong>
          {overlay.kind === "image"
            ? "图片"
            : overlay.kind === "diagram"
              ? "导图"
              : "批注"}
        </strong>
        <button aria-label="关闭弹窗" onClick={close}>
          关闭 ×
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
