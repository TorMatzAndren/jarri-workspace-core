import { useMemo, useState } from "react";
import type { PanelBodyProps } from "../core/types";

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  time: string;
};

type CalendarDocument = {
  version: 1;
  events: CalendarEvent[];
};

const CALENDAR_STORAGE_KEY = "jarri.workspace.core.calendar.v1";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayKey(): string {
  return dateKey(new Date());
}

function parseCalendarDocument(input: unknown): CalendarDocument {
  if (!input || typeof input !== "object") {
    return { version: 1, events: [] };
  }

  const raw = input as {
    events?: unknown;
  };

  if (!Array.isArray(raw.events)) {
    return { version: 1, events: [] };
  }

  const events = raw.events.flatMap((entry): CalendarEvent[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Record<string, unknown>;

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.date !== "string" ||
      typeof candidate.title !== "string" ||
      typeof candidate.time !== "string"
    ) {
      return [];
    }

    return [
      {
        id: candidate.id,
        date: candidate.date,
        title: candidate.title,
        time: candidate.time,
      },
    ];
  });

  return {
    version: 1,
    events,
  };
}

function loadCalendarEvents(): CalendarEvent[] {
  try {
    const raw = window.localStorage.getItem(CALENDAR_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    return parseCalendarDocument(JSON.parse(raw)).events;
  } catch {
    return [];
  }
}

function persistCalendarEvents(events: CalendarEvent[]): void {
  const document: CalendarDocument = {
    version: 1,
    events,
  };

  window.localStorage.setItem(
    CALENDAR_STORAGE_KEY,
    JSON.stringify(document),
  );
}

function isoWeekNumber(date: Date): number {
  const working = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  const isoDay = working.getUTCDay() || 7;
  working.setUTCDate(working.getUTCDate() + 4 - isoDay);

  const isoYearStart = new Date(
    Date.UTC(working.getUTCFullYear(), 0, 1),
  );

  return Math.ceil(
    ((working.getTime() - isoYearStart.getTime()) / 86_400_000 + 1) / 7,
  );
}

function monthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start);
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      return date;
    }),
  );
}

function monthTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

function eventSort(a: CalendarEvent, b: CalendarEvent): number {
  const timeA = a.time || "99:99";
  const timeB = b.time || "99:99";

  return timeA.localeCompare(timeB) || a.title.localeCompare(b.title);
}

type CalendarTimeFormat = PanelBodyProps["preferences"]["clock"]["timeFormat"];

type CopyCadence = "once" | "daily" | "weekly";

function parseTimeDraft(
  value: string,
  format: CalendarTimeFormat,
): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (format === "24h") {
    const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(trimmed);

    if (!match) {
      return null;
    }

    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2] ?? "0", 10);

    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    return `${pad(hour)}:${pad(minute)}`;
  }

  const match =
    /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)$/i.exec(trimmed);

  if (!match) {
    return null;
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2] ?? "0", 10);
  const meridiem = match[3].toLowerCase();

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (hour === 12) {
    hour = 0;
  }

  if (meridiem === "pm") {
    hour += 12;
  }

  return `${pad(hour)}:${pad(minute)}`;
}

function formatEventTime(
  value: string,
  format: CalendarTimeFormat,
): string {
  if (!value) {
    return "";
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = match[2];

  if (format === "24h") {
    return `${pad(hour)}:${minute}`;
  }

  const meridiem = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${meridiem}`;
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);

  const working = new Date(
    Date.UTC(year, month - 1, day),
  );

  working.setUTCDate(working.getUTCDate() + days);

  return [
    working.getUTCFullYear(),
    pad(working.getUTCMonth() + 1),
    pad(working.getUTCDate()),
  ].join("-");
}

function createEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CalendarPanel({
  preferences,
}: PanelBodyProps) {
  const now = new Date();

  const [displayYear, setDisplayYear] = useState(now.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [events, setEvents] = useState<CalendarEvent[]>(loadCalendarEvents);
  const [titleDraft, setTitleDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState("");
  const [timeError, setTimeError] = useState("");

  const [copySourceId, setCopySourceId] =
    useState<string | null>(null);
  const [copyTargetDate, setCopyTargetDate] =
    useState(todayKey());
  const [copyDatePickerOpen, setCopyDatePickerOpen] =
    useState(false);
  const [copyPickerYear, setCopyPickerYear] =
    useState(now.getFullYear());
  const [copyPickerMonth, setCopyPickerMonth] =
    useState(now.getMonth());
  const [copyCadence, setCopyCadence] =
    useState<CopyCadence>("once");
  const [copyCountDraft, setCopyCountDraft] =
    useState("1");

  const weeks = useMemo(
    () => monthGrid(displayYear, displayMonth),
    [displayYear, displayMonth],
  );

  const copyPickerWeeks = useMemo(
    () => monthGrid(copyPickerYear, copyPickerMonth),
    [copyPickerYear, copyPickerMonth],
  );

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const existing = grouped.get(event.date) ?? [];
      existing.push(event);
      grouped.set(event.date, existing);
    }

    for (const groupedEvents of grouped.values()) {
      groupedEvents.sort(eventSort);
    }

    return grouped;
  }, [events]);

  function changeMonth(delta: number) {
    const target = new Date(displayYear, displayMonth + delta, 1);
    setDisplayYear(target.getFullYear());
    setDisplayMonth(target.getMonth());
  }

  function goToToday() {
    const today = new Date();
    setDisplayYear(today.getFullYear());
    setDisplayMonth(today.getMonth());
    setSelectedDate(dateKey(today));
  }

  function commitEvents(nextEvents: CalendarEvent[]) {
    setEvents(nextEvents);

    try {
      persistCalendarEvents(nextEvents);
    } catch {
      // Calendar remains usable for the current session if storage is unavailable.
    }
  }

  function addEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = titleDraft.trim();

    if (!title) {
      return;
    }

    const normalizedTime = parseTimeDraft(
      timeDraft,
      preferences.clock.timeFormat,
    );

    if (normalizedTime === null) {
      setTimeError(
        preferences.clock.timeFormat === "24h"
          ? "Use HH:MM, for example 14:30."
          : "Use h:mm AM/PM, for example 2:30 PM.",
      );
      return;
    }

    const nextEvent: CalendarEvent = {
      id: createEventId(),
      date: selectedDate,
      title,
      time: normalizedTime,
    };

    commitEvents([...events, nextEvent]);
    setTitleDraft("");
    setTimeDraft("");
    setTimeError("");
  }

  function removeEvent(eventId: string) {
    commitEvents(events.filter((event) => event.id !== eventId));

    if (copySourceId === eventId) {
      setCopySourceId(null);
    }
  }

  function beginCopy(source: CalendarEvent) {
    const [year, month] = source.date
      .split("-")
      .map(Number);

    setCopySourceId(source.id);
    setCopyTargetDate(source.date);
    setCopyPickerYear(year);
    setCopyPickerMonth(month - 1);
    setCopyDatePickerOpen(false);
    setCopyCadence("once");
    setCopyCountDraft("1");
  }

  function openCopyDatePicker() {
    const [year, month] = copyTargetDate
      .split("-")
      .map(Number);

    setCopyPickerYear(year);
    setCopyPickerMonth(month - 1);
    setCopyDatePickerOpen(true);
  }

  function changeCopyPickerMonth(delta: number) {
    const target = new Date(
      copyPickerYear,
      copyPickerMonth + delta,
      1,
    );

    setCopyPickerYear(target.getFullYear());
    setCopyPickerMonth(target.getMonth());
  }

  function chooseCopyDate(date: Date) {
    setCopyTargetDate(dateKey(date));
    setCopyDatePickerOpen(false);
  }

  function copyPickerToday() {
    const today = new Date();

    setCopyPickerYear(today.getFullYear());
    setCopyPickerMonth(today.getMonth());
    setCopyTargetDate(dateKey(today));
  }

  function copyEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const source = events.find(
      (candidate) => candidate.id === copySourceId,
    );

    if (!source) {
      setCopySourceId(null);
      return;
    }

    const parsedCount = Number.parseInt(copyCountDraft, 10);

    const count =
      copyCadence === "once"
        ? 1
        : Math.max(
            1,
            Math.min(
              104,
              Number.isFinite(parsedCount) ? parsedCount : 1,
            ),
          );

    const intervalDays =
      copyCadence === "weekly"
        ? 7
        : copyCadence === "daily"
          ? 1
          : 0;

    const copies = Array.from(
      { length: count },
      (_, index): CalendarEvent => ({
        id: createEventId(),
        date:
          intervalDays === 0
            ? copyTargetDate
            : addCalendarDays(
                copyTargetDate,
                intervalDays * (index + 1),
              ),
        title: source.title,
        time: source.time,
      }),
    );

    commitEvents([...events, ...copies]);
    setSelectedDate(copyTargetDate);
    setCopySourceId(null);
    setCopyCadence("once");
    setCopyCountDraft("1");
  }

  return (
    <div className="calendar-panel">
      <div className="calendar-panel__toolbar">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="Previous month"
        >
          ←
        </button>

        <strong>{monthTitle(displayYear, displayMonth)}</strong>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label="Next month"
        >
          →
        </button>

        <button
          type="button"
          className="calendar-panel__today"
          onClick={goToToday}
        >
          Today
        </button>
      </div>

      <div className="calendar-panel__weekday-row" aria-hidden="true">
        <span className="calendar-panel__week-heading">Week</span>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="calendar-panel__month">
        {weeks.map((week) => {
          const monday = week[0];

          return (
            <div
              className="calendar-panel__week-row"
              key={dateKey(monday)}
            >
              <div className="calendar-panel__week-number">
                v. {isoWeekNumber(monday)}
              </div>

              {week.map((day) => {
                const key = dateKey(day);
                const dayEvents = eventsByDate.get(key) ?? [];
                const inMonth = day.getMonth() === displayMonth;
                const isToday = key === todayKey();
                const selected = key === selectedDate;

                return (
                  <div
                    key={key}
                    className={[
                      "calendar-panel__day",
                      inMonth ? "" : "calendar-panel__day--outside",
                      isToday ? "calendar-panel__day--today" : "",
                      selected ? "calendar-panel__day--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <button
                      type="button"
                      className="calendar-panel__day-select"
                      onClick={() => setSelectedDate(key)}
                      aria-label={`Select ${key}`}
                    >
                      <span>{day.getDate()}</span>
                    </button>

                    <div className="calendar-panel__events">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="calendar-panel__event"
                          title={`${event.time ? `${event.time} · ` : ""}${event.title}`}
                        >
                          <span>
                            {event.time
                              ? `${formatEventTime(
                                  event.time,
                                  preferences.clock.timeFormat,
                                )} `
                              : ""}
                            {event.title}
                          </span>

                          <div className="calendar-panel__event-actions">
                            <button
                              type="button"
                              onClick={() => beginCopy(event)}
                              aria-label={`Copy ${event.title}`}
                              title="Copy event"
                            >
                              ⧉
                            </button>

                            <button
                              type="button"
                              onClick={() => removeEvent(event.id)}
                              aria-label={`Delete ${event.title}`}
                              title="Delete event"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <form
        className="calendar-panel__event-form"
        onSubmit={addEvent}
      >
        <div className="calendar-panel__event-form-heading">
          <strong>Add event</strong>
          <span>{selectedDate}</span>
        </div>

        <label>
          <span>
            Time ({preferences.clock.timeFormat === "24h" ? "24h" : "12h"})
          </span>
          <input
            type="text"
            inputMode={
              preferences.clock.timeFormat === "24h"
                ? "numeric"
                : "text"
            }
            autoComplete="off"
            spellCheck={false}
            value={timeDraft}
            placeholder={
              preferences.clock.timeFormat === "24h"
                ? "14:30"
                : "2:30 PM"
            }
            aria-invalid={Boolean(timeError)}
            onChange={(event) => {
              setTimeDraft(event.target.value);
              setTimeError("");
            }}
          />
          {timeError ? (
            <small className="calendar-panel__field-error">
              {timeError}
            </small>
          ) : null}
        </label>

        <label className="calendar-panel__event-title">
          <span>Event</span>
          <input
            type="text"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            placeholder="Meeting, phone call, work, party…"
          />
        </label>

        <button
          type="submit"
          disabled={!titleDraft.trim()}
        >
          Add
        </button>
      </form>

      {copySourceId ? (
        <form
          className="calendar-panel__copy-form"
          onSubmit={copyEvent}
        >
          <div className="calendar-panel__copy-heading">
            <strong>Copy event</strong>
            <span>
              {events.find(
                (event) => event.id === copySourceId,
              )?.title ?? "Event"}
            </span>
          </div>

          <label>
            <span>Start date</span>
            <button
              type="button"
              className="calendar-panel__date-picker-button"
              onClick={openCopyDatePicker}
            >
              {copyTargetDate}
            </button>
          </label>

          <label>
            <span>Copy</span>
            <select
              value={copyCadence}
              onChange={(event) =>
                setCopyCadence(
                  event.target.value as CopyCadence,
                )
              }
            >
              <option value="once">Once</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
            </select>
          </label>

          <label>
            <span>Copies</span>
            <input
              type="number"
              min="1"
              max="104"
              value={
                copyCadence === "once"
                  ? "1"
                  : copyCountDraft
              }
              disabled={copyCadence === "once"}
              onChange={(event) =>
                setCopyCountDraft(event.target.value)
              }
            />
          </label>

          <div className="calendar-panel__copy-actions">
            <button type="submit">
              Copy
            </button>

            <button
              type="button"
              onClick={() => {
                setCopyDatePickerOpen(false);
                setCopySourceId(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {copyDatePickerOpen ? (
        <div
          className="calendar-panel__modal-backdrop"
          onMouseDown={() => setCopyDatePickerOpen(false)}
        >
          <section
            className="calendar-panel__date-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choose copy start date"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="calendar-panel__date-picker-toolbar">
              <button
                type="button"
                onClick={() => changeCopyPickerMonth(-1)}
                aria-label="Previous month"
              >
                ←
              </button>

              <strong>
                {monthTitle(
                  copyPickerYear,
                  copyPickerMonth,
                )}
              </strong>

              <button
                type="button"
                onClick={() => changeCopyPickerMonth(1)}
                aria-label="Next month"
              >
                →
              </button>

              <button
                type="button"
                className="calendar-panel__date-picker-today"
                onClick={copyPickerToday}
              >
                Today
              </button>
            </div>

            <div
              className="calendar-panel__date-picker-weekdays"
              aria-hidden="true"
            >
              <span>Week</span>

              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="calendar-panel__date-picker-grid">
              {copyPickerWeeks.map((week) => (
                <div
                  className="calendar-panel__date-picker-week"
                  key={dateKey(week[0])}
                >
                  <span className="calendar-panel__date-picker-week-number">
                    v. {isoWeekNumber(week[0])}
                  </span>

                  {week.map((day) => {
                    const key = dateKey(day);
                    const outside =
                      day.getMonth() !== copyPickerMonth;
                    const selected =
                      key === copyTargetDate;
                    const today =
                      key === todayKey();

                    return (
                      <button
                        key={key}
                        type="button"
                        className={[
                          "calendar-panel__date-picker-day",
                          outside
                            ? "calendar-panel__date-picker-day--outside"
                            : "",
                          selected
                            ? "calendar-panel__date-picker-day--selected"
                            : "",
                          today
                            ? "calendar-panel__date-picker-day--today"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => chooseCopyDate(day)}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="calendar-panel__date-picker-footer">
              <span>Selected: {copyTargetDate}</span>

              <button
                type="button"
                onClick={() => setCopyDatePickerOpen(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
