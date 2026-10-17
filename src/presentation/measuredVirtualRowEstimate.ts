export function readMeasuredVirtualRowSize(
  probe: Pick<HTMLElement, "offsetHeight"> | null,
): number {
  if (!probe) {
    return 0;
  }

  const measuredSize = probe.offsetHeight;
  return Number.isFinite(measuredSize) && measuredSize > 0
    ? measuredSize
    : 0;
}

export function resolveMeasuredVirtualRowEstimate(
  measuredSize: number,
  fallbackSize: number,
): number {
  if (Number.isFinite(measuredSize) && measuredSize > 0) {
    return measuredSize;
  }

  if (Number.isFinite(fallbackSize) && fallbackSize > 0) {
    return fallbackSize;
  }

  return 1;
}
