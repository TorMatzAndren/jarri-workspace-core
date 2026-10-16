import { invoke } from "@tauri-apps/api/core";
import type { DeveloperStatus } from "./developerStatus";

/** Reads the local, read-only status exposed by Core's Rust backend. */
export function getDeveloperStatus(): Promise<DeveloperStatus> {
  return invoke<DeveloperStatus>("developer_status");
}

let initialDeveloperStatus: Promise<DeveloperStatus> | null = null;

/** Shares the one-time local status read between shell indicators and Settings. */
export function getInitialDeveloperStatus(): Promise<DeveloperStatus> {
  initialDeveloperStatus ??= getDeveloperStatus();
  return initialDeveloperStatus;
}
