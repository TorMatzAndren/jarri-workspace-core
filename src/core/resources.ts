import type { PreferredPanelSize } from "./types";

export type ResourceUri = string & { readonly __resourceUri: unique symbol };

export type ResourceOpenDisposition = "reuse" | "new-panel" | "preview";

export type OpenResourceRequest = {
  uri: ResourceUri;
  label?: string;
  preferredModuleId?: string;
  preferredPanelType?: string;
  disposition?: ResourceOpenDisposition;
  sourcePanelId?: string;
  preferredGeometry?: PreferredPanelSize;
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

const IMAGE_FILE_EXTENSION_PATTERN =
  /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i;

const TEXT_FILE_EXTENSION_PATTERN =
  /\.(?:adoc|bash|c|cc|cfg|cjs|conf|cpp|css|csv|cxx|env|fish|go|h|hh|hpp|htm|html|ini|java|js|json|jsonc|jsx|kt|kts|less|log|lua|mjs|md|markdown|php|profile|ps1|py|rb|rs|rst|sass|scss|sh|sql|swift|toml|ts|tsx|txt|xml|yaml|yml|zsh)$/i;

const CONVENTIONAL_TEXT_FILE_NAMES = new Set([
  "authors",
  "changelog",
  "contributors",
  "copying",
  "dockerfile",
  "license",
  "makefile",
  "notice",
  "readme",
  "todo",
]);

export function isImageFilePath(path: string): boolean {
  return IMAGE_FILE_EXTENSION_PATTERN.test(path.trim());
}

export function isTextFilePath(path: string): boolean {
  const trimmed = path.trim();
  const name = filePathBasename(trimmed).toLowerCase();
  return (
    TEXT_FILE_EXTENSION_PATTERN.test(trimmed) ||
    CONVENTIONAL_TEXT_FILE_NAMES.has(name) ||
    name === "cmakelists.txt" ||
    name === ".bashrc" ||
    name === ".zshrc" ||
    name === ".profile" ||
    name === ".gitconfig" ||
    name === ".editorconfig" ||
    name.startsWith(".env")
  );
}

export function resourceUriToImageFilePath(
  uri: ResourceUri | string,
): string | null {
  const path = resourceUriToFilePath(uri);
  return path && isImageFilePath(path) ? path : null;
}

export function resourceUriToTextFilePath(
  uri: ResourceUri | string,
): string | null {
  const path = resourceUriToFilePath(uri);
  return path && isTextFilePath(path) ? path : null;
}

export function explicitTextViewerResourcePath(
  request: OpenResourceRequest,
): string | null {
  if (
    request.preferredModuleId !== "core" ||
    request.preferredPanelType !== "text-viewer"
  ) {
    return null;
  }

  const path = resourceUriToFilePath(request.uri);
  if (!path) {
    return null;
  }

  // Filename classification remains authoritative for resources that Core
  // already recognizes. This exception exists only for content-probed,
  // otherwise-unclassified files explicitly routed to the Text Viewer.
  if (isImageFilePath(path)) {
    return null;
  }

  return path;
}

export function filePathBasename(path: string): string {
  const trimmed = path.trim();
  const lastSlash = trimmed.lastIndexOf("/");
  return lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
}
