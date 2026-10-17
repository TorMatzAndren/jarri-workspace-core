import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Key,
  type ReactNode,
} from "react";
import {
  createVirtualListGeometry,
  isNewVirtualListScrollRequest,
  selectVirtualListWindow,
  type VirtualListGeometry,
} from "./virtualList";

export type WorkspaceVirtualListDiagnostics = {
  materializedCount: number;
  renderedCount: number;
  measuredCount: number;
  startIndex: number;
  endIndexExclusive: number;
  scrollTop: number;
  viewportSize: number;
  totalSize: number;
};

export type WorkspaceVirtualListScrollAlignment =
  | "start"
  | "center"
  | "end"
  | "nearest";

export type WorkspaceVirtualListProps<T> = {
  items: readonly T[];
  getKey: (item: T, index: number) => Key;
  renderItem: (item: T, index: number) => ReactNode;
  estimatedItemSize: number;
  gap?: number;
  className?: string;
  contentClassName?: string;
  itemClassName?: string;
  initialScrollTop?: number;
  onScrollTopChange?: (scrollTop: number) => void;
  scrollToIndex?: number | null;
  scrollToRequestKey?: Key | null;
  onScrollRequestApplied?: (requestKey: Key) => void;
  scrollToAlignment?: WorkspaceVirtualListScrollAlignment;
  onDiagnostics?: (
    diagnostics: WorkspaceVirtualListDiagnostics,
  ) => void;
};

function keyIdentity(key: Key): string {
  return `${typeof key}:${String(key)}`;
}

export function WorkspaceVirtualList<T>({
  items,
  getKey,
  renderItem,
  estimatedItemSize,
  gap = 0,
  className,
  contentClassName,
  itemClassName,
  initialScrollTop = 0,
  onScrollTopChange,
  scrollToIndex = null,
  scrollToRequestKey = scrollToIndex,
  onScrollRequestApplied,
  scrollToAlignment = "nearest",
  onDiagnostics,
}: WorkspaceVirtualListProps<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measuredSizesRef = useRef(new Map<string, number>());
  const itemObserversRef = useRef(
    new Map<string, ResizeObserver>(),
  );

  const [viewportSize, setViewportSize] = useState(0);
  const [scrollTop, setScrollTop] = useState(
    Math.max(
      0,
      Number.isFinite(initialScrollTop)
        ? initialScrollTop
        : 0,
    ),
  );
  const initialScrollAppliedRef = useRef(false);
  const lastScrollRequestKeyRef = useRef<Key | null>(null);
  const [measurementRevision, setMeasurementRevision] =
    useState(0);

  const identities = useMemo(
    () =>
      items.map((item, index) =>
        keyIdentity(getKey(item, index)),
      ),
    [getKey, items],
  );

  useEffect(() => {
    const retained = new Set(identities);
    let changed = false;

    for (const identity of measuredSizesRef.current.keys()) {
      if (!retained.has(identity)) {
        measuredSizesRef.current.delete(identity);
        changed = true;
      }
    }

    for (const [identity, observer] of itemObserversRef.current) {
      if (!retained.has(identity)) {
        observer.disconnect();
        itemObserversRef.current.delete(identity);
      }
    }

    if (changed) {
      setMeasurementRevision((current) => current + 1);
    }
  }, [identities]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return undefined;
    }

    const measuredViewport = viewport;

    function measureViewport() {
      setViewportSize((current) => {
        const next = Math.max(
          0,
          Math.floor(measuredViewport.clientHeight),
        );

        return current === next ? current : next;
      });

      setScrollTop((current) => {
        const next = Math.max(
          0,
          measuredViewport.scrollTop,
        );
        return current === next ? current : next;
      });
    }

    measureViewport();

    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measureViewport);

      return () => {
        window.removeEventListener(
          "resize",
          measureViewport,
        );
      };
    }

    const observer = new ResizeObserver(measureViewport);
    observer.observe(measuredViewport);

    return () => observer.disconnect();
  }, []);

  const geometry: VirtualListGeometry = useMemo(
    () =>
      createVirtualListGeometry({
        itemSizes: identities.map(
          (identity) =>
            measuredSizesRef.current.get(identity) ?? null,
        ),
        estimatedItemSize,
        gap,
      }),
    [
      estimatedItemSize,
      gap,
      identities,
      measurementRevision,
    ],
  );

  const virtualWindow = useMemo(
    () =>
      selectVirtualListWindow(
        geometry,
        scrollTop,
        viewportSize,
      ),
    [geometry, scrollTop, viewportSize],
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (
      !viewport ||
      initialScrollAppliedRef.current ||
      geometry.itemCount === 0 ||
      geometry.totalSize <= 0
    ) {
      return;
    }

    const next = Math.max(
      0,
      Math.min(
        initialScrollTop,
        Math.max(
          0,
          geometry.totalSize -
            viewport.clientHeight,
        ),
      ),
    );

    viewport.scrollTop = next;
    setScrollTop(next);
    initialScrollAppliedRef.current = true;
  }, [
    geometry.totalSize,
    initialScrollTop,
  ]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (
      !viewport ||
      scrollToIndex == null ||
      scrollToRequestKey == null ||
      !isNewVirtualListScrollRequest(lastScrollRequestKeyRef.current, scrollToRequestKey) ||
      scrollToIndex < 0 ||
      scrollToIndex >= geometry.itemCount ||
      viewportSize <= 0
    ) {
      return;
    }

    const itemTop =
      geometry.itemOffsets[scrollToIndex];

    const itemSize =
      geometry.itemSizes[scrollToIndex];

    if (
      itemTop == null ||
      itemSize == null
    ) {
      return;
    }

    const itemBottom =
      itemTop + itemSize;

    const viewportTop =
      viewport.scrollTop;

    const viewportBottom =
      viewportTop + viewportSize;

    let target = viewportTop;

    switch (scrollToAlignment) {
      case "start":
        target = itemTop;
        break;

      case "center":
        target =
          itemTop -
          Math.max(
            0,
            (viewportSize - itemSize) / 2,
          );
        break;

      case "end":
        target =
          itemBottom - viewportSize;
        break;

      case "nearest":
        if (itemTop < viewportTop) {
          target = itemTop;
        } else if (
          itemBottom > viewportBottom
        ) {
          target =
            itemBottom - viewportSize;
        } else {
          return;
        }
        break;
    }

    const next = Math.max(
      0,
      Math.min(
        target,
        Math.max(
          0,
          geometry.totalSize -
            viewportSize,
        ),
      ),
    );

    viewport.scrollTop = next;
    setScrollTop(next);
    onScrollTopChange?.(next);
    lastScrollRequestKeyRef.current = scrollToRequestKey;
    onScrollRequestApplied?.(scrollToRequestKey);
  }, [
    geometry,
    onScrollTopChange,
    onScrollRequestApplied,
    scrollToAlignment,
    scrollToIndex,
    scrollToRequestKey,
    viewportSize,
  ]);

  const observeItem = useCallback(
    (
      identity: string,
      element: HTMLDivElement | null,
    ) => {
      const existing =
        itemObserversRef.current.get(identity);

      if (!element) {
        existing?.disconnect();
        itemObserversRef.current.delete(identity);
        return;
      }

      existing?.disconnect();

      const commitMeasurement = () => {
        /*
         * Virtual geometry lives in Workspace logical CSS pixels.
         *
         * getBoundingClientRect() reports post-transform visual
         * dimensions, so measuring it under Workspace canvas zoom
         * feeds scaled pixels back into unscaled translateY()
         * geometry and causes virtual rows to overlap.
         *
         * offsetHeight is the element's layout-space border-box
         * height and is therefore independent of ancestor scale().
         */
        const nextSize = Math.max(
          1,
          element.offsetHeight,
        );
        const previousSize =
          measuredSizesRef.current.get(identity);

        if (
          previousSize !== undefined &&
          Math.abs(previousSize - nextSize) < 0.5
        ) {
          return;
        }

        measuredSizesRef.current.set(
          identity,
          nextSize,
        );
        setMeasurementRevision(
          (current) => current + 1,
        );
      };

      commitMeasurement();

      if (typeof ResizeObserver !== "function") {
        return;
      }

      const observer =
        new ResizeObserver(commitMeasurement);

      observer.observe(element);
      itemObserversRef.current.set(
        identity,
        observer,
      );
    },
    [],
  );

  useEffect(
    () => () => {
      for (const observer of itemObserversRef.current.values()) {
        observer.disconnect();
      }

      itemObserversRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    onDiagnostics?.({
      materializedCount: items.length,
      renderedCount: virtualWindow.renderedCount,
      measuredCount: identities.reduce(
        (count, identity) =>
          count +
          (measuredSizesRef.current.has(identity) ? 1 : 0),
        0,
      ),
      startIndex: virtualWindow.startIndex,
      endIndexExclusive:
        virtualWindow.endIndexExclusive,
      scrollTop,
      viewportSize,
      totalSize: geometry.totalSize,
    });
  }, [
    geometry.totalSize,
    identities,
    items.length,
    onDiagnostics,
    scrollTop,
    viewportSize,
    virtualWindow.endIndexExclusive,
    virtualWindow.renderedCount,
    virtualWindow.startIndex,
  ]);

  const viewportClasses = [
    "workspace-virtual-list",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const contentClasses = [
    "workspace-virtual-list__content",
    contentClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const virtualItemClasses = [
    "workspace-virtual-list__item",
    itemClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const contentStyle: CSSProperties = {
    height: geometry.totalSize,
  };

  return (
    <div
      ref={viewportRef}
      className={viewportClasses}
      data-workspace-local-wheel-surface="native"
      onScroll={(event) => {
        const next = Math.max(
          0,
          event.currentTarget.scrollTop,
        );

        setScrollTop((current) =>
          current === next ? current : next,
        );

        onScrollTopChange?.(next);
      }}
    >
      <div
        className={contentClasses}
        style={contentStyle}
      >
        {virtualWindow.items.map(({ index, top }) => {
          const item = items[index];
          const identity = identities[index];

          if (
            item === undefined ||
            identity === undefined
          ) {
            return null;
          }

          return (
            <div
              key={getKey(item, index)}
              ref={(element) =>
                observeItem(identity, element)
              }
              className={virtualItemClasses}
              data-workspace-virtual-index={index}
              style={{
                transform: `translateY(${top}px)`,
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
