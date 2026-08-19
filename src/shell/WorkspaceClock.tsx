import { useEffect, useMemo, useState } from "react";
import type { WorkspaceClockPreferences } from "../core/types";

type WorkspaceClockProps = {
  preferences: WorkspaceClockPreferences;
};

function millisecondsUntilNextMinute(now: Date): number {
  return (
    60_000 -
    (now.getSeconds() * 1_000 + now.getMilliseconds())
  );
}

function numericDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function WorkspaceClock({
  preferences,
}: WorkspaceClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId: number | undefined;

    const timeoutId = window.setTimeout(() => {
      setNow(new Date());

      intervalId = window.setInterval(() => {
        setNow(new Date());
      }, 60_000);
    }, millisecondsUntilNextMinute(new Date()));

    return () => {
      window.clearTimeout(timeoutId);

      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: preferences.timeFormat === "12h",
      }).format(now),
    [now, preferences.timeFormat],
  );

  const date = useMemo(() => {
    if (preferences.dateFormat === "none") {
      return null;
    }

    if (preferences.dateFormat === "numeric") {
      return numericDate(now);
    }

    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(now);
  }, [now, preferences.dateFormat]);

  if (!preferences.enabled) {
    return null;
  }

  return (
    <time
      className="workspace-shell__clock"
      dateTime={now.toISOString()}
      title={now.toLocaleString()}
    >
      <strong>{time}</strong>
      {date ? <span>{date}</span> : null}
    </time>
  );
}
