import {
  runtimePanelDefinitions,
  normalizeRuntimeEventsState,
  normalizeRuntimeInspectorState,
  runtimeEventRows,
  runtimeEventVirtualizationEnabled,
  runtimeTraceRow,
  runtimeAggregateRow,
  runtimeTimingStatistics,
} from "./RuntimePanels";
import { coreModule } from "../../panels/corePanels";
import { workspaceDiagnosticsModule } from "./index";
import type { RuntimeTimingAggregate, RuntimeTimingTrace } from "../../core/runtimeTiming";

const identities = runtimePanelDefinitions.map(({ moduleId, panelType }) => `${moduleId}/${panelType}`).join(",");
if (identities !== "workspace-diagnostics/runtime-diagnostics,workspace-diagnostics/runtime-events,workspace-diagnostics/runtime-inspector") throw new Error(`Unexpected Runtime panel identities: ${identities}`);
if (!runtimePanelDefinitions.every((panel) => panel.semanticStrategy.kind === "static" || panel.semanticStrategy.kind === "dynamic")) throw new Error("Runtime panels must publish usable semantic strategies");
if (coreModule.panels.some(({ panelType }) => panelType.startsWith("runtime-"))) throw new Error("Runtime diagnostics panels must not be registered inside Workspace Core.");
if (workspaceDiagnosticsModule.moduleId !== "workspace-diagnostics" || workspaceDiagnosticsModule.title !== "Workspace Diagnostics" || workspaceDiagnosticsModule.panels !== runtimePanelDefinitions) throw new Error("Workspace Diagnostics must own and expose its first-party Runtime panels.");
if (!runtimePanelDefinitions.every(({ category }) => category === "observability")) throw new Error("Workspace Diagnostics panels must use their observability catalogue category.");
const events = normalizeRuntimeEventsState({ virtualHistory: true, historyScrollTop: 72, selectionChannel: "runtime-primary" });
if (!events.state.virtualHistory || events.state.historyScrollTop !== 72 || events.repaired) throw new Error("Runtime Events presentation state must persist cleanly");
const repaired = normalizeRuntimeEventsState({ virtualHistory: "yes", historyScrollTop: -2 });
if (repaired.state.virtualHistory || repaired.state.historyScrollTop !== 0 || !repaired.repaired) throw new Error("Invalid Runtime Events state must repair safely");
const inspector = normalizeRuntimeInspectorState({ selectionChannel: "secondary" });
if (inspector.state.selectionChannel !== "secondary") throw new Error("Inspector must retain its independent selection channel");
if (normalizeRuntimeEventsState({ virtualHistory: true }).state.virtualHistory !== true) throw new Error("Virtual mode is opt-in and must persist in panel state");
const traces: RuntimeTimingTrace[] = [
  { id: 7, category: "react-profiler", label: "core:calendar", startedAt: 10, completedAt: 13.25, durationMs: 3.25, marks: [], metadata: { moduleId: "core", panelType: "calendar", phase: "mount" } },
  { id: 8, category: "react-profiler", label: "core:calendar", startedAt: 15, completedAt: 16, durationMs: 1, marks: [], metadata: { moduleId: "core", panelType: "calendar", phase: "update" } },
  { id: 9, category: "panel-lifecycle", label: "reconcile", startedAt: 20, completedAt: 25, durationMs: 5, marks: [], metadata: { outcome: "committed" } },
];
if (runtimeEventRows(traces).map(({ id }) => id).join(",") !== "9,8,7") throw new Error("normal event history must be newest-first");
if (runtimeEventVirtualizationEnabled({}) || !runtimeEventVirtualizationEnabled({ virtualHistory: true })) throw new Error("event history virtualization must remain explicit opt-in");
const profilerMount = runtimeTraceRow(traces[0]);
const profilerUpdate = runtimeTraceRow(traces[1]);
if (profilerMount.target !== "core / calendar" || profilerMount.phase !== "mount" || profilerUpdate.phase !== "update") throw new Error("Profiler module, panel, and phase must be visible and distinguish groups");
const lifecycle = runtimeTraceRow(traces[2]);
if (lifecycle.sequence !== "#9" || lifecycle.target !== "reconcile" || lifecycle.phase !== "committed" || lifecycle.duration !== "5.0 ms") throw new Error("Trace table must expose aligned sequence, target, phase, and measured duration values");
const stats = runtimeTimingStatistics(traces);
if (stats.length !== 2 || stats.find(({ category }) => category === "react-profiler")?.count !== 2) throw new Error("Operational statistics must group real retained measurements by timing category");
const aggregate: RuntimeTimingAggregate = { key: "react-profiler|core|calendar|mount", category: "react-profiler", label: "core:calendar", count: 4, totalMs: 18, minimumMs: 2, averageMs: 4.5, maximumMs: 9, lastMs: 3, firstObservedAt: 10, lastObservedAt: 30, metadata: { moduleId: "core", panelType: "calendar", phase: "mount" } };
const aggregateRow = runtimeAggregateRow(aggregate);
if (aggregateRow.target !== "core / calendar" || aggregateRow.phase !== "mount" || aggregateRow.count !== "4" || aggregateRow.minimum !== "2.0 ms" || aggregateRow.average !== "4.5 ms" || aggregateRow.maximum !== "9.0 ms" || aggregateRow.latest !== "3.0 ms") throw new Error("Aggregate presentation must retain category, target, phase, count, minimum, average, maximum, and latest");
console.log("Runtime panel identity, state, and presentation tests passed.");
