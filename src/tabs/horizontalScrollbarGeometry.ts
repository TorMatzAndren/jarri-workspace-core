export type HorizontalScrollMetrics = {
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
};

export type HorizontalScrollbarGeometry = {
  visible: boolean;
  thumbWidth: number;
  thumbLeft: number;
  maxScrollLeft: number;
};

export function shouldShowTabStripScrollbar(
  overflow: "scroll" | "wrap",
  geometry: HorizontalScrollbarGeometry,
) {
  return overflow === "scroll" && geometry.visible;
}

export function horizontalScrollbarGeometry(
  metrics: HorizontalScrollMetrics,
  trackWidth: number,
  minimumThumbPercent = 8,
): HorizontalScrollbarGeometry {
  const clientWidth = Number.isFinite(metrics.clientWidth)
    ? Math.max(0, metrics.clientWidth)
    : 0;
  const scrollWidth = Number.isFinite(metrics.scrollWidth)
    ? Math.max(0, metrics.scrollWidth)
    : 0;
  const safeTrackWidth = Number.isFinite(trackWidth) ? Math.max(0, trackWidth) : 0;
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);

  if (clientWidth <= 0 || scrollWidth <= clientWidth || safeTrackWidth <= 0) {
    return {
      visible: false,
      thumbWidth: safeTrackWidth,
      thumbLeft: 0,
      maxScrollLeft,
    };
  }

  const minimumPercent = Number.isFinite(minimumThumbPercent)
    ? Math.min(100, Math.max(0, minimumThumbPercent))
    : 8;
  const proportionalWidth = (clientWidth / scrollWidth) * safeTrackWidth;
  const thumbWidth = Math.min(
    safeTrackWidth,
    Math.max((minimumPercent / 100) * safeTrackWidth, proportionalWidth),
  );
  const scrollLeft = Number.isFinite(metrics.scrollLeft)
    ? Math.min(maxScrollLeft, Math.max(0, metrics.scrollLeft))
    : 0;
  const thumbLeft =
    (scrollLeft / maxScrollLeft) * (safeTrackWidth - thumbWidth);

  return {
    visible: true,
    thumbWidth,
    thumbLeft: Math.min(safeTrackWidth - thumbWidth, Math.max(0, thumbLeft)),
    maxScrollLeft,
  };
}
