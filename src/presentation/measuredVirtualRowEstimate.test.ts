import {
  readMeasuredVirtualRowSize,
  resolveMeasuredVirtualRowEstimate,
} from "./measuredVirtualRowEstimate";
import { createVirtualListGeometry } from "../core/presentation/virtualList";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

assertEqual(
  resolveMeasuredVirtualRowEstimate(0, 72),
  72,
  "fallback remains available before the probe measures",
);

assertEqual(
  resolveMeasuredVirtualRowEstimate(91, 72),
  91,
  "measured row pitch replaces the fallback",
);

assertEqual(
  resolveMeasuredVirtualRowEstimate(91, 72),
  resolveMeasuredVirtualRowEstimate(91, 72),
  "unchanged measurements resolve without a different estimate",
);

assertEqual(
  resolveMeasuredVirtualRowEstimate(124, 72),
  124,
  "a changed representative measurement updates the estimate",
);

const updatedVirtualGeometry = createVirtualListGeometry({
  itemSizes: [null, null],
  estimatedItemSize: resolveMeasuredVirtualRowEstimate(124, 72),
  gap: 0,
});

assertEqual(
  updatedVirtualGeometry.totalSize,
  248,
  "the virtualizer receives the updated representative pitch",
);

assertEqual(
  readMeasuredVirtualRowSize({ offsetHeight: 0 }),
  0,
  "zero-sized probes remain pending",
);

assertEqual(
  readMeasuredVirtualRowSize({ offsetHeight: 58 }),
  58,
  "the virtualizer receives the rendered pixel height",
);

assertEqual(
  resolveMeasuredVirtualRowEstimate(Number.NaN, 0),
  1,
  "invalid inputs still produce a safe virtualizer estimate",
);
