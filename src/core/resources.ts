export type ResourceUri = string & { readonly __resourceUri: unique symbol };

export type ResourceOpenDisposition = "reuse" | "new-panel" | "preview";

export type OpenResourceRequest = {
  uri: ResourceUri;
  label?: string;
  preferredModuleId?: string;
  preferredPanelType?: string;
  disposition?: ResourceOpenDisposition;
  sourcePanelId?: string;
};

export type OpenResourceResult =
  | { ok: true; panelId?: string }
  | { ok: false; error: string };

export function filePathToResourceUri(path: string): ResourceUri {
  const cleaned = path.trim();
  if (!cleaned.startsWith("/")) {
    throw new Error("File resource paths must be absolute.");
  }

  return `file://${encodeURI(cleaned)}` as ResourceUri;
}

export function resourceUriToFilePath(uri: ResourceUri | string): string | null {
  if (!uri.startsWith("file://")) {
    return null;
  }

  const path = uri.slice("file://".length);
  if (!path.startsWith("/")) {
    return null;
  }

  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}
