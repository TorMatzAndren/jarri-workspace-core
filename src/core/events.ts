import type { PanelGeometry } from "./types";

export type WorkspaceEventCategory =
  | "layout"
  | "panel-lifecycle"
  | "panel-state"
  | "domain-truth"
  | "advisory"
  | "preflight"
  | "temporal"
  | "diagnostics";

export type LayoutEvent =
  | { category: "layout"; type: "geometry-previewed"; panelId: string; geometry: PanelGeometry }
  | { category: "layout"; type: "geometry-committed"; panelId: string; geometry: PanelGeometry }
  | { category: "layout"; type: "layout-reset" };

export type PanelLifecycleEvent =
  | { category: "panel-lifecycle"; type: "panel-created"; panelId: string }
  | { category: "panel-lifecycle"; type: "panel-focused"; panelId: string }
  | { category: "panel-lifecycle"; type: "panel-closed"; panelId: string };

export type PanelStateEvent = {
  category: "panel-state";
  type: "panel-state-updated";
  panelId: string;
};

export type DomainTruthEvent = {
  category: "domain-truth";
  type: "truth-refreshed" | "truth-invalidated";
  providerId: string;
};

export type AdvisoryEvent = {
  category: "advisory";
  type: "advisory-appended" | "advisory-cleared";
  source: string;
};

export type PreflightEvent = {
  category: "preflight";
  type: "preflight-requested" | "preflight-approved" | "preflight-rejected";
  actionId: string;
};

export type TemporalEvent = {
  category: "temporal";
  type: "temporal-cursor-changed" | "temporal-range-changed";
  scopeId: string;
};

export type DiagnosticsEvent = {
  category: "diagnostics";
  type: "layout-repaired" | "persistence-failed" | "module-missing";
  message: string;
};

export type WorkspaceEvent =
  | LayoutEvent
  | PanelLifecycleEvent
  | PanelStateEvent
  | DomainTruthEvent
  | AdvisoryEvent
  | PreflightEvent
  | TemporalEvent
  | DiagnosticsEvent;

export function createWorkspaceEvent<T extends WorkspaceEvent>(event: T): T {
  return event;
}

