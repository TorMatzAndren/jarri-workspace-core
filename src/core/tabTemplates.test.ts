import {
  createTemplateFromTab,
  normalizeTemplateDocument,
  tabFromTemplate,
} from "./tabTemplates";
import { createPanelRegistry } from "./panelRegistry";
import type { WorkspaceTab } from "./types";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function testTemplateCapturesAndRestoresOriginAwareCanvasBounds() {
  const tab: WorkspaceTab = {
    id: "tab-source",
    title: "Large Workspace",
    canvasBounds: {
      x: -240,
      y: -120,
      width: 5016,
      height: 3792,
    },
    canvasScale: 1.4,
    canvasCamera: {
      x: 640,
      y: 320,
    },
    panels: [],
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
  };

  const template = createTemplateFromTab(tab);

  assertEqual(template.canvasBounds.x, -240, "Template captures tab canvas x");
  assertEqual(template.canvasBounds.y, -120, "Template captures tab canvas y");
  assertEqual(
    template.canvasBounds.width,
    5016,
    "Template captures tab canvas width",
  );
  assertEqual(
    template.canvasBounds.height,
    3792,
    "Template captures tab canvas height",
  );

  const restored = tabFromTemplate(template, createPanelRegistry());

  assertEqual(restored.canvasBounds.x, -240, "Tab restored from template preserves canvas x");
  assertEqual(restored.canvasBounds.y, -120, "Tab restored from template preserves canvas y");
  assertEqual(
    restored.canvasBounds.width,
    5016,
    "Tab restored from template preserves canvas width",
  );
  assertEqual(
    restored.canvasBounds.height,
    3792,
    "Tab restored from template preserves canvas height",
  );
  assertEqual(restored.canvasScale, 1, "Tab restored from template starts at scale 1");
  assertEqual(
    restored.canvasCamera.x,
    -240,
    "Tab restored from template starts at canvas x",
  );
  assertEqual(
    restored.canvasCamera.y,
    -120,
    "Tab restored from template starts at canvas y",
  );
}

function testTemplateBoundsPreserveNegativeOriginAndExpandAroundPanels() {
  const document = normalizeTemplateDocument({
    kind: "jarri.workspace.tabs",
    schemaVersion: 1,
    exportedAt: "2026-08-16T00:00:00.000Z",
    templates: [
      {
        id: "legacy-template",
        title: "Legacy",
        sourceTitle: "Legacy",
        canvasBounds: {
          x: -240,
          y: -120,
          width: 1800,
          height: 1100,
        },
        panels: [
          {
            moduleId: "missing",
            panelType: "missing",
            title: "Far Panel",
            geometry: {
              x: 1900,
              y: 1200,
              width: 300,
              height: 200,
            },
          },
        ],
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
      },
    ],
  });

  const template = document.templates[0];

  assertEqual(template.canvasBounds.x, -240, "Template preserves negative x origin");
  assertEqual(template.canvasBounds.y, -120, "Template preserves negative y origin");
  assertEqual(
    template.canvasBounds.width,
    2484,
    "Template width expands from negative origin around right panel extent",
  );
  assertEqual(
    template.canvasBounds.height,
    1572,
    "Template height expands from negative origin around bottom panel extent",
  );
}

testTemplateCapturesAndRestoresOriginAwareCanvasBounds();
testTemplateBoundsPreserveNegativeOriginAndExpandAroundPanels();

console.log("Workspace tab-template canvas tests passed.");
