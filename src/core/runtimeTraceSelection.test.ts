import { createRuntimeTraceSelection } from "./runtimeTraceSelection";

const selection = createRuntimeTraceSelection();
selection.select("primary", "trace", "1");
selection.select("secondary", "aggregate", "render|core|calendar|update");
if (selection.getSnapshot().selections.length !== 2) throw new Error("selection channels remain independent");
selection.clear("primary");
if (selection.getSnapshot().selections[0]?.channel !== "secondary") throw new Error("clearing one channel preserves another");
selection.dispose();
selection.select("primary", "trace", "2");
if (selection.getSnapshot().selections.length !== 0) throw new Error("disposed selection rejects stale writes");
console.log("Runtime trace selection tests passed.");
