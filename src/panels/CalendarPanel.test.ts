import {
  addCalendarDays,
  createCopyDestinationTransaction,
  createCopiesForDestination,
  freezeCopySource,
  mondayOfCalendarWeek,
  parseCalendarDate,
  removeEventsByIds,
  sourceSupportsCopyMode,
  weekdayOffset,
} from "./CalendarPanel";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function testCalendarDateParsing() {
  assertEqual(
    parseCalendarDate("2024-02-29")?.getDate(),
    29,
    "leap-day calendar key parses as a local date",
  );
  assertEqual(
    parseCalendarDate("2025-02-29"),
    null,
    "invalid calendar date is rejected",
  );
  assertEqual(
    parseCalendarDate("2026-9-21"),
    null,
    "calendar keys require zero-padded month and day",
  );
}

function testMondayBasedWeekDates() {
  assertEqual(
    weekdayOffset("2026-09-21"),
    0,
    "Monday has weekday offset zero",
  );
  assertEqual(
    weekdayOffset("2026-09-26"),
    5,
    "Saturday remains outside the five-day work week",
  );
  assertEqual(
    weekdayOffset("2026-09-27"),
    6,
    "Sunday remains outside the five-day work week",
  );
  assertEqual(
    mondayOfCalendarWeek("2021-01-01"),
    "2020-12-28",
    "week resolution crosses a calendar year at Monday",
  );
}

function testLocalCalendarDayArithmetic() {
  assertEqual(
    addCalendarDays("2026-03-29", 1),
    "2026-03-30",
    "day arithmetic preserves the local date across daylight-saving changes",
  );
  assertEqual(
    addCalendarDays("2026-01-01", -1),
    "2025-12-31",
    "day arithmetic crosses a year boundary",
  );
}

function testCopyUndoRemovesOnlyGeneratedIds() {
  const existingDuplicate = {
    id: "existing",
    date: "2026-09-24",
    title: "Dentist",
    time: "14:30",
  };
  const generatedCopy = {
    ...existingDuplicate,
    id: "generated-copy",
  };
  const secondGeneratedCopy = {
    ...existingDuplicate,
    id: "generated-copy-two",
  };
  const unrelated = {
    id: "unrelated",
    date: "2026-09-25",
    title: "Report",
    time: "16:00",
  };

  const remaining = removeEventsByIds(
    [existingDuplicate, generatedCopy, secondGeneratedCopy, unrelated],
    [generatedCopy.id, secondGeneratedCopy.id],
  );

  assertEqual(
    remaining.map((event) => event.id).join(","),
    "existing,unrelated",
    "undo removes all generated IDs and preserves identical existing events",
  );
  assertEqual(
    removeEventsByIds([existingDuplicate, unrelated], ["missing"]).length,
    2,
    "undoing an ID that is no longer present does not remove another event",
  );
}

function testFrozenEventAndDateCopySources() {
  const events = [
    { id: "mon", date: "2026-09-21", title: "Meeting", time: "09:00" },
    { id: "a", date: "2026-09-22", title: "A", time: "08:00" },
    { id: "b", date: "2026-09-22", title: "B", time: "12:00" },
    { id: "c", date: "2026-09-22", title: "C", time: "18:00" },
    { id: "fri", date: "2026-09-25", title: "Report", time: "16:00" },
    { id: "sat", date: "2026-09-26", title: "Weekend", time: "10:00" },
  ];
  const eventSource = freezeCopySource(events, {
    kind: "event",
    event: events[2],
  });
  const dateSource = freezeCopySource(events, {
    kind: "date",
    date: "2026-09-22",
  });

  assert(eventSource?.kind === "event", "event selection creates an event source");
  assert(dateSource?.kind === "date", "date selection creates a date source");
  assertEqual(dateSource.events.length, 3, "date source freezes every event on its date");
  assertEqual(eventSource.workWeek.events.length, 5, "event source freezes its complete work week");
  assert(
    eventSource.workWeek.events.every((event) => event.weekdayOffset < 5),
    "work-week source excludes Saturday and Sunday",
  );

  events[2].title = "Changed after source selection";
  assertEqual(eventSource.event.title, "B", "event source remains frozen after calendar changes");
  assertEqual(dateSource.events[1].title, "B", "date source remains frozen after calendar changes");

  let generatedId = 0;
  const createId = () => `generated-${++generatedId}`;
  const dateCopies = createCopiesForDestination(
    dateSource,
    "copyDate",
    "2026-10-03",
    createId,
  );
  assertEqual(dateCopies.length, 3, "Copy Date duplicates the frozen source-date set");
  assert(
    dateCopies.every((event) => event.date === "2026-10-03"),
    "Copy Date uses the literal destination date",
  );
  assert(
    new Set(dateCopies.map((event) => event.id)).size === dateCopies.length,
    "each generated event receives a fresh ID",
  );

  const eventDateCopy = createCopiesForDestination(
    eventSource,
    "copyDate",
    "2026-10-03",
    createId,
  );
  assertEqual(eventDateCopy.length, 1, "event-source Copy Date copies one event");
  assertEqual(eventDateCopy[0].title, "B", "event-source Copy Date uses frozen content");
  assertEqual(eventDateCopy[0].date, "2026-10-03", "event-source Copy Date uses the literal date");

  const eventWeeklyCopy = createCopiesForDestination(
    eventSource,
    "copyWeekly",
    "2026-10-10",
    createId,
  );
  assertEqual(eventWeeklyCopy.length, 1, "event-source Copy Weekly copies one event");
  assertEqual(eventWeeklyCopy[0].date, "2026-10-06", "event-source Copy Weekly preserves its weekday");

  const eventWorkWeekCopies = createCopiesForDestination(
    eventSource,
    "copyWorkWeek",
    "2026-10-10",
    createId,
  );
  assertEqual(eventWorkWeekCopies.length, 5, "event-source Copy Work Week uses its frozen week");

  const weeklyCopies = createCopiesForDestination(
    dateSource,
    "copyWeekly",
    "2026-10-10",
    createId,
  );
  assertEqual(weeklyCopies.length, 3, "Copy Weekly duplicates all frozen date events");
  assert(
    weeklyCopies.every((event) => event.date === "2026-10-06"),
    "date-source Copy Weekly places all events on the source weekday",
  );

  const workWeekCopies = createCopiesForDestination(
    dateSource,
    "copyWorkWeek",
    "2026-10-10",
    createId,
  );
  assertEqual(workWeekCopies.length, 5, "Copy Work Week uses the full frozen week");
  assertEqual(
    workWeekCopies.map((event) => event.date).join(","),
    "2026-10-05,2026-10-06,2026-10-06,2026-10-06,2026-10-09",
    "Copy Work Week preserves each frozen weekday offset",
  );

  const emptyDateSource = freezeCopySource(events, {
    kind: "date",
    date: "2026-09-27",
  });
  assert(emptyDateSource, "an empty date can be selected as a source");
  assertEqual(
    sourceSupportsCopyMode(emptyDateSource, "copyDate"),
    false,
    "an empty date disables Copy Date",
  );
  assertEqual(
    sourceSupportsCopyMode(emptyDateSource, "copyWeekly"),
    false,
    "an empty date disables Copy Weekly",
  );
  assertEqual(
    sourceSupportsCopyMode(emptyDateSource, "copyWorkWeek"),
    true,
    "an empty date still permits copying its populated work week",
  );
}

function testWorkWeekDestinationTransaction() {
  const sourceWeekEvents = [
    { id: "mon", date: "2026-09-21", title: "Meeting", time: "09:00" },
    { id: "tue", date: "2026-09-22", title: "Football", time: "18:00" },
    { id: "wed", date: "2026-09-23", title: "Service", time: "10:00" },
    { id: "thu", date: "2026-09-24", title: "Dentist", time: "13:30" },
    { id: "fri", date: "2026-09-25", title: "Report", time: "16:00" },
  ];
  const dateSource = freezeCopySource(sourceWeekEvents, {
    kind: "date",
    date: "2026-09-21",
  });
  assert(dateSource?.kind === "date", "Monday source selection creates date source");
  assertEqual(dateSource.events.length, 1, "source date contains one event");
  assertEqual(dateSource.workWeek.events.length, 5, "frozen work week contains five events");

  let generatedId = 0;
  const transaction = createCopyDestinationTransaction(
    sourceWeekEvents,
    dateSource,
    "copyWorkWeek",
    "2026-09-28",
    () => `copy-${++generatedId}`,
  );

  assert(transaction, "valid Work Week destination creates a transaction");
  assertEqual(transaction.generatedIds.length, 5, "one transaction tracks all five copies");
  assertEqual(
    transaction.events.slice(sourceWeekEvents.length).map(({ date, title }) => `${date} ${title}`).join(","),
    "2026-09-28 Meeting,2026-09-29 Football,2026-09-30 Service,2026-10-01 Dentist,2026-10-02 Report",
    "the component destination transaction stamps the frozen week from Monday",
  );

  const afterUndo = removeEventsByIds(transaction.events, transaction.generatedIds);
  assertEqual(
    afterUndo.map((event) => event.id).join(","),
    sourceWeekEvents.map((event) => event.id).join(","),
    "transaction undo removes only its generated work-week event IDs",
  );
}

testCalendarDateParsing();
testMondayBasedWeekDates();
testLocalCalendarDayArithmetic();
testCopyUndoRemovesOnlyGeneratedIds();
testFrozenEventAndDateCopySources();
testWorkWeekDestinationTransaction();
console.log("Workspace Calendar date tests passed");
