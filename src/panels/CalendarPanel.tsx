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

type CopyMode = "off" | "copyDate" | "copyWeekly" | "copyWorkWeek";
type ActiveCopyMode = Exclude<CopyMode, "off">;

type FrozenCopyEvent = {
  title: string;
  time: string;
};

type FrozenEventSourceEvent = CalendarEvent & {
  weekdayOffset: number;
};

type FrozenWorkWeekEvent = {
  weekdayOffset: number;
  title: string;
  time: string;
};

type FrozenWorkWeek = {
  monday: string;
  events: FrozenWorkWeekEvent[];
};

export type CopySource =
  | {
      kind: "event";
      sourceDate: string;
      weekdayOffset: number;
      event: FrozenEventSourceEvent;
      workWeek: FrozenWorkWeek;
    }
  | {
      kind: "date";
      sourceDate: string;
      weekdayOffset: number;
      events: FrozenCopyEvent[];
      workWeek: FrozenWorkWeek;
    };

type CopySourceSelection =
  | { kind: "event"; event: CalendarEvent }
  | { kind: "date"; date: string };

export function removeEventsByIds<T extends { id: string }>(
  events: readonly T[],
  ids: readonly string[],
): T[] {
  const idsToRemove = new Set(ids);
  return events.filter((event) => !idsToRemove.has(event.id));
}

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

export function addCalendarDays(date: string, days: number): string {
  const working = parseCalendarDate(date);

  if (!working) {
    return date;
  }

  working.setDate(working.getDate() + days);
  return dateKey(working);
}

export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(0);
  parsed.setHours(12, 0, 0, 0);
  parsed.setFullYear(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function weekdayOffset(date: string): number | null {
  const parsed = parseCalendarDate(date);

  return parsed ? (parsed.getDay() + 6) % 7 : null;
}

export function mondayOfCalendarWeek(date: string): string | null {
  const offset = weekdayOffset(date);

  return offset === null ? null : addCalendarDays(date, -offset);
}

export function freezeCopySource(
  calendarEvents: readonly CalendarEvent[],
  selection: CopySourceSelection,
): CopySource | null {
  const sourceDate =
    selection.kind === "event" ? selection.event.date : selection.date;
  const sourceWeekday = weekdayOffset(sourceDate);
  const sourceMonday = mondayOfCalendarWeek(sourceDate);

  if (sourceWeekday === null || !sourceMonday) {
    return null;
  }

  const workWeekDates = new Set(
    Array.from({ length: 5 }, (_, offset) =>
      addCalendarDays(sourceMonday, offset),
    ),
  );
  const workWeek: FrozenWorkWeek = {
    monday: sourceMonday,
    events: calendarEvents.flatMap((event): FrozenWorkWeekEvent[] => {
      if (!workWeekDates.has(event.date)) {
        return [];
      }

      const offset = weekdayOffset(event.date);
      return offset === null
        ? []
        : [{ weekdayOffset: offset, title: event.title, time: event.time }];
    }),
  };

  if (selection.kind === "event") {
    return {
      kind: "event",
      sourceDate,
      weekdayOffset: sourceWeekday,
      event: { ...selection.event, weekdayOffset: sourceWeekday },
      workWeek,
    };
  }

  return {
    kind: "date",
    sourceDate,
    weekdayOffset: sourceWeekday,
    events: calendarEvents
      .filter((event) => event.date === sourceDate)
      .map(({ title, time }) => ({ title, time })),
    workWeek,
  };
}

export function sourceSupportsCopyMode(
  source: CopySource | null,
  mode: ActiveCopyMode,
): boolean {
  if (!source) {
    return false;
  }

  if (mode === "copyWorkWeek") {
    return source.workWeek.events.length > 0;
  }

  return source.kind === "event" || source.events.length > 0;
}

export function createCopiesForDestination(
  source: CopySource,
  mode: ActiveCopyMode,
  destinationDate: string,
  createId: () => string,
): CalendarEvent[] {
  if (!sourceSupportsCopyMode(source, mode)) {
    return [];
  }

  const makeCopy = (
    date: string,
    event: FrozenCopyEvent,
  ): CalendarEvent => ({
    id: createId(),
    date,
    title: event.title,
    time: event.time,
  });

  if (mode === "copyDate") {
    return source.kind === "event"
      ? [makeCopy(destinationDate, source.event)]
      : source.events.map((event) => makeCopy(destinationDate, event));
  }

  const targetMonday = mondayOfCalendarWeek(destinationDate);

  if (!targetMonday) {
    return [];
  }

  if (mode === "copyWeekly") {
    const targetDate = addCalendarDays(targetMonday, source.weekdayOffset);

    return source.kind === "event"
      ? [makeCopy(targetDate, source.event)]
      : source.events.map((event) => makeCopy(targetDate, event));
  }

  return source.workWeek.events.map((event) =>
    makeCopy(
      addCalendarDays(targetMonday, event.weekdayOffset),
      event,
    ),
  );
}

export function createCopyDestinationTransaction(
  existingEvents: readonly CalendarEvent[],
  source: CopySource | null,
  mode: CopyMode,
  destinationDate: string,
  createId: () => string,
): { events: CalendarEvent[]; generatedIds: string[] } | null {
  if (mode === "off" || !source || !sourceSupportsCopyMode(source, mode)) {
    return null;
  }

  const copies = createCopiesForDestination(
    source,
    mode,
    destinationDate,
    createId,
  );

  if (copies.length === 0) {
    return null;
  }

  return {
    events: [...existingEvents, ...copies],
    generatedIds: copies.map((event) => event.id),
  };
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

  const [copySource, setCopySource] =
    useState<CopySource | null>(null);
  const [copyMode, setCopyMode] = useState<CopyMode>("off");
  const [copyUndoEventIds, setCopyUndoEventIds] =
    useState<string[] | null>(null);

  const weeks = useMemo(
    () => monthGrid(displayYear, displayMonth),
    [displayYear, displayMonth],
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
  }

  function selectCopySource(source: CopySource) {
    setCopySource(source);
    setSelectedDate(source.sourceDate);

    if (
      copyMode !== "off" &&
      !sourceSupportsCopyMode(source, copyMode)
    ) {
      const fallbackMode = (
        ["copyDate", "copyWeekly", "copyWorkWeek"] as const
      ).find((mode) => sourceSupportsCopyMode(source, mode));

      setCopyMode(fallbackMode ?? "off");
    }
  }

  function selectEventSource(event: CalendarEvent) {
    const source = freezeCopySource(events, { kind: "event", event });

    if (source) {
      selectCopySource(source);
    }
  }

  function chooseCopyMode(mode: ActiveCopyMode) {
    if (sourceSupportsCopyMode(copySource, mode)) {
      setCopyMode(mode);
    }
  }

  function handleCalendarDayClick(date: string) {
    if (copyMode === "off") {
      setSelectedDate(date);
      const source = freezeCopySource(events, { kind: "date", date });

      if (source) {
        setCopySource(source);
      }
      return;
    }

    const transaction = createCopyDestinationTransaction(
      events,
      copySource,
      copyMode,
      date,
      createEventId,
    );

    if (transaction) {
      commitEvents(transaction.events);
      setCopyUndoEventIds(transaction.generatedIds);
    }
  }

  function undoCopy() {
    if (!copyUndoEventIds) {
      return;
    }

    commitEvents(removeEventsByIds(events, copyUndoEventIds));
    setCopyUndoEventIds(null);
  }

  function handleCalendarCellClick(
    event: React.MouseEvent<HTMLDivElement>,
    date: string,
  ) {
    const target = event.target;

    if (
      target instanceof Element &&
      target.closest("button, a, input, select, textarea, [role='button']")
    ) {
      return;
    }

    handleCalendarDayClick(date);
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
                Week {isoWeekNumber(monday)}
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
                      copySource?.kind === "date" &&
                      copySource.sourceDate === key
                        ? "calendar-panel__day--source"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={(event) =>
                      handleCalendarCellClick(event, key)
                    }
                  >
                    <button
                      type="button"
                      className="calendar-panel__day-select"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCalendarDayClick(key);
                      }}
                      aria-label={
                        copyMode !== "off"
                          ? `Copy to ${key}`
                          : `Select ${key}`
                      }
                    >
                      <span>{day.getDate()}</span>
                    </button>

                    <div className="calendar-panel__events">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className={[
                            "calendar-panel__event",
                            copySource?.kind === "event" &&
                            copySource.event.id === event.id
                              ? "calendar-panel__event--source"
                              : "",
                          ].filter(Boolean).join(" ")}
                          title={`${event.time ? `${event.time} · ` : ""}${event.title}`}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            selectEventSource(event);
                          }}
                        >
                          <button
                            type="button"
                            className="calendar-panel__event-source"
                            aria-label={`Select ${event.title} as copy source`}
                            aria-pressed={
                              copySource?.kind === "event" &&
                              copySource.event.id === event.id
                            }
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation();
                              selectEventSource(event);
                            }}
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
                          </button>

                          <div className="calendar-panel__event-actions">
                            <button
                              type="button"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                removeEvent(event.id);
                              }}
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

      <section
        className="calendar-panel__copy-mode"
        aria-label="Calendar copy mode"
      >
        <div className="calendar-panel__copy-heading">
          <strong>Copy source</strong>
          <span>
            {!copySource ? (
              "No copy source selected"
            ) : copySource.kind === "event" ? (
              <>Source: {WEEKDAY_LABELS[copySource.weekdayOffset]} {copySource.event.time
                ? formatEventTime(
                    copySource.event.time,
                    preferences.clock.timeFormat,
                  )
                : "No time"} · {copySource.event.title}</>
            ) : (
              <>Source: {WEEKDAY_LABELS[copySource.weekdayOffset]} {copySource.sourceDate} · {copySource.events.length > 0
                ? `${copySource.events.length} events`
                : "No events on selected date"}</>
            )}
          </span>
          {copySource ? (
            <small>
              Week {isoWeekNumber(
                parseCalendarDate(copySource.workWeek.monday) ?? now,
              )} · {copySource.workWeek.events.length} work-week events
            </small>
          ) : null}
        </div>

        <div
          className="calendar-panel__copy-controls"
          role="group"
          aria-label="Choose copy mode"
        >
          <button
            type="button"
            className={
              copyMode === "off"
                ? "calendar-panel__copy-control--active"
                : ""
            }
            aria-pressed={copyMode === "off"}
            onClick={() => setCopyMode("off")}
          >
            Off
          </button>
          <button
            type="button"
            className={
              copyMode === "copyDate"
                ? "calendar-panel__copy-control--active"
                : ""
            }
            aria-pressed={copyMode === "copyDate"}
            disabled={!sourceSupportsCopyMode(copySource, "copyDate")}
            onClick={() => chooseCopyMode("copyDate")}
          >
            Copy Date
          </button>
          <button
            type="button"
            className={
              copyMode === "copyWeekly"
                ? "calendar-panel__copy-control--active"
                : ""
            }
            aria-pressed={copyMode === "copyWeekly"}
            disabled={!sourceSupportsCopyMode(copySource, "copyWeekly")}
            onClick={() => chooseCopyMode("copyWeekly")}
          >
            Copy Weekly
          </button>
          <button
            type="button"
            className={
              copyMode === "copyWorkWeek"
                ? "calendar-panel__copy-control--active"
                : ""
            }
            aria-pressed={copyMode === "copyWorkWeek"}
            disabled={!sourceSupportsCopyMode(copySource, "copyWorkWeek")}
            onClick={() => chooseCopyMode("copyWorkWeek")}
          >
            Copy Work Week
          </button>
          <button
            type="button"
            disabled={!copyUndoEventIds}
            onClick={undoCopy}
          >
            Undo
          </button>
        </div>
      </section>
    </div>
  );
}
