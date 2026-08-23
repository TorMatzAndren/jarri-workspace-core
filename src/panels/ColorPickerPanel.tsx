import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  isWorkspaceColorTokenKey,
  workspaceColorField,
  type WorkspaceColorTokenKey,
} from "../core/colorTokens";
import type { PanelBodyProps } from "../core/types";

export type ColorPickerPanelState = {
  colorToken: WorkspaceColorTokenKey;
};

type Hsv = {
  h: number;
  s: number;
  v: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string) {
  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`;
  }

  return null;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex);

  if (!normalized) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const part = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");

  return `#${part(r)}${part(g)}${part(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;

  if (delta !== 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }

  if (h < 0) {
    h += 360;
  }

  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function hsvToRgb({ h, s, v }: Hsv) {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hue < 60) {
    rp = c;
    gp = x;
  } else if (hue < 120) {
    rp = x;
    gp = c;
  } else if (hue < 180) {
    gp = c;
    bp = x;
  } else if (hue < 240) {
    gp = x;
    bp = c;
  } else if (hue < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
}

function hsvToHex(hsv: Hsv) {
  const rgb = hsvToRgb(hsv);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(rgb.r, rgb.g, rgb.b) : null;
}

export function normalizeColorPickerState(
  input: unknown,
): ColorPickerPanelState {
  if (
    input &&
    typeof input === "object" &&
    "colorToken" in input &&
    isWorkspaceColorTokenKey(
      (input as { colorToken?: unknown }).colorToken,
    )
  ) {
    return {
      colorToken: (input as { colorToken: WorkspaceColorTokenKey }).colorToken,
    };
  }

  return { colorToken: "page" };
}

export function ColorPickerPanel({
  panel,
  preferences,
  updatePreferences,
}: PanelBodyProps) {
  const state = normalizeColorPickerState(panel.panelState);
  const field = workspaceColorField(state.colorToken);

  const shellProbeRef = useRef<HTMLDivElement | null>(null);
  const svRef = useRef<HTMLDivElement | null>(null);

  const override = preferences.colorOverrides[state.colorToken];

  const [effectiveColor, setEffectiveColor] = useState("");
  const [hexValue, setHexValue] = useState(override ?? "");
  const [hsv, setHsv] = useState<Hsv>({
    h: 330,
    s: 0.55,
    v: 0.75,
  });

  useEffect(() => {
    const shell = shellProbeRef.current?.closest(".workspace-shell");

    if (!(shell instanceof HTMLElement)) {
      return;
    }

    const computed = getComputedStyle(shell)
      .getPropertyValue(field.cssVariable)
      .trim();

    setEffectiveColor(computed);

    const candidate = override ?? computed;
    const normalized = candidate ? normalizeHex(candidate) : null;
    const nextHsv = normalized ? hexToHsv(normalized) : null;

    if (nextHsv) {
      setHsv(nextHsv);
      setHexValue(override ?? normalized ?? "");
    }
  }, [
    field.cssVariable,
    override,
    preferences.themeMode,
    preferences.themePreset,
    preferences.colorOverrides,
    state.colorToken,
  ]);

  const selectedHex = useMemo(() => hsvToHex(hsv), [hsv]);
  const hueHex = useMemo(
    () => hsvToHex({ h: hsv.h, s: 1, v: 1 }),
    [hsv.h],
  );

  function setColor(color: string) {
    const normalized = normalizeHex(color);

    if (!normalized) {
      return;
    }

    updatePreferences({
      colorOverrides: {
        ...preferences.colorOverrides,
        [state.colorToken]: normalized,
      },
    });

    setHexValue(normalized);

    const nextHsv = hexToHsv(normalized);
    if (nextHsv) {
      setHsv(nextHsv);
    }
  }

  function applyHex() {
    const normalized = normalizeHex(hexValue);

    if (normalized) {
      setColor(normalized);
    }
  }

  function clearOverride() {
    const next = { ...preferences.colorOverrides };
    delete next[state.colorToken];

    updatePreferences({ colorOverrides: next });
    setHexValue("");

    const normalized = normalizeHex(effectiveColor);
    const nextHsv = normalized ? hexToHsv(normalized) : null;

    if (nextHsv) {
      setHsv(nextHsv);
    }
  }

  function updateSvFromPointer(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const element = svRef.current;

    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);

    const next = {
      ...hsv,
      s: x,
      v: 1 - y,
    };

    setHsv(next);
    setColor(hsvToHex(next));
  }

  return (
    <div className="panel-body color-picker-panel">
      <div className="color-picker-panel__heading">
        <div>
          <strong>{field.label}</strong>
          <span>{override ? "Custom override" : "Theme default"}</span>
        </div>

        <div
          ref={shellProbeRef}
          className="color-picker-panel__preview"
          style={{ background: selectedHex }}
          aria-label={`${field.label} color preview`}
        />
      </div>

      <div
        ref={svRef}
        className="color-picker-panel__sv"
        style={{ "--picker-hue": hueHex } as React.CSSProperties}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateSvFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            updateSvFromPointer(event);
          }
        }}
      >
        <span
          className="color-picker-panel__sv-marker"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
          }}
        />
      </div>

      <label className="color-picker-panel__hue">
        <span>Hue</span>
        <input
          min="0"
          max="360"
          step="1"
          type="range"
          value={Math.round(hsv.h)}
          onChange={(event) => {
            const next = {
              ...hsv,
              h: Number.parseFloat(event.target.value),
            };

            setHsv(next);
            setColor(hsvToHex(next));
          }}
        />
      </label>

      <div className="color-picker-panel__hex">
        <label>
          <span>Hex</span>
          <input
            type="text"
            spellCheck={false}
            value={hexValue || selectedHex}
            onChange={(event) => setHexValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyHex();
              }
            }}
          />
        </label>

        <button
          type="button"
          disabled={!normalizeHex(hexValue)}
          onClick={applyHex}
        >
          Apply
        </button>

        <button
          type="button"
          disabled={!override}
          onClick={clearOverride}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
