import {
  createStatusProjection,
  createUnavailableProjection,
  type WorkspaceProjectionDocument,
} from "./projection";
import type { PanelSemanticContext, PanelSemanticStrategy } from "./types";

export function isPanelSemanticStrategyComplete(
  strategy: PanelSemanticStrategy,
): boolean {
  return strategy.kind !== "pending";
}

export function isPanelSemanticCopyAvailable(
  strategy: PanelSemanticStrategy | null | undefined,
): boolean {
  return !!strategy && strategy.kind !== "pending";
}

export function staticSemantic(
  buildInitial: (context: PanelSemanticContext) => WorkspaceProjectionDocument,
): PanelSemanticStrategy {
  return { kind: "static", buildInitial };
}

export function dynamicSemantic(
  buildInitial: (context: PanelSemanticContext) => WorkspaceProjectionDocument,
): PanelSemanticStrategy {
  return { kind: "dynamic", buildInitial };
}

export function unavailableSemantic(
  reason: string,
  recovery: string,
): PanelSemanticStrategy {
  return {
    kind: "unavailable",
    buildInitial: () => createUnavailableProjection(reason, recovery),
  };
}

export function pendingSemantic(reason: string): PanelSemanticStrategy {
  return { kind: "pending", reason };
}

export function loadingSemantic(detail: string): PanelSemanticStrategy {
  return dynamicSemantic(() => createStatusProjection("Loading", detail));
}

export function panelSummarySemantic(
  status: string,
  detail: string,
): PanelSemanticStrategy {
  return staticSemantic(() => createStatusProjection(status, detail));
}
