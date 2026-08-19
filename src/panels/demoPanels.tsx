import { useEffect } from "react";
import {
  dynamicSemantic,
  staticSemantic,
} from "../core/panelSemantics";
import type { PanelBodyProps, PanelDefinition } from "../core/types";

type TimelineState = {
  selectedEntryId: string;
};

type AdvisoryLogState = {
  entries: Array<{
    id: string;
    timestamp: string;
    source: string;
    message: string;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function TruthDemoPanel() {
  const truthRows = [
    { label: "Runtime truth", value: "domain service owned" },
    { label: "Layout", value: "user preference" },
    { label: "Schema", value: "versioned + repairable" },
    { label: "Preflight", value: "required for risky action" },
  ];

  return (
    <div className="panel-body panel-body--truth">
      <div className="truth-grid">
        {truthRows.map((row) => (
          <div className="truth-tile" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      <section className="doctrine-strip">
        <strong>Projection Doctrine</strong>
        <p>
          This panel renders a truth snapshot shape, but stores no canonical
          runtime truth in layout state.
        </p>
      </section>
    </div>
  );
}

const timelineEntries = [
  {
    id: "inspect",
    label: "Investigate",
    time: "T-03",
    detail: "Collect source-system evidence before creating abstractions.",
  },
  {
    id: "implement",
    label: "Implement",
    time: "T-02",
    detail: "Build the smallest reusable substrate that satisfies contracts.",
  },
  {
    id: "verify",
    label: "Verify",
    time: "T-01",
    detail: "Run build/typecheck and check the generated file boundary.",
  },
  {
    id: "document",
    label: "Document",
    time: "T",
    detail: "Keep design decisions inspectable and versioned.",
  },
];

export function TimelineDemoPanel({
  panel,
  updatePanelState,
  semanticPublisher,
}: {
  panel: { panelState: unknown };
  updatePanelState: (panelState: unknown) => void;
  semanticPublisher: PanelBodyProps["semanticPublisher"];
}) {
  const state = normalizeTimelineState(panel.panelState);
  const selected =
    timelineEntries.find((entry) => entry.id === state.selectedEntryId) ??
    timelineEntries[0];

  useEffect(() => {
    const lease = semanticPublisher.publish(() =>
      createTimelineProjection(state.selectedEntryId),
    );
    return () => lease.release();
  }, [semanticPublisher, state.selectedEntryId]);

  return (
    <div className="panel-body timeline-demo">
      <div className="timeline-list">
        {timelineEntries.map((entry) => (
          <button
            className={`timeline-entry ${
              entry.id === selected.id ? "timeline-entry--selected" : ""
            }`}
            key={entry.id}
            type="button"
            onClick={() => updatePanelState({ selectedEntryId: entry.id })}
          >
            <span>{entry.time}</span>
            <strong>{entry.label}</strong>
          </button>
        ))}
      </div>
      <section className="timeline-detail">
        <span>Replay Cursor</span>
        <strong>{selected.label}</strong>
        <p>{selected.detail}</p>
      </section>
    </div>
  );
}

export function AdvisoryLogDemoPanel({
  panel,
  updatePanelState,
  semanticPublisher,
}: {
  panel: { panelState: unknown };
  updatePanelState: (panelState: unknown) => void;
  semanticPublisher: PanelBodyProps["semanticPublisher"];
}) {
  const state = normalizeAdvisoryLogState(panel.panelState);

  useEffect(() => {
    const lease = semanticPublisher.publish(() =>
      createAdvisoryProjection(state),
    );
    return () => lease.release();
  }, [panel.panelState, semanticPublisher]);

  function appendEntry() {
    updatePanelState({
      entries: [
        {
          id: `advisory-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          source: "demo-advisory",
          message: "Advisory output is explainable context, not source truth.",
        },
        ...state.entries,
      ].slice(0, 8),
    });
  }

  return (
    <div className="panel-body advisory-demo">
      <div className="advisory-toolbar">
        <div>
          <strong>Advisory Log</strong>
          <span>LLM/tool output remains separate from truth.</span>
        </div>
        <button type="button" onClick={appendEntry}>
          Add Entry
        </button>
      </div>
      <div className="advisory-list">
        {state.entries.map((entry) => (
          <article className="advisory-entry" key={entry.id}>
            <div>
              <strong>{entry.source}</strong>
              <span>{entry.timestamp}</span>
            </div>
            <p>{entry.message}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function normalizeTimelineState(input: unknown): TimelineState {
  if (!isRecord(input) || typeof input.selectedEntryId !== "string") {
    return { selectedEntryId: "inspect" };
  }

  return {
    selectedEntryId: timelineEntries.some((entry) => entry.id === input.selectedEntryId)
      ? input.selectedEntryId
      : "inspect",
  };
}

function normalizeAdvisoryLogState(input: unknown): AdvisoryLogState {
  if (!isRecord(input) || !Array.isArray(input.entries)) {
    return {
      entries: [
        {
          id: "advisory-seed",
          timestamp: "seed",
          source: "workspace-core",
          message: "This log is advisory. Actions still require domain truth.",
        },
      ],
    };
  }

  return {
    entries: input.entries
      .filter(isRecord)
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : `entry-${Date.now()}`,
        timestamp: typeof entry.timestamp === "string" ? entry.timestamp : "unknown",
        source: typeof entry.source === "string" ? entry.source : "unknown",
        message: typeof entry.message === "string" ? entry.message : "",
      }))
      .filter((entry) => entry.message.trim())
      .slice(0, 8),
  };
}

function createTruthProjection() {
  return {
    sections: [
      {
        title: "Truth Demo",
        items: [
          { label: "Runtime truth", value: "domain service owned" },
          { label: "Layout", value: "user preference" },
          { label: "Schema", value: "versioned and repairable" },
          { label: "Preflight", value: "required for risky action" },
        ],
      },
    ],
  };
}

function createTimelineProjection(selectedEntryId: string) {
  const selected =
    timelineEntries.find((entry) => entry.id === selectedEntryId) ??
    timelineEntries[0];

  return {
    sections: [
      {
        title: "Replay Cursor",
        items: [
          { label: "Selected", value: selected.label },
          { label: "Time", value: selected.time },
          { label: "Detail", value: selected.detail },
        ],
      },
      {
        title: "Timeline",
        items: timelineEntries.map((entry) => ({
          label: entry.time,
          value: `${entry.label}${entry.id === selected.id ? " (selected)" : ""}`,
        })),
      },
    ],
  };
}

function createAdvisoryProjection(state: AdvisoryLogState) {
  return {
    sections: [
      {
        title: "Advisory Log",
        items: [
          { label: "Entries", value: state.entries.length },
          {
            label: "Newest source",
            value: state.entries[0]?.source ?? "none",
          },
          {
            label: "Newest message",
            value: state.entries[0]?.message ?? "none",
          },
        ],
      },
      {
        title: "Visible Entries",
        items: state.entries.map((entry) => ({
          label: `${entry.timestamp} ${entry.source}`,
          value: entry.message,
        })),
      },
    ],
  };
}

export const demoPanelDefinitions: PanelDefinition[] = [
  {
    moduleId: "demo",
    panelType: "truth",
    title: "Truth Demo",
    description: "Truth-first panel projection without persisted runtime truth.",
    category: "domain",
    defaultGeometry: { x: 24, y: 24, width: 528, height: 300 },
    minGeometry: { width: 348, height: 228 },
    stateVersion: 1,
    capabilities: {
      closable: true,
      resizable: true,
      movable: true,
      renameable: false,
      canBeDirty: false,
      usesTruthProvider: "demo.truth",
    },
    createInitialState: () => ({}),
    normalizeState: () => ({ state: {}, repaired: false, warnings: [] }),
    semanticStrategy: staticSemantic(createTruthProjection),
    Component: TruthDemoPanel,
  },
  {
    moduleId: "demo",
    panelType: "timeline",
    title: "Timeline Demo",
    description: "Temporal/replay primitive boundary demo.",
    category: "temporal",
    defaultGeometry: { x: 576, y: 24, width: 564, height: 360 },
    minGeometry: { width: 360, height: 240 },
    stateVersion: 1,
    capabilities: {
      closable: true,
      resizable: true,
      movable: true,
      renameable: false,
      canBeDirty: false,
      usesTemporalProvider: "demo.timeline",
    },
    createInitialState: () => ({ selectedEntryId: "inspect" }),
    normalizeState: (input) => ({
      state: normalizeTimelineState(input),
      repaired: false,
      warnings: [],
    }),
    semanticStrategy: dynamicSemantic(({ panel }) =>
      createTimelineProjection(
        normalizeTimelineState(panel.panelState).selectedEntryId,
      ),
    ),
    Component: TimelineDemoPanel,
  },
  {
    moduleId: "demo",
    panelType: "advisory-log",
    title: "Advisory Log Demo",
    description: "Advisory output separated from source truth.",
    category: "advisory",
    defaultGeometry: { x: 156, y: 408, width: 720, height: 324 },
    minGeometry: { width: 384, height: 240 },
    stateVersion: 1,
    capabilities: {
      closable: true,
      resizable: true,
      movable: true,
      renameable: false,
      canBeDirty: false,
      usesAdvisoryProvider: "demo.advisory",
    },
    createInitialState: () => normalizeAdvisoryLogState(null),
    normalizeState: (input) => ({
      state: normalizeAdvisoryLogState(input),
      repaired: false,
      warnings: [],
    }),
    semanticStrategy: dynamicSemantic(({ panel }) =>
      createAdvisoryProjection(normalizeAdvisoryLogState(panel.panelState)),
    ),
    Component: AdvisoryLogDemoPanel,
  },
];
