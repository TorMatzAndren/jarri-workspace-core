import { bootstrapWorkspaceRuntime } from "../bootstrap/workspaceRuntime";
import {
  dynamicSemantic,
  isPanelSemanticCopyAvailable,
  isPanelSemanticStrategyComplete,
  panelSummarySemantic,
  pendingSemantic,
  unavailableSemantic,
} from "./panelSemantics";
import {
  createErrorProjection,
  type WorkspaceProjectionDocument,
} from "./projection";
import type { PanelInstance, PanelSemanticStrategy } from "./types";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

const panel: PanelInstance = {
  id: "panel-1",
  moduleId: "demo",
  panelType: "timeline",
  title: "Timeline Demo",
  geometry: { x: 0, y: 0, width: 400, height: 240 },
  focusOrder: 1,
  stateVersion: 1,
  panelState: { selectedEntryId: "inspect" },
  createdAt: "now",
  updatedAt: "now",
};

const context = {
  panel,
  moduleTitle: "Demo Panels",
  moduleId: "demo",
  panelType: "timeline",
  panelTitle: "Timeline Demo",
};

function itemValue(projection: WorkspaceProjectionDocument, label: string) {
  const item = projection.sections[0]?.items.find((entry) => entry.label === label);
  return item?.value;
}

function buildInitial(strategy: PanelSemanticStrategy) {
  if (strategy.kind === "pending") {
    throw new Error("Pending strategy has no semantic projection.");
  }
  return strategy.buildInitial(context);
}

function testSemanticKindsRemainDistinct() {
  const staticStrategy = panelSummarySemantic("Ready", "Static content");
  const dynamicStrategy = dynamicSemantic(() => ({
    sections: [
      {
        title: "State",
        items: [{ label: "Status", value: "Loading" }],
      },
    ],
  }));
  const unavailableStrategy = unavailableSemantic("Missing", "Restore module.");
  const pendingStrategy = pendingSemantic("Substantive projection is not migrated.");

  assertEqual(staticStrategy.kind, "static", "static strategy kind");
  assertEqual(dynamicStrategy.kind, "dynamic", "dynamic strategy kind");
  assertEqual(unavailableStrategy.kind, "unavailable", "unavailable strategy kind");
  assertEqual(pendingStrategy.kind, "pending", "pending strategy kind");
  assertEqual(
    "buildInitial" in pendingStrategy,
    false,
    "pending strategy cannot build placeholder semantic output",
  );
}

function testSemanticCopyAvailabilityIsLocalToStrategy() {
  assertEqual(
    isPanelSemanticCopyAvailable(panelSummarySemantic("Ready", "Content")),
    true,
    "static strategy enables Copy",
  );
  assertEqual(
    isPanelSemanticCopyAvailable(dynamicSemantic(() => ({ sections: [] }))),
    true,
    "dynamic strategy enables Copy",
  );
  assertEqual(
    isPanelSemanticCopyAvailable(unavailableSemantic("Missing", "Restore")),
    true,
    "genuine unavailable strategy enables Copy",
  );
  assertEqual(
    isPanelSemanticCopyAvailable(pendingSemantic("Not migrated")),
    false,
    "pending strategy disables only that panel Copy",
  );
}

function testProjectionDocuments() {
  const ready = buildInitial(panelSummarySemantic("Ready", "Static content"));
  const unavailable = buildInitial(unavailableSemantic("Missing", "Restore"));
  const error = createErrorProjection("Render failed");

  assertEqual(itemValue(ready, "Status"), "Ready", "static status");
  assertEqual(
    itemValue(unavailable, "Status"),
    "Unavailable",
    "unavailable status",
  );
  assertEqual(itemValue(error, "Status"), "Error", "error status");
}

function testRegisteredCorePanelsAreSemanticallyComplete() {
  const runtime = bootstrapWorkspaceRuntime();
  const incomplete = runtime.registry
    .listPanels()
    .filter((definition) => !isPanelSemanticStrategyComplete(definition.semanticStrategy))
    .map((definition) => `${definition.moduleId}:${definition.panelType}`);

  assertEqual(incomplete.join(","), "", "every registered Core panel is complete");
}

function main() {
  testSemanticKindsRemainDistinct();
  testSemanticCopyAvailabilityIsLocalToStrategy();
  testProjectionDocuments();
  testRegisteredCorePanelsAreSemanticallyComplete();
  console.log("panel semantic contract tests passed");
}

main();
