import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

type WorkspaceNumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
};

export type WorkspaceNumberParseResult =
  | { kind: "valid"; value: number }
  | { kind: "blank" }
  | { kind: "invalid" };

export function parseWorkspaceNumberDraft(
  draft: string,
): WorkspaceNumberParseResult {
  const trimmed = draft.trim();

  if (!trimmed) {
    return { kind: "blank" };
  }

  if (
    trimmed === "-" ||
    trimmed === "+" ||
    trimmed === "." ||
    trimmed === "-." ||
    trimmed === "+."
  ) {
    return { kind: "invalid" };
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed)
    ? { kind: "valid", value: parsed }
    : { kind: "invalid" };
}

export function clampWorkspaceNumberValue(
  value: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
) {
  return Math.max(min, Math.min(max, value));
}

export function stepWorkspaceNumberValue(
  value: number,
  direction: -1 | 1,
  {
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    step = 1,
  }: {
    min?: number;
    max?: number;
    step?: number;
  } = {},
) {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const precision = decimalPrecision(safeStep);
  const stepped = Number((value + direction * safeStep).toFixed(precision));

  return clampWorkspaceNumberValue(stepped, min, max);
}

export function WorkspaceNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  ariaLabel,
}: WorkspaceNumberInputProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(formatNumberDraft(value));

  useEffect(() => {
    setDraft(formatNumberDraft(value));
  }, [value]);

  const safeMin = min ?? Number.NEGATIVE_INFINITY;
  const safeMax = max ?? Number.POSITIVE_INFINITY;
  const committedValue = useMemo(
    () => clampWorkspaceNumberValue(value, safeMin, safeMax),
    [safeMax, safeMin, value],
  );

  function commitDraft(nextDraft = draft) {
    if (disabled) {
      return;
    }

    const parsed = parseWorkspaceNumberDraft(nextDraft);

    if (parsed.kind !== "valid") {
      setDraft(formatNumberDraft(value));
      return;
    }

    const nextValue = clampWorkspaceNumberValue(parsed.value, safeMin, safeMax);
    setDraft(formatNumberDraft(nextValue));

    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  function updateDraft(nextDraft: string) {
    setDraft(nextDraft);

    const parsed = parseWorkspaceNumberDraft(nextDraft);

    if (parsed.kind !== "valid") {
      return;
    }

    if (parsed.value < safeMin || parsed.value > safeMax) {
      return;
    }

    if (parsed.value !== value) {
      onChange(parsed.value);
    }
  }

  function stepValue(direction: -1 | 1) {
    if (disabled) {
      return;
    }

    const nextValue = stepWorkspaceNumberValue(committedValue, direction, {
      min: safeMin,
      max: safeMax,
      step,
    });

    setDraft(formatNumberDraft(nextValue));

    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      stepValue(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      stepValue(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Escape") {
      setDraft(formatNumberDraft(value));
    }
  }

  return (
    <div className="workspace-number-input">
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={ariaLabel}
        value={draft}
        onChange={(event) => updateDraft(event.target.value)}
        onBlur={() => commitDraft()}
        onKeyDown={handleKeyDown}
      />
      <div
        className="workspace-number-input__buttons"
        aria-hidden={disabled ? "true" : undefined}
      >
        <button
          type="button"
          aria-label={ariaLabel ? `Increase ${ariaLabel}` : "Increase value"}
          disabled={disabled || committedValue >= safeMax}
          onClick={() => stepValue(1)}
        >
          +
        </button>
        <button
          type="button"
          aria-label={ariaLabel ? `Decrease ${ariaLabel}` : "Decrease value"}
          disabled={disabled || committedValue <= safeMin}
          onClick={() => stepValue(-1)}
        >
          -
        </button>
      </div>
    </div>
  );
}

function formatNumberDraft(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}

function decimalPrecision(value: number) {
  const text = String(value);
  const decimal = text.split(".")[1];

  return decimal ? decimal.length : 0;
}
