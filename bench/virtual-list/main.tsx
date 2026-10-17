import {
  Profiler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  WorkspaceVirtualList,
  type WorkspaceVirtualListDiagnostics,
} from "../../src/core/presentation/WorkspaceVirtualList";
import "./style.css";

type RecordItem = {
  id: number;
  title: string;
  detail: string;
};

type Result = {
  count: number;
  variable: boolean;
  elapsedMs: number;
  frames: number;
  meanFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  longFrames: number;
  reactCommits: number;
  reactTotalMs: number;
  reactMaxMs: number;
  maxMounted: number;
  finalMounted: number;
  totalRecords: number;
};

const COUNTS = [1000, 10000, 100000] as const;
const DURATION_MS = 5000;

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * fraction),
  )];
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function App() {
  const [count, setCount] = useState<number>(10000);
  const [variable, setVariable] = useState(false);
  const [diagnostics, setDiagnostics] =
    useState<WorkspaceVirtualListDiagnostics | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [generationMs, setGenerationMs] = useState(0);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const metricsRef = useRef({
    frames: [] as number[],
    commits: [] as number[],
    maxMounted: 0,
  });

  const records = useMemo(() => {
    const start = performance.now();

    const items: RecordItem[] = Array.from(
      { length: count },
      (_, index) => ({
        id: index,
        title: `Record ${String(index).padStart(6, "0")}`,
        detail: `Deterministic sample · group ${index % 47} · value ${index * 17}`,
      }),
    );

    // Sample for display; actual generation is completed synchronously.
    queueMicrotask(() => setGenerationMs(
      round(performance.now() - start),
    ));

    return items;
  }, [count]);

  const getKey = useCallback((item: RecordItem) => item.id, []);

  const renderItem = useCallback((item: RecordItem) => (
    <div
      className={`benchmark-row ${
        variable ? `benchmark-row--${item.id % 4}` : ""
      }`}
    >
      <span className="benchmark-row__id">#{item.id}</span>
      <span>
        <strong>{item.title}</strong>
        <small>{item.detail}</small>
      </span>
    </div>
  ), [variable]);

  const onDiagnostics = useCallback(
    (next: WorkspaceVirtualListDiagnostics) => {
      setDiagnostics(next);
      metricsRef.current.maxMounted = Math.max(
        metricsRef.current.maxMounted,
        next.renderedCount,
      );
    },
    [],
  );

  const onRender = useCallback((
    _id: string,
    _phase: string,
    actualDuration: number,
  ) => {
    if (runRef.current !== null) {
      metricsRef.current.commits.push(actualDuration);
    }
  }, []);

  const stop = useCallback(() => {
    if (runRef.current !== null) {
      cancelAnimationFrame(runRef.current);
      runRef.current = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => () => {
    if (runRef.current !== null) {
      cancelAnimationFrame(runRef.current);
    }
  }, []);

  const start = useCallback(() => {
    if (runRef.current !== null) return;

    const viewport = hostRef.current?.querySelector<HTMLElement>(
      ".workspace-virtual-list",
    );

    if (!viewport || !viewport.clientHeight) return;

    metricsRef.current = {
      frames: [],
      commits: [],
      maxMounted: 0,
    };

    progressRef.current = 0;
    viewport.scrollTop = 0;
    setElapsed(0);
    setRunning(true);

    const startTime = performance.now();
    let lastFrame = startTime;

    const step = (now: number) => {
      const elapsedMs = now - startTime;
      const delta = now - lastFrame;
      lastFrame = now;

      if (elapsedMs > 0 && delta > 0) {
        metricsRef.current.frames.push(delta);
      }

      const fraction = Math.min(1, elapsedMs / DURATION_MS);

      // Linear scan through the entire virtual extent.
      const maximumScroll = Math.max(
        0,
        viewport.scrollHeight - viewport.clientHeight,
      );

      viewport.scrollTop = maximumScroll * fraction;
      progressRef.current = fraction;

      if (elapsedMs < DURATION_MS) {
        runRef.current = requestAnimationFrame(step);
        return;
      }

      runRef.current = null;
      setRunning(false);
      setElapsed(round(elapsedMs));

      const frames = metricsRef.current.frames;
      const commits = metricsRef.current.commits;

      const average = frames.length
        ? frames.reduce((a, b) => a + b, 0) / frames.length
        : 0;

      const commitTotal = commits.reduce((a, b) => a + b, 0);

      const result: Result = {
        count,
        variable,
        elapsedMs: round(elapsedMs),
        frames: frames.length,
        meanFrameMs: round(average),
        p95FrameMs: round(percentile(frames, 0.95)),
        maxFrameMs: round(Math.max(0, ...frames)),
        longFrames: frames.filter(value => value > 32).length,
        reactCommits: commits.length,
        reactTotalMs: round(commitTotal),
        reactMaxMs: round(Math.max(0, ...commits)),
        maxMounted: metricsRef.current.maxMounted,
        finalMounted: viewport.querySelectorAll(
          "[data-workspace-virtual-index]",
        ).length,
        totalRecords: records.length,
      };

      setResults(previous => [...previous, result]);
    };

    runRef.current = requestAnimationFrame(step);
  }, [count, variable, records]);

  const mounted = diagnostics?.renderedCount ?? 0;
  const ratio = count ? (mounted / count) * 100 : 0;

  return (
    <div className="benchmark">
      <header>
        <h1>Jarri Core · Virtualization Benchmark</h1>
        <p>
          Core 0.4.0 development harness — actual WorkspaceVirtualList,
          independent of the Workspace runtime.
        </p>
      </header>

      <section className="controls">
        <label>
          Records
          <select
            value={count}
            disabled={running}
            onChange={event => setCount(Number(event.target.value))}
          >
            {COUNTS.map(value => (
              <option key={value} value={value}>
                {value.toLocaleString()}
              </option>
            ))}
          </select>
        </label>

        <label>
          Row geometry
          <select
            value={variable ? "variable" : "fixed"}
            disabled={running}
            onChange={event =>
              setVariable(event.target.value === "variable")
            }
          >
            <option value="fixed">Fixed height</option>
            <option value="variable">Variable height</option>
          </select>
        </label>

        <button disabled={running} onClick={start}>
          Run 5-second scroll test
        </button>

        <button disabled={!running} onClick={stop}>
          Stop
        </button>
      </section>

      <section className="metrics">
        <div>
          <span>Materialized records</span>
          <strong>{count.toLocaleString()}</strong>
        </div>
        <div>
          <span>Rendered virtual rows</span>
          <strong>{mounted.toLocaleString()}</strong>
        </div>
        <div>
          <span>Rendered / total</span>
          <strong>{ratio.toFixed(3)}%</strong>
        </div>
        <div>
          <span>Measured rows</span>
          <strong>{diagnostics?.measuredCount ?? 0}</strong>
        </div>
        <div>
          <span>Generation sample</span>
          <strong>{generationMs} ms</strong>
        </div>
        <div>
          <span>Viewport</span>
          <strong>{diagnostics?.viewportSize ?? 0} px</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-heading">
          <strong>Virtualized records</strong>
          <span>
            {running
              ? `Running · ${Math.round(progressRef.current * 100)}%`
              : elapsed > 0
                ? `Last run: ${elapsed} ms`
                : "Ready — resize this panel or scroll manually"}
          </span>
        </div>

        <div ref={hostRef} className="virtual-host">
          <Profiler id="VirtualList" onRender={onRender}>
            <WorkspaceVirtualList
              key={`${count}:${variable}`}
              items={records}
              getKey={getKey}
              renderItem={renderItem}
              estimatedItemSize={variable ? 48 : 40}
              onDiagnostics={onDiagnostics}
            />
          </Profiler>
        </div>
      </section>

      <section className="results">
        <div className="results-heading">
          <h2>Completed runs</h2>
          <button
            disabled={!results.length}
            onClick={() => {
              const report = JSON.stringify({
                benchmark: "Jarri Core WorkspaceVirtualList",
                durationTargetMs: DURATION_MS,
                userAgent: navigator.userAgent,
                runs: results,
              }, null, 2);
              void navigator.clipboard.writeText(report);
            }}
          >
            Copy report as JSON
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Records</th>
                <th>Geometry</th>
                <th>Frames</th>
                <th>Mean frame</th>
                <th>P95 frame</th>
                <th>Frames &gt;32ms</th>
                <th>React total</th>
                <th>Max rows</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={index}>
                  <td>{result.count.toLocaleString()}</td>
                  <td>{result.variable ? "Variable" : "Fixed"}</td>
                  <td>{result.frames}</td>
                  <td>{result.meanFrameMs} ms</td>
                  <td>{result.p95FrameMs} ms</td>
                  <td>{result.longFrames}</td>
                  <td>{result.reactTotalMs} ms</td>
                  <td>{result.maxMounted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="note">
          Frame intervals are requestAnimationFrame sampling intervals,
          not GPU frame times. React Profiler measures React render work,
          not total browser layout or paint cost. The benchmark runs in
          a development build and is intended for comparative testing,
          not absolute production-performance claims.
        </p>
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
