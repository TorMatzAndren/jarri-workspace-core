import { useEffect, useMemo, useRef } from "react";
import type { PanelBodyProps, PanelDefinition } from "../../core/types";
import { WorkspaceVirtualList } from "../../core/presentation/WorkspaceVirtualList";
import type { RuntimeTimingAggregate, RuntimeTimingTrace } from "../../core/runtimeTiming";
import { createStatusProjection } from "../../core/projection";
import {
  useRuntimeObservationSnapshot,
  useRuntimeResourceEvidenceSnapshot,
  useRuntimeTimingSnapshot,
  useRuntimeTraceSelectionSnapshot,
  useWorkspaceRuntime,
} from "../../core/workspaceRuntimeReact";

const DEFAULT_CHANNEL = "runtime-primary";
const EVENT_COLUMNS = "5.5em minmax(10em, 1.05fr) minmax(12em, 1.2fr) minmax(7em, .65fr) 7em";
const AGGREGATE_COLUMNS = "minmax(9em, 1fr) minmax(12em, 1.3fr) minmax(6em, .65fr) repeat(5, minmax(5.5em, .65fr))";

type OperationRow = {
  sequence: string;
  category: string;
  target: string;
  phase: string;
  duration: string;
};

function channel(panel: PanelBodyProps["panel"]) {
  const value = (panel.panelState as { selectionChannel?: unknown } | null)?.selectionChannel;
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_CHANNEL;
}
function duration(value: number | undefined) {
  return value === undefined || !Number.isFinite(value) ? "—" : `${value.toFixed(value < 10 ? 1 : 0)} ms`;
}
function metadataText(trace: RuntimeTimingTrace | RuntimeTimingAggregate, key: string) {
  const value = trace.metadata?.[key];
  return typeof value === "string" && value.length ? value : undefined;
}
function traceTarget(trace: RuntimeTimingTrace | RuntimeTimingAggregate) {
  const moduleId = metadataText(trace, "moduleId");
  const panelType = metadataText(trace, "panelType");
  if (moduleId && panelType) return `${moduleId} / ${panelType}`;
  if (moduleId) return moduleId;
  if (panelType) return panelType;
  if (trace.category === "workspace-startup") return "Workspace startup";
  if (trace.category === "panel-lifecycle") return metadataText(trace, "panelId") ?? trace.label;
  return trace.label;
}
function tracePhase(trace: RuntimeTimingTrace | RuntimeTimingAggregate) {
  return metadataText(trace, "phase") ?? metadataText(trace, "outcome") ?? "—";
}
export function runtimeTraceRow(trace: RuntimeTimingTrace): OperationRow {
  return {
    sequence: `#${trace.id}`,
    category: trace.category,
    target: traceTarget(trace),
    phase: tracePhase(trace),
    duration: duration(trace.durationMs),
  };
}
export function runtimeAggregateRow(item: RuntimeTimingAggregate) {
  return {
    category: item.category,
    target: traceTarget(item),
    phase: tracePhase(item),
    count: String(item.count),
    minimum: duration(item.minimumMs),
    average: duration(item.averageMs),
    maximum: duration(item.maximumMs),
    latest: duration(item.lastMs),
  };
}
export function runtimeTimingStatistics(traces: readonly RuntimeTimingTrace[]) {
  const categories = new Map<string, number[]>();
  for (const trace of traces) {
    if (trace.durationMs === undefined || !Number.isFinite(trace.durationMs)) continue;
    const samples = categories.get(trace.category) ?? [];
    samples.push(trace.durationMs);
    categories.set(trace.category, samples);
  }
  return [...categories.entries()].map(([category, values]) => ({
    category,
    count: values.length,
    minimum: Math.min(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    maximum: Math.max(...values),
  }));
}
export function runtimeEventRows(traces: readonly RuntimeTimingTrace[]) { return [...traces].reverse(); }
export function runtimeEventVirtualizationEnabled(panelState: unknown) {
  return (panelState as { virtualHistory?: unknown } | null)?.virtualHistory === true;
}
function select(runtime: ReturnType<typeof useWorkspaceRuntime>, panel: PanelBodyProps["panel"], kind: "trace" | "aggregate", id: string) {
  runtime.traceSelection.select(channel(panel), kind, id);
}
function ChannelControl({ panel, updatePanelState }: Pick<PanelBodyProps, "panel" | "updatePanelState">) {
  return <label className="runtime-diagnostics__channel">Selection channel<input value={channel(panel)} onChange={(event) => updatePanelState({ ...(panel.panelState as object), selectionChannel: event.currentTarget.value })} /></label>;
}
function Section({ title, count, children, className = "" }: { title: string; count?: string; children: React.ReactNode; className?: string }) {
  return <section className={`runtime-diagnostics__section ${className}`}><header className="runtime-diagnostics__section-header"><strong>{title}</strong>{count && <span>{count}</span>}</header>{children}</section>;
}
function TimingTable({ rows, selected, onSelect, virtual = false, initialScrollTop = 0, onScrollTopChange }: {
  rows: readonly RuntimeTimingTrace[];
  selected?: { kind: "trace" | "aggregate"; id: string };
  onSelect: (trace: RuntimeTimingTrace) => void;
  virtual?: boolean;
  initialScrollTop?: number;
  onScrollTopChange?: (value: number) => void;
}) {
  const normalViewportRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!virtual && normalViewportRef.current) normalViewportRef.current.scrollTop = initialScrollTop;
  }, [initialScrollTop, virtual]);
  const renderRow = (trace: RuntimeTimingTrace) => {
    const row = runtimeTraceRow(trace);
    const active = selected?.kind === "trace" && selected.id === String(trace.id);
    return <button type="button" key={trace.id} className="runtime-diagnostics__row" style={{ "--workspace-table-columns": EVENT_COLUMNS } as React.CSSProperties} aria-pressed={active} title={`${row.category} · ${row.target} · ${row.phase} · ${row.duration}`} onClick={() => onSelect(trace)}>
      <span className="runtime-diagnostics__sequence">{row.sequence}</span><span className={`runtime-diagnostics__category runtime-diagnostics__category--${trace.category}`}>{row.category}</span><span className="runtime-diagnostics__target">{row.target}</span><span className="runtime-diagnostics__phase">{row.phase}</span><span className="runtime-diagnostics__duration">{row.duration}</span>
    </button>;
  };
  return <div className="runtime-diagnostics__table" style={{ "--workspace-table-columns": EVENT_COLUMNS } as React.CSSProperties}>
    <div className="runtime-diagnostics__table-head"><span>Sequence</span><span>Category</span><span>Target</span><span>Phase</span><span>Duration</span></div>
    {virtual ? <WorkspaceVirtualList items={rows} getKey={(trace) => trace.id} estimatedItemSize={36} className="runtime-diagnostics__virtual" contentClassName="runtime-diagnostics__virtual-content" itemClassName="runtime-diagnostics__virtual-item" initialScrollTop={initialScrollTop} onScrollTopChange={onScrollTopChange} renderItem={(trace) => renderRow(trace)} /> : <div ref={normalViewportRef} className="runtime-diagnostics__rows" onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}>{rows.map(renderRow)}</div>}
  </div>;
}
function AggregateTable({ aggregates, selected, onSelect }: { aggregates: readonly RuntimeTimingAggregate[]; selected?: { kind: "trace" | "aggregate"; id: string }; onSelect: (item: RuntimeTimingAggregate) => void }) {
  return <div className="runtime-diagnostics__table runtime-diagnostics__table--aggregates" style={{ "--workspace-table-columns": AGGREGATE_COLUMNS } as React.CSSProperties}>
    <div className="runtime-diagnostics__table-head"><span>Category</span><span>Target</span><span>Phase</span><span>Count</span><span>Minimum</span><span>Average</span><span>Maximum</span><span>Latest</span></div>
    <div className="runtime-diagnostics__rows">{aggregates.map((item) => {
      const row = runtimeAggregateRow(item);
      return <button type="button" key={item.key} className="runtime-diagnostics__row runtime-diagnostics__aggregate-row" aria-pressed={selected?.kind === "aggregate" && selected.id === item.key} onClick={() => onSelect(item)} title={`${row.category} · ${row.target} · ${row.phase}`}>
        <span className={`runtime-diagnostics__category runtime-diagnostics__category--${item.category}`}>{row.category}</span><span className="runtime-diagnostics__target">{row.target}</span><span className="runtime-diagnostics__phase">{row.phase}</span><span className="runtime-diagnostics__duration">{row.count}</span><span className="runtime-diagnostics__duration">{row.minimum}</span><span className="runtime-diagnostics__duration">{row.average}</span><span className="runtime-diagnostics__duration">{row.maximum}</span><span className="runtime-diagnostics__duration">{row.latest}</span>
      </button>;
    })}</div>
  </div>;
}
function Empty({ children }: { children: React.ReactNode }) { return <p className="runtime-diagnostics__empty">{children}</p>; }

export function RuntimeEventsPanel({ panel, updatePanelState, semanticPublisher }: PanelBodyProps) {
  const runtime = useWorkspaceRuntime();
  const { completed, revision } = useRuntimeTimingSnapshot();
  const rows = useMemo(() => runtimeEventRows(completed), [completed]);
  const selected = useRuntimeTraceSelectionSnapshot().selections.find((entry) => entry.channel === channel(panel));
  const virtual = runtimeEventVirtualizationEnabled(panel.panelState);
  const scrollTop = (panel.panelState as { historyScrollTop?: unknown } | null)?.historyScrollTop;
  const onScrollTopChange = (historyScrollTop: number) => updatePanelState({ ...(panel.panelState as object), historyScrollTop });
  useEffect(() => {
    const lease = semanticPublisher.publish(() => createStatusProjection(rows.length ? "Events recorded" : "No timing events", `${rows.length} retained timing events; revision ${revision}.`));
    return () => lease.release();
  }, [revision, rows.length, semanticPublisher]);
  return <section className="panel-body runtime-diagnostics">
    <PanelIntro title="Runtime Events">Retained Core timing traces. React Profiler values are render measurements, not wall-clock durations.</PanelIntro>
    <div className="runtime-diagnostics__toolbar"><span>{rows.length} retained events · revision {revision}</span><ChannelControl panel={panel} updatePanelState={updatePanelState} /><label className="runtime-diagnostics__toggle"><input type="checkbox" checked={virtual} onChange={(event) => updatePanelState({ ...(panel.panelState as object), virtualHistory: event.currentTarget.checked })} /> Virtualize history</label></div>
    <Section title="Recent Operations" count={`${rows.length} traces`} className="runtime-diagnostics__event-section">{rows.length ? <TimingTable rows={rows} selected={selected} onSelect={(trace) => select(runtime, panel, "trace", String(trace.id))} virtual={virtual} initialScrollTop={typeof scrollTop === "number" ? scrollTop : 0} onScrollTopChange={onScrollTopChange} /> : <Empty>No timing events have been recorded yet.</Empty>}</Section>
  </section>;
}
function PanelIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return <header className="runtime-diagnostics__intro"><div><span>Workspace Diagnostics</span><h2>{title}</h2></div><p>{children}</p></header>;
}
export function RuntimeDiagnosticsPanel({ panel, updatePanelState, semanticPublisher }: PanelBodyProps) {
  const runtime = useWorkspaceRuntime();
  const timing = useRuntimeTimingSnapshot();
  const observations = useRuntimeObservationSnapshot();
  const resources = useRuntimeResourceEvidenceSnapshot();
  const selected = useRuntimeTraceSelectionSnapshot().selections.find((entry) => entry.channel === channel(panel));
  const recent = useMemo(() => runtimeEventRows(timing.completed).slice(0, 12), [timing.completed]);
  const statistics = useMemo(() => runtimeTimingStatistics(timing.completed), [timing.completed]);
  useEffect(() => {
    const lease = semanticPublisher.publish(() => createStatusProjection(timing.completed.length ? "Measurements recorded" : "No timing traces", `${timing.completed.length} retained traces, ${timing.aggregates.length} aggregate groups, ${observations.observations.length} observation edges, and ${resources.claims.length} explicit byte claims.`));
    return () => lease.release();
  }, [timing, observations, resources, semanticPublisher]);
  return <section className="panel-body runtime-diagnostics">
    <PanelIntro title="Runtime Diagnostics">Runtime-owned timing and registered evidence. Byte claims describe known application allocations, not physical process RAM.</PanelIntro>
    <div className="runtime-diagnostics__toolbar"><span>Runtime revision {timing.revision}</span><ChannelControl panel={panel} updatePanelState={updatePanelState} /></div>
    <div className="runtime-diagnostics__summary">
      <Metric label="Retained traces" value={String(timing.completed.length)} /><Metric label="Aggregate groups" value={String(timing.aggregates.length)} /><Metric label="Observation edges" value={observations.observations.length ? String(observations.observations.length) : "None"} /><Metric label="Byte claims" value={resources.claims.length ? String(resources.claims.length) : "None"} />
    </div>
    <div className="runtime-diagnostics__dashboard-row"><Section title="Operational Statistics" count="by timing category"><div className="runtime-diagnostics__stats">{statistics.map((item) => <article className="runtime-diagnostics__stat-card" key={item.category}><header><strong className={`runtime-diagnostics__category runtime-diagnostics__category--${item.category}`}>{item.category}</strong><span>{item.count} measured</span></header><div className="runtime-diagnostics__stat-values"><StatValue label="Minimum" value={duration(item.minimum)} /><StatValue label="Average" value={duration(item.average)} /><StatValue label="Maximum" value={duration(item.maximum)} /></div></article>)}{!statistics.length && <Empty>No completed duration measurements are available.</Empty>}</div></Section>
      <Section title="Operation Statistics" count={`${timing.aggregates.length} genuine groups`}>{timing.aggregates.length ? <AggregateTable aggregates={timing.aggregates} selected={selected} onSelect={(item) => select(runtime, panel, "aggregate", item.key)} /> : <Empty>Aggregate statistics appear after measurable operations complete.</Empty>}</Section></div>
    <Section title="Recent Operations" count={`latest ${recent.length} of ${timing.completed.length}`}>{recent.length ? <TimingTable rows={recent} selected={selected} onSelect={(trace) => select(runtime, panel, "trace", String(trace.id))} /> : <Empty>No timing traces have been recorded.</Empty>}</Section>
    <div className="runtime-diagnostics__evidence-grid"><Section title="Registered Observations" count={`${observations.observations.length} edges`}>{observations.observations.length ? observations.observations.map((edge) => <div className="runtime-diagnostics__evidence-row" key={`${edge.observer.id}/${edge.resource.kind}/${edge.resource.key}`}><strong>{edge.observer.kind} · {edge.observer.id}</strong><span>{edge.resource.kind} · {edge.resource.key}</span><small>{edge.count} active reference{edge.count === 1 ? "" : "s"}</small></div>) : <Empty>No observation providers have registered evidence.</Empty>}</Section>
      <Section title="Resource Evidence" count={`${resources.claims.length} claims`}>{resources.claims.length ? resources.claims.map((claim) => <div className="runtime-diagnostics__evidence-row" key={`${claim.owner.id}/${claim.resourceClass}/${claim.resourceKey}`}><strong>{claim.resourceClass} · {claim.resourceKey}</strong><span>Owner: {claim.owner.id} · {claim.evidenceKind} bytes: {claim.quantity.toLocaleString()}</span><small>{claim.references > 1 ? `Shared by ${claim.references} active leases` : "One active lease"}</small></div>) : <Empty>No byte claims are registered. Physical process memory usage is unavailable.</Empty>}</Section></div>
  </section>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="runtime-diagnostics__metric"><span>{label}</span><strong>{value}</strong></div>; }
function StatValue({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function sameAggregate(trace: RuntimeTimingTrace, item: RuntimeTimingAggregate) {
  if (trace.category !== item.category) return false;
  if (trace.category === "react-profiler" || trace.category === "panel-render") {
    return trace.metadata?.moduleId === item.metadata?.moduleId && trace.metadata?.panelType === item.metadata?.panelType && trace.metadata?.phase === item.metadata?.phase;
  }
  return trace.label === item.label;
}
function sourceTime(value: number | undefined) { return value === undefined ? "Unavailable" : `${value.toFixed(1)} ms on the Runtime monotonic clock`; }
export function RuntimeInspectorPanel({ panel, updatePanelState, semanticPublisher }: PanelBodyProps) {
  const timing = useRuntimeTimingSnapshot();
  const selected = useRuntimeTraceSelectionSnapshot().selections.find((entry) => entry.channel === channel(panel));
  const trace = selected?.kind === "trace" ? timing.completed.find((item) => String(item.id) === selected.id) : undefined;
  const aggregate = selected?.kind === "aggregate" ? timing.aggregates.find((item) => item.key === selected.id) : undefined;
  const traceAggregate = trace ? timing.aggregates.find((item) => sameAggregate(trace, item)) : undefined;
  useEffect(() => {
    const detail = !selected ? "No Runtime operation is selected." : trace ? `Trace ${trace.id}: ${trace.category} / ${trace.label}` : aggregate ? `Aggregate ${aggregate.category} / ${aggregate.label}` : "The selected relation is absent from current bounded Runtime history.";
    const lease = semanticPublisher.publish(() => createStatusProjection(!selected ? "No selection" : trace || aggregate ? "Selection available" : "Selection unavailable", detail));
    return () => lease.release();
  }, [aggregate, selected, semanticPublisher, trace]);
  return <section className="panel-body runtime-inspector">
    <PanelIntro title="Runtime Inspector">Inspect the selected retained trace or aggregate. Timestamps use the Runtime monotonic clock and are not wall-clock dates.</PanelIntro>
    <div className="runtime-diagnostics__toolbar"><ChannelControl panel={panel} updatePanelState={updatePanelState} />{selected && <span>{selected.kind} · {selected.id}</span>}</div>
    {!selected ? <Empty>Select a trace or aggregate in Runtime Diagnostics or Runtime Events. The Inspector does not choose an operation automatically.</Empty>
      : !trace && !aggregate ? <Empty>The selection is stale: its trace or aggregate has left bounded Runtime history. Choose a current operation to inspect it.</Empty>
      : trace ? <TraceDetail trace={trace} aggregate={traceAggregate} /> : <AggregateDetail aggregate={aggregate!} />}
  </section>;
}
function TraceDetail({ trace, aggregate }: { trace: RuntimeTimingTrace; aggregate?: RuntimeTimingAggregate }) {
  const metadata = Object.entries(trace.metadata ?? {});
  return <>
    <div className="runtime-inspector__hero"><span className={`runtime-diagnostics__category runtime-diagnostics__category--${trace.category}`}>{trace.category}</span><h3>{traceTarget(trace)}</h3><strong>{duration(trace.durationMs)}</strong><span>{tracePhase(trace)} · {trace.label}</span></div>
    <Section title="Trace" count={`sequence #${trace.id}`}><dl className="runtime-inspector__details"><Detail label="Target" value={traceTarget(trace)} /><Detail label="Operation" value={trace.label} /><Detail label="Phase" value={tracePhase(trace)} /><Detail label="Duration" value={duration(trace.durationMs)} /><Detail label="Started" value={sourceTime(trace.startedAt)} /><Detail label="Completed" value={sourceTime(trace.completedAt)} /></dl></Section>
    <Section title="Timing Marks" count={`${trace.marks.length} marks`}>{trace.marks.length ? trace.marks.map((mark, index) => <div className="runtime-diagnostics__evidence-row" key={`${mark.label}/${index}`}><strong>{mark.label}</strong><span>{duration(mark.elapsedMs)} since trace start</span></div>) : <Empty>No timing marks were recorded for this trace.</Empty>}</Section>
    <Section title="Trace Metadata" count={`${metadata.length} fields`}>{metadata.length ? metadata.map(([key, value]) => <div className="runtime-diagnostics__evidence-row" key={key}><strong>{key}</strong><span>{String(value)}</span></div>) : <Empty>No additional trace metadata was recorded.</Empty>}</Section>
    {aggregate && <AggregateDetail aggregate={aggregate} embedded />}
  </>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function AggregateDetail({ aggregate, embedded = false }: { aggregate: RuntimeTimingAggregate; embedded?: boolean }) {
  const row = runtimeAggregateRow(aggregate);
  return <Section title={embedded ? "Aggregate Context" : "Aggregate Statistics"} count={`${row.count} completed`}><div className="runtime-inspector__aggregate-context"><strong>{row.category} · {row.target} · {row.phase}</strong><dl className="runtime-inspector__details"><Detail label="Samples" value={row.count} /><Detail label="Minimum" value={row.minimum} /><Detail label="Average" value={row.average} /><Detail label="Maximum" value={row.maximum} /><Detail label="Latest" value={row.latest} /><Detail label="Observed from" value={sourceTime(aggregate.firstObservedAt)} /><Detail label="Last observed" value={sourceTime(aggregate.lastObservedAt)} /></dl></div></Section>;
}

function emptyState() { return {}; }
function normalize(input: unknown) { return { state: input && typeof input === "object" ? input : {}, repaired: !input || typeof input !== "object", warnings: [] }; }
export function normalizeRuntimeEventsState(input: unknown) {
  const state = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const historyScrollTop = typeof state.historyScrollTop === "number" && Number.isFinite(state.historyScrollTop) ? Math.max(0, state.historyScrollTop) : 0;
  const selectionChannel = typeof state.selectionChannel === "string" && state.selectionChannel.trim() ? state.selectionChannel.trim() : DEFAULT_CHANNEL;
  const normalized = { virtualHistory: state.virtualHistory === true, historyScrollTop, selectionChannel };
  return { state: normalized, repaired: !input || typeof input !== "object" || state.virtualHistory !== normalized.virtualHistory || state.historyScrollTop !== historyScrollTop || state.selectionChannel !== selectionChannel, warnings: [] };
}
export function normalizeRuntimeInspectorState(input: unknown) {
  const value = input && typeof input === "object" ? (input as { selectionChannel?: unknown }).selectionChannel : undefined;
  const state = { selectionChannel: typeof value === "string" && value.trim() ? value.trim() : DEFAULT_CHANNEL };
  return { state, repaired: !input || typeof input !== "object" || value !== state.selectionChannel, warnings: [] };
}
function definition(panelType: string, title: string, Component: PanelDefinition["Component"], width: number): PanelDefinition {
  const normalizeState = panelType === "runtime-events" ? normalizeRuntimeEventsState : panelType === "runtime-inspector" ? normalizeRuntimeInspectorState : normalize;
  return { moduleId: "workspace-diagnostics", panelType, title, description: `${title} for the active Workspace Runtime.`, category: "observability", defaultGeometry: { x: 230, y: 160, width, height: 620 }, minGeometry: { width: 400, height: 320 }, stateVersion: 1, capabilities: { closable: true, resizable: true, movable: true, renameable: false, canBeDirty: false }, createInitialState: emptyState, normalizeState, semanticStrategy: { kind: "dynamic", buildInitial: () => createStatusProjection("Waiting for Runtime data", "Runtime-owned diagnostics will report measurements and registered evidence when available.") }, surfacePresentationMemory: {}, Component };
}
export const runtimePanelDefinitions: PanelDefinition[] = [definition("runtime-diagnostics", "Runtime Diagnostics", RuntimeDiagnosticsPanel, 1000), definition("runtime-events", "Runtime Events", RuntimeEventsPanel, 760), definition("runtime-inspector", "Runtime Inspector", RuntimeInspectorPanel, 520)];
