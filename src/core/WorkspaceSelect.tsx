import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type WorkspaceSelectOption<T extends string> = {
  value: T;
  label: string;
};

type WorkspaceSelectProps<T extends string> = {
  value: T;
  options: ReadonlyArray<WorkspaceSelectOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

type PopupGeometry = {
  left: number;
  top: number;
  minWidth: number;
};

export function WorkspaceSelect<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: WorkspaceSelectProps<T>) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [popupGeometry, setPopupGeometry] = useState<PopupGeometry | null>(
    null,
  );

  const selectedIndex = useMemo(() => {
    const index = options.findIndex((option) => option.value === value);
    return index >= 0 ? index : 0;
  }, [options, value]);

  const selectedOption = options[selectedIndex];

  function measurePopup() {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();

    const popup = document.getElementById(listboxId);
    const popupWidth = popup?.getBoundingClientRect().width ?? rect.width;
    const viewportPadding = 8;
    const maxLeft = Math.max(
      viewportPadding,
      window.innerWidth - popupWidth - viewportPadding,
    );

    setPopupGeometry({
      left: Math.min(Math.max(viewportPadding, rect.left), maxLeft),
      top: rect.bottom + 4,
      minWidth: rect.width,
    });
  }

  function openList() {
    if (disabled || options.length === 0) {
      return;
    }

    setActiveIndex(selectedIndex);
    measurePopup();
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(index: number) {
    const option = options[index];

    if (!option) {
      return;
    }

    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveActive(delta: -1 | 1) {
    if (options.length === 0) {
      return;
    }

    setActiveIndex((current) => {
      const next = (current + delta + options.length) % options.length;
      return next;
    });
  }

  function handleTriggerKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!open) {
        setActiveIndex(selectedIndex);
        measurePopup();
        setOpen(true);
      } else {
        moveActive(1);
      }

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!open) {
        setActiveIndex(selectedIndex);
        measurePopup();
        setOpen(true);
      } else {
        moveActive(-1);
      }

      return;
    }

    if ((event.key === "Enter" || event.key === " ") && !open) {
      event.preventDefault();
      openList();
    }
  }

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const active = optionRefs.current[activeIndex];
    active?.focus();

    return undefined;
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function closeFromOutside(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const root = rootRef.current;
      const popup = document.getElementById(listboxId);

      if (root?.contains(target) || popup?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function closeFromEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeList();
    }

    function updateGeometry() {
      measurePopup();
    }

    window.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", closeFromEscape);
    window.addEventListener("resize", updateGeometry);
    window.addEventListener("scroll", updateGeometry, true);

    return () => {
      window.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", closeFromEscape);
      window.removeEventListener("resize", updateGeometry);
      window.removeEventListener("scroll", updateGeometry, true);
    };
  }, [listboxId, open]);

  const shell =
    open && triggerRef.current
      ? triggerRef.current.closest(".workspace-shell")
      : null;

  const popup =
    open && shell && popupGeometry
      ? createPortal(
          <div
            id={listboxId}
            className="workspace-select__listbox"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              left: `${popupGeometry.left}px`,
              top: `${popupGeometry.top}px`,
              minWidth: `${popupGeometry.minWidth}px`,
            }}
          >
            {options.map((option, index) => {
              const selected = option.value === value;
              const active = index === activeIndex;

              return (
                <button
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  className="workspace-select__option"
                  data-active={active}
                  data-selected={selected}
                  role="option"
                  aria-selected={selected}
                  tabIndex={active ? 0 : -1}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => choose(index)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveActive(1);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      moveActive(-1);
                    } else if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      choose(index);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      setActiveIndex(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      setActiveIndex(options.length - 1);
                    } else if (event.key === "Tab") {
                      setOpen(false);
                    }
                  }}
                >
                  <span>{option.label}</span>
                  <span
                    className="workspace-select__check"
                    aria-hidden="true"
                  >
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>,
          shell,
        )
      : null;

  return (
    <div className="workspace-select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="workspace-select__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openList();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="workspace-select__value">
          {selectedOption?.label ?? value}
        </span>
        <span className="workspace-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {popup}
    </div>
  );
}
