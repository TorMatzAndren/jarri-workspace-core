import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  horizontalScrollbarGeometry,
  shouldShowTabStripScrollbar,
  type HorizontalScrollMetrics,
} from "./horizontalScrollbarGeometry";

type Props = {
  scrollElementRef: RefObject<HTMLDivElement | null>;
  scrollElementId: string;
  refreshKey: string;
  overflow: "scroll" | "wrap";
};

type ScrollbarState = HorizontalScrollMetrics & { trackWidth: number };
type ThumbDrag = { pointerId: number; startX: number; startScrollLeft: number; maxThumbOffset: number; maxScrollLeft: number };

function sameState(left: ScrollbarState | null, right: ScrollbarState) {
  return left?.clientWidth === right.clientWidth &&
    left.scrollWidth === right.scrollWidth &&
    left.scrollLeft === right.scrollLeft &&
    left.trackWidth === right.trackWidth;
}

export function TabStripScrollbar({ scrollElementRef, scrollElementId, refreshKey, overflow }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<ThumbDrag | null>(null);
  const [state, setState] = useState<ScrollbarState | null>(null);

  useEffect(() => {
    const scroller = scrollElementRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return undefined;

    const update = () => {
      const next = {
        clientWidth: scroller.clientWidth,
        scrollWidth: scroller.scrollWidth,
        scrollLeft: scroller.scrollLeft,
        trackWidth: track.getBoundingClientRect().width,
      };
      setState((current) => sameState(current, next) ? current : next);
    };
    const observeTabSizes = (observer: ResizeObserver) => {
      observer.disconnect();
      observer.observe(scroller);
      observer.observe(track);
      scroller.querySelectorAll<HTMLElement>("[data-tab-id]").forEach((tab) => observer.observe(tab));
    };

    scroller.addEventListener("scroll", update, { passive: true });
    update();

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(update)
      : null;
    if (resizeObserver) observeTabSizes(resizeObserver);
    else window.addEventListener("resize", update);

    const mutationObserver = typeof MutationObserver === "function"
      ? new MutationObserver(() => {
          if (resizeObserver) observeTabSizes(resizeObserver);
          update();
        })
      : null;
    mutationObserver?.observe(scroller, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [refreshKey, scrollElementRef]);

  const geometry = state
    ? horizontalScrollbarGeometry(state, state.trackWidth)
    : null;
  const visible = geometry ? shouldShowTabStripScrollbar(overflow, geometry) : false;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!visible || event.button !== 0) return;
    const scroller = scrollElementRef.current;
    const track = trackRef.current;
    if (!scroller || !track || !geometry) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    const trackRect = track.getBoundingClientRect();
    const thumb = track.querySelector<HTMLElement>(".tab-strip-scrollbar__thumb");
    if (thumb?.contains(event.target as Node)) {
      const thumbRect = thumb.getBoundingClientRect();
      const maxThumbOffset = Math.max(0, trackRect.width - thumbRect.width);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: scroller.scrollLeft,
        maxThumbOffset,
        maxScrollLeft: geometry.maxScrollLeft,
      };
      track.setPointerCapture(event.pointerId);
      return;
    }

    const maxThumbOffset = Math.max(0, trackRect.width - geometry.thumbWidth);
    if (maxThumbOffset > 0) {
      const thumbLeft = Math.min(
        maxThumbOffset,
        Math.max(0, event.clientX - trackRect.left - geometry.thumbWidth / 2),
      );
      scroller.scrollLeft = (thumbLeft / maxThumbOffset) * geometry.maxScrollLeft;
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const scroller = scrollElementRef.current;
    if (!drag || !scroller || drag.pointerId !== event.pointerId) return;
    const thumbDelta = event.clientX - drag.startX;
    scroller.scrollLeft = drag.startScrollLeft +
      (drag.maxThumbOffset > 0
        ? (thumbDelta / drag.maxThumbOffset) * drag.maxScrollLeft
        : 0);
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const scroller = scrollElementRef.current;
    if (!scroller || !geometry) return;
    const step = Math.max(40, scroller.clientWidth * 0.1);
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = scroller.scrollLeft - step;
    if (event.key === "ArrowRight") next = scroller.scrollLeft + step;
    if (event.key === "PageUp") next = scroller.scrollLeft - scroller.clientWidth;
    if (event.key === "PageDown") next = scroller.scrollLeft + scroller.clientWidth;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = geometry.maxScrollLeft;
    if (next === null) return;
    event.preventDefault();
    scroller.scrollLeft = Math.min(geometry.maxScrollLeft, Math.max(0, next));
  }

  return (
    <div
      ref={trackRef}
      className={`tab-strip-scrollbar ${visible ? "" : "tab-strip-scrollbar--hidden"}`}
      role={visible ? "scrollbar" : undefined}
      aria-label={visible ? "Workspace tabs scroll position" : undefined}
      aria-controls={visible ? scrollElementId : undefined}
      aria-orientation={visible ? "horizontal" : undefined}
      aria-valuemin={visible ? 0 : undefined}
      aria-valuemax={visible ? Math.ceil(geometry?.maxScrollLeft ?? 0) : undefined}
      aria-valuenow={visible ? Math.round(state?.scrollLeft ?? 0) : undefined}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onLostPointerCapture={() => { dragRef.current = null; }}
      onKeyDown={handleKeyDown}
    >
      {visible && geometry ? (
        <span
          className="tab-strip-scrollbar__thumb"
          style={{ left: `${geometry.thumbLeft}px`, width: `${geometry.thumbWidth}px` }}
        />
      ) : null}
    </div>
  );
}
