import { invoke } from "@tauri-apps/api/core";

export type WorkspaceNativeWindowIdentity = {
  backend: string;
  windowId: string;
};

export type WorkspaceNativeSurfaceClip = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkspaceNativeSurfaceGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;

  /*
   * Legacy/single-region clip.
   *
   * Keep this field because the generic native-surface
   * contract predates panel occlusion.
   */
  visibleClip?: WorkspaceNativeSurfaceClip;

  /*
   * Zero or more absolute physical-pixel regions which
   * remain visible after Workspace panel occlusion.
   *
   * When present, this is authoritative over visibleClip.
   */
  visibleClips?: WorkspaceNativeSurfaceClip[];
};

export type WorkspaceNativeSurface = {
  surfaceId: string;
  width: number;
  height: number;
};

export type WorkspaceNativeSurfaceAdoption = {
  surfaceId: string;
  windowId: string;
};

export function loadWorkspaceNativeWindowIdentity(): Promise<WorkspaceNativeWindowIdentity> {
  return invoke<WorkspaceNativeWindowIdentity>(
    "workspace_native_window_identity",
  );
}

export function createWorkspaceNativeSurface(
  geometry: WorkspaceNativeSurfaceGeometry,
): Promise<WorkspaceNativeSurface> {
  return invoke<WorkspaceNativeSurface>("workspace_native_surface_create", {
    geometry,
  });
}

export function ensureWorkspaceNativeSurfaceForPanel(
  panelId: string,
  geometry: WorkspaceNativeSurfaceGeometry,
): Promise<WorkspaceNativeSurface> {
  return invoke<WorkspaceNativeSurface>(
    "workspace_native_surface_ensure_for_panel",
    {
      panelId,
      geometry,
    },
  );
}

export function updateWorkspaceNativeSurface(
  surfaceId: string,
  geometry: WorkspaceNativeSurfaceGeometry,
): Promise<void> {
  return invoke<void>("workspace_native_surface_update", {
    surfaceId,
    geometry,
  });
}

export function setWorkspaceNativeSurfaceVisible(
  surfaceId: string,
  visible: boolean,
): Promise<void> {
  return invoke<void>("workspace_native_surface_set_visible", {
    surfaceId,
    visible,
  });
}

export function adoptWorkspaceX11Window(
  surfaceId: string,
  windowId: string,
): Promise<WorkspaceNativeSurfaceAdoption> {
  return invoke<WorkspaceNativeSurfaceAdoption>(
    "workspace_native_surface_adopt_x11_window",
    {
      surfaceId,
      windowId,
    },
  );
}

export function releaseWorkspaceX11Window(surfaceId: string): Promise<void> {
  return invoke<void>("workspace_native_surface_release_x11_window", {
    surfaceId,
  });
}

export function destroyWorkspaceNativeSurface(
  surfaceId: string,
): Promise<void> {
  return invoke<void>("workspace_native_surface_destroy", { surfaceId });
}

export function reconcileWorkspaceNativeSurfacePanels(
  panelIds: string[],
): Promise<void> {
  return invoke<void>("workspace_native_surface_reconcile_panels", {
    panelIds,
  });
}
