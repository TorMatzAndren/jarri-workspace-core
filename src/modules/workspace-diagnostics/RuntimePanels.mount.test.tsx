import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkspaceRuntime } from "../../core/workspaceRuntime";
import { WorkspaceRuntimeProvider } from "../../core/workspaceRuntimeReact";
import type { PanelBodyProps } from "../../core/types";
import { runtimePanelDefinitions } from "./RuntimePanels";

const runtime = createWorkspaceRuntime();
const props = {
  panel: { id: "runtime-panel-test", moduleId: "workspace-diagnostics", panelType: "runtime-diagnostics", title: "Runtime Diagnostics", panelState: {} },
  updatePanelState() {},
} as unknown as PanelBodyProps;

runtime.timing.record("react-profiler", "core:calendar", { durationMs: 4.25, startedAt: 20, completedAt: 24.25, metadata: { moduleId: "core", panelType: "calendar", phase: "mount", actualDurationMs: 4.25, baseDurationMs: 5.1 } });
const render = (index: number, panelProps = props) => renderToStaticMarkup(createElement(
  WorkspaceRuntimeProvider,
  { runtime },
  createElement(runtimePanelDefinitions[index].Component, panelProps),
));

for (const [index, expected] of [
  [0, "Runtime Diagnostics"], [1, "Runtime Events"], [2, "Runtime Inspector"],
] as const) {
  if (!render(index).includes(expected)) throw new Error(`${expected} failed to render under the Workspace Runtime provider.`);
}
const diagnostics = render(0);
for (const field of ["Operational Statistics", "Operation Statistics", "Recent Operations", "Sequence", "Category", "Target", "Phase", "Duration", "core / calendar", "mount", "4.3 ms"]) {
  if (!diagnostics.includes(field)) throw new Error(`Runtime Diagnostics is missing its measured presentation field: ${field}`);
}
const eventsProps = { ...props, panel: { ...props.panel, panelType: "runtime-events" } };
const normalEvents = render(1, eventsProps);
const virtualEvents = render(1, { ...eventsProps, panel: { ...props.panel, panelType: "runtime-events", panelState: { virtualHistory: true } } });
for (const field of ["Sequence", "Category", "Target", "Phase", "Duration", "core / calendar", "mount", "4.3 ms"]) {
  if (!normalEvents.includes(field)) throw new Error(`Runtime Events normal mode is missing shared aligned table content: ${field}`);
}
if (normalEvents.includes("runtime-diagnostics__virtual") || !virtualEvents.includes("runtime-diagnostics__virtual")) throw new Error("Runtime Events virtualization must remain opt-in and preserve the normal rendering path.");
for (const heading of ["Sequence", "Category", "Target", "Phase", "Duration"]) {
  if (normalEvents.indexOf(heading) < 0 || virtualEvents.indexOf(heading) < 0) throw new Error(`Both history modes must render the same table column: ${heading}`);
}

const inspectorEmpty = render(2, { ...props, panel: { ...props.panel, panelType: "runtime-inspector" } });
if (!inspectorEmpty.includes("does not choose an operation automatically")) throw new Error("Runtime Inspector must explain the no-selection state without auto-selecting a trace.");
runtime.traceSelection.select("runtime-primary", "trace", "1");
const inspectorTrace = render(2, { ...props, panel: { ...props.panel, panelType: "runtime-inspector" } });
for (const field of ["Timing Marks", "Trace Metadata", "Aggregate Context", "Started", "Completed", "baseDurationMs", "5.1"]) {
  if (!inspectorTrace.includes(field)) throw new Error(`Runtime Inspector omitted structured trace context: ${field}`);
}
runtime.traceSelection.select("runtime-primary", "trace", "999");
const staleMarkup = render(2, { ...props, panel: { ...props.panel, panelType: "runtime-inspector" } });
if (!staleMarkup.includes("selection is stale")) throw new Error("Runtime Inspector must render stale linked selections safely.");
runtime.dispose();
console.log("Runtime panel provider and structured presentation tests passed.");
