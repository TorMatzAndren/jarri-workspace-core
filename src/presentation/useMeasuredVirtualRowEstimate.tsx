import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  readMeasuredVirtualRowSize,
  resolveMeasuredVirtualRowEstimate,
} from "./measuredVirtualRowEstimate";

const MEASUREMENT_PROBE_STYLE = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  visibility: "hidden",
  pointerEvents: "none",
} as const;

export type MeasuredVirtualRowEstimate<T> = {
  estimatedItemSize: number;
  measuredItemSize: number;
  probe: ReactNode;
};

export function useMeasuredVirtualRowEstimate<T>({
  item,
  fallbackSize,
  renderRow,
}: {
  item: T | undefined;
  fallbackSize: number;
  renderRow: (item: T, index: number) => ReactNode;
}): MeasuredVirtualRowEstimate<T> {
  const probeRef = useRef<HTMLDivElement | null>(null);
  const [measuredItemSize, setMeasuredItemSize] = useState(0);

  useLayoutEffect(() => {
    const probe = probeRef.current;

    if (!probe) {
      setMeasuredItemSize((current) => current === 0 ? current : 0);
      return undefined;
    }

    const measure = () => {
      const nextSize = readMeasuredVirtualRowSize(probe);
      setMeasuredItemSize((current) =>
        current === nextSize ? current : nextSize,
      );
    };

    measure();

    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(probe);

    return () => observer.disconnect();
  }, [item]);

  return {
    estimatedItemSize: resolveMeasuredVirtualRowEstimate(
      measuredItemSize,
      fallbackSize,
    ),
    measuredItemSize,
    probe: item === undefined ? null : (
      <div
        ref={probeRef}
        aria-hidden="true"
        style={MEASUREMENT_PROBE_STYLE}
      >
        {renderRow(item, 0)}
      </div>
    ),
  };
}
