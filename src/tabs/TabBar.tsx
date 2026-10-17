import { useEffect, useRef, useState } from "react";
import type { WorkspaceTab } from "../core/types";
import { insertionIndexFromStripRects } from "../core/tabOrder";
import { TabStripScrollbar } from "./TabStripScrollbar";

type Props = {
  captureRef?: (element: HTMLElement | null) => void;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCreateTab: () => void;
  onRenameTab: (tabId: string, title: string) => void;
  onCloseTab: (tabId: string) => void;
  onReorderTab: (tabId: string, insertionIndex: number) => void;
  overflow: "scroll" | "wrap";
  compressTabs: boolean;
};

type TabDrag = {
  tabId: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  insertionIndex: number;
  captureElement: HTMLButtonElement;
};

export function TabBar({
  captureRef,
  tabs,
  activeTabId,
  onSelectTab,
  onCreateTab,
  onRenameTab,
  onCloseTab,
  onReorderTab,
  overflow,
  compressTabs,
}: Props) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<TabDrag | null>(null);
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (editingTabId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingTabId]);

  useEffect(() => {
    if (overflow !== "scroll" || !activeTabId) return;
    const strip = stripRef.current;
    const tab = strip
      ? [...strip.querySelectorAll<HTMLElement>("[data-tab-id]")].find(
          (element) => element.dataset.tabId === activeTabId,
        )
      : null;
    if (!strip || !tab) return;
    const stripRect = strip.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    if (tabRect.left < stripRect.left) strip.scrollLeft -= stripRect.left - tabRect.left;
    else if (tabRect.right > stripRect.right) strip.scrollLeft += tabRect.right - stripRect.right;
  }, [activeTabId, overflow, tabs]);

  useEffect(() => {
    if (!dragTabId) return;
    let frame = 0;
    const update = () => {
      const drag = dragRef.current;
      const strip = stripRef.current;
      if (!drag?.active || !strip) return;
      if (overflow === "scroll") {
        const rect = strip.getBoundingClientRect();
        const edge = Math.min(42, rect.width * 0.12);
        if (drag.x < rect.left + edge) strip.scrollLeft -= 9;
        else if (drag.x > rect.right - edge) strip.scrollLeft += 9;
      }
      const items = [...strip.querySelectorAll<HTMLElement>("[data-tab-id]")];
      const nextIndex = insertionIndexFromStripRects(
        items.map((item) => {
          const rect = item.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        }),
        drag.x,
        drag.y,
      );
      drag.insertionIndex = nextIndex;
      setInsertionIndex((current) => current === nextIndex ? current : nextIndex);
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [dragTabId, overflow]);

  useEffect(() => {
    if (!dragTabId) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishDrag(false);
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [dragTabId]);

  function finishDrag(commit: boolean) {
    const drag = dragRef.current;
    if (!drag) return;
    if (commit && drag.active) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      onReorderTab(drag.tabId, drag.insertionIndex);
    }
    try {
      drag.captureElement.releasePointerCapture(drag.pointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }
    dragRef.current = null;
    setDragTabId(null);
    setInsertionIndex(null);
  }

  function handleTabPointerDown(tabId: string, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || editingTabId) return;
    suppressClickRef.current = false;
    dragRef.current = {
      tabId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      insertionIndex: tabs.findIndex((tab) => tab.id === tabId),
      captureElement: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleTabPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 5) {
      drag.active = true;
      setDragTabId(drag.tabId);
    }
  }

  function beginRename(tab: WorkspaceTab) {
    setEditingTabId(tab.id);
    setDraftTitle(tab.title);
  }

  function commitRename(tab: WorkspaceTab) {
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== tab.title) {
      onRenameTab(tab.id, nextTitle);
    }
    setEditingTabId(null);
    setDraftTitle("");
  }

  function cancelRename() {
    setEditingTabId(null);
    setDraftTitle("");
  }

  return (
    <nav
      ref={captureRef}
      className="tab-bar"
      aria-label="Workspace tabs"
    >
      <div className={`tab-bar__strip-region tab-bar__strip-region--${overflow}`}>
        <div
          ref={stripRef}
          id="workspace-tab-strip"
          className={`tab-bar__tabs strip-overflow strip-overflow--${overflow}`}
          onWheel={(event) => {
            const strip = stripRef.current;
            if (!strip || overflow !== "scroll" || event.deltaX !== 0 || event.deltaY === 0) return;
            const canScroll = event.deltaY < 0 ? strip.scrollLeft > 0 : strip.scrollLeft + strip.clientWidth < strip.scrollWidth;
            if (canScroll) {
              event.preventDefault();
              strip.scrollLeft += event.deltaY;
            }
          }}
        >
          {tabs.map((tab, index) => (
            <div
              data-tab-id={tab.id}
              className={`tab-bar__tab ${compressTabs ? "tab-bar__tab--compressed" : ""} ${tab.id === activeTabId ? "tab-bar__tab--active" : ""} ${dragTabId === tab.id ? "tab-bar__tab--dragging" : ""} ${insertionIndex === index ? "tab-bar__tab--insert-before" : ""} ${insertionIndex === tabs.length && index === tabs.length - 1 ? "tab-bar__tab--insert-after" : ""}`}
              key={tab.id}
            >
              {editingTabId === tab.id ? (
                <input
                  ref={editInputRef}
                  className="tab-bar__rename-input"
                  value={draftTitle}
                  aria-label={`Rename ${tab.title}`}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => commitRename(tab)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename(tab);
                    if (event.key === "Escape") cancelRename();
                  }}
                />
              ) : (
                <button
                  type="button"
                  title="Double-click to rename"
                  onPointerDown={(event) => handleTabPointerDown(tab.id, event)}
                  onPointerMove={handleTabPointerMove}
                  onPointerUp={() => finishDrag(true)}
                  onPointerCancel={() => finishDrag(false)}
                  onClick={(event) => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      event.preventDefault();
                      return;
                    }
                    onSelectTab(tab.id);
                  }}
                  onDoubleClick={() => beginRename(tab)}
                >
                  {tab.title}
                </button>
              )}
              <button
                type="button"
                disabled={tabs.length <= 1}
                aria-label={`Close ${tab.title}`}
                onClick={() => onCloseTab(tab.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {overflow === "scroll" ? (
          <TabStripScrollbar
            scrollElementRef={stripRef}
            scrollElementId="workspace-tab-strip"
            overflow={overflow}
            refreshKey={`${compressTabs}:${JSON.stringify(tabs.map(({ id, title }) => [id, title]))}`}
          />
        ) : null}
      </div>

      <div className="tab-bar__actions">
        <button className="tab-bar__add" type="button" onClick={onCreateTab}>
          + New Tab
        </button>
      </div>
    </nav>
  );
}
