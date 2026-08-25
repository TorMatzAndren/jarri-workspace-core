import { filePathToResourceUri, isTextFilePath, type OpenResourceRequest } from "./resources";
import {
  classifyWorkspaceFile,
  classifyWorkspaceFileIcon,
  type WorkspaceFileIconKind,
} from "./fileIcons";

export type GenericFileKind = "file" | "directory" | "symlink" | "other";

export type GenericFileEntry = {
  path: string;
  parentPath?: string | null;
  name: string;
  kind: GenericFileKind;
  targetKind?: GenericFileKind;
  size?: number | null;
  modifiedMs?: number | null;
  readonly?: boolean;
  hidden?: boolean;
  hasChildren?: boolean;
};

export type FileIconKind = WorkspaceFileIconKind;

export type FileOperationClipboardMode = "copy" | "cut";

export type FileBrowserSortField = "name" | "type" | "modified" | "size";

export type FileBrowserSortState = {
  field: FileBrowserSortField;
  direction: "asc" | "desc";
  foldersFirst: boolean;
};

export type FileOperationClipboard = {
  mode: FileOperationClipboardMode;
  sourcePaths: string[];
  sourceEntries?: Array<{
    path: string;
    kind: GenericFileKind;
    targetKind?: GenericFileKind;
  }>;
  sourcePanelId?: string;
  createdAt: string;
  operationId: string;
};

export function fileNameFromPath(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

export function parentPath(path: string) {
  const cleaned = path.replace(/\/+$/, "");
  const index = cleaned.lastIndexOf("/");
  if (index <= 0) return "/";
  return cleaned.slice(0, index);
}

export function ancestorDirectoryPaths(path: string, rootPath = "/") {
  const root = rootPath.replace(/\/+$/, "") || "/";
  const ancestors: string[] = [];
  let current = path.replace(/\/+$/, "") || "/";

  while (current && current !== "/" && current.startsWith(root)) {
    ancestors.push(current);
    current = parentPath(current);
  }

  if (root === "/" || path === root || path.startsWith(`${root}/`)) {
    ancestors.push(root);
  }

  return [...new Set(ancestors.reverse())];
}

export function joinPath(parent: string, name: string) {
  return parent.replace(/\/+$/, "") + "/" + name.replace(/^\/+/, "");
}

export function extensionOf(path: string) {
  const name = fileNameFromPath(path).toLowerCase();
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index) : "";
}

export function describeFileType(
  entry: Pick<GenericFileEntry, "path" | "kind" | "targetKind">,
) {
  return classifyWorkspaceFile({
    name: entry.path,
    nodeKind: entry.kind,
    targetKind: entry.targetKind ?? null,
  }).displayType;
}

export function classifyFileIcon(entry: Pick<GenericFileEntry, "path" | "kind" | "targetKind">, expanded = false): FileIconKind {
  return classifyWorkspaceFileIcon({
    name: entry.path,
    nodeKind: entry.kind,
    expanded,
  });
}

export function isDirectoryLikeEntry(
  entry: Pick<GenericFileEntry, "kind" | "targetKind">,
) {
  return entry.kind === "directory" || entry.targetKind === "directory";
}

export function fileBrowserEntryOpenIntent(
  entry: Pick<GenericFileEntry, "kind" | "targetKind">,
) {
  if (isDirectoryLikeEntry(entry)) return "navigate";
  if (entry.kind === "file" || entry.kind === "symlink") return "open-resource";
  return "unsupported";
}

export function preferredResourcePanelType(path: string) {
  if (classifyFileIcon({ path, kind: "file" }) === "image") return "image-viewer";
  if (isTextFilePath(path)) return "text-viewer";
  return "";
}

export function resourceRequestForFile(path: string, label = fileNameFromPath(path)): OpenResourceRequest {
  const preferredPanelType = preferredResourcePanelType(path);
  return {
    uri: filePathToResourceUri(path),
    label,
    preferredModuleId: preferredPanelType ? "core" : undefined,
    preferredPanelType: preferredPanelType || undefined,
    disposition: "reuse",
  };
}

export const DEFAULT_FILE_BROWSER_SORT: FileBrowserSortState = {
  field: "name",
  direction: "asc",
  foldersFirst: true,
};

export function sortFileEntries(
  entries: GenericFileEntry[],
  sort: FileBrowserSortState = DEFAULT_FILE_BROWSER_SORT,
) {
  return [...entries].sort((left, right) => {
    if (sort.foldersFirst) {
      const leftDirectory = left.kind === "directory";
      const rightDirectory = right.kind === "directory";
      if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1;
    }

    let comparison = 0;
    if (sort.field === "name") {
      comparison = left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    } else if (sort.field === "type") {
      comparison =
        left.kind.localeCompare(right.kind) ||
        extensionOf(left.name).localeCompare(extensionOf(right.name));
    } else if (sort.field === "modified") {
      comparison = (left.modifiedMs ?? 0) - (right.modifiedMs ?? 0);
    } else {
      comparison = (left.size ?? -1) - (right.size ?? -1);
    }
    if (comparison !== 0) {
      return sort.direction === "asc" ? comparison : -comparison;
    }
    return left.path.localeCompare(right.path);
  });
}

export function filterHiddenEntries(entries: GenericFileEntry[], showHidden: boolean) {
  return showHidden ? entries : entries.filter((entry) => !entry.hidden && !entry.name.startsWith("."));
}

export function searchEntriesByPath(
  entries: GenericFileEntry[],
  query: string,
  showHidden: boolean,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return sortFileEntries(
    filterHiddenEntries(entries, showHidden).filter((entry) =>
      `${entry.name}\n${entry.path}`.toLowerCase().includes(needle),
    ),
  );
}

export function fileBrowserSearchOrigin(
  currentDirectoryPath: string,
  browserRoot: string,
) {
  return currentDirectoryPath || browserRoot;
}

export function fileBrowserSearchRequestKey({
  panelId,
  root,
  query,
  showHidden,
  sort,
}: {
  panelId: string;
  root: string;
  query: string;
  showHidden: boolean;
  sort: FileBrowserSortState;
}) {
  return [
    panelId,
    root,
    query,
    showHidden ? "hidden" : "visible",
    sort.field,
    sort.direction,
    sort.foldersFirst ? "folders-first" : "mixed",
  ].join("\u001f");
}

export function resolveSelectedFileBrowserEntry({
  selectedPath,
  browserRoot,
  rootEntry,
  cachedEntries,
  searchEntries,
  searchActive,
}: {
  selectedPath: string | null | undefined;
  browserRoot: string;
  rootEntry: GenericFileEntry;
  cachedEntries: GenericFileEntry[];
  searchEntries?: GenericFileEntry[];
  searchActive?: boolean;
}) {
  if (!selectedPath) return null;
  if (selectedPath === browserRoot) return rootEntry;

  const cachedEntry = cachedEntries.find((entry) => entry.path === selectedPath);
  if (cachedEntry) return cachedEntry;

  if (searchActive) {
    return searchEntries?.find((entry) => entry.path === selectedPath) ?? null;
  }

  return null;
}

export type SearchSkipDiagnostic = {
  path: string;
  reason: string;
};

export type SearchRuntimeSummary = {
  matches: number;
  entriesScanned?: number;
  directoriesScanned?: number;
  skippedCount?: number;
  resultLimitReached?: boolean;
  traversalLimitReached?: boolean;
  cancelled?: boolean;
  complete?: boolean;
  source?: string;
  statusText?: string;
};

export function formatSearchSkipSummary(skipped: SearchSkipDiagnostic[]) {
  if (skipped.length === 0) return "";
  const first = skipped[0];
  return `${skipped.length} subtree${skipped.length === 1 ? "" : "s"} skipped: ${first.path} (${first.reason})`;
}

export function formatSearchCompletenessSummary(summary: SearchRuntimeSummary) {
  if (summary.cancelled) {
    return "Search cancelled; displayed results may be incomplete.";
  }

  const scanned = summary.entriesScanned ?? summary.directoriesScanned ?? 0;

  if (summary.traversalLimitReached) {
    return `Search incomplete: traversal stopped after ${scanned} scanned entries. Results may omit matching paths.`;
  }

  if (summary.resultLimitReached) {
    return `Search incomplete: result limit reached at ${summary.matches} matches. Refine the query or root to find later matches.`;
  }

  if (summary.complete) {
    return "Search complete.";
  }

  return "";
}

export function formatSearchRuntimeSummary(summary: SearchRuntimeSummary) {
  const parts = [`${summary.matches} matches`];
  if (summary.source) {
    parts.push(summary.source === "live" ? "live" : summary.source);
  }
  if (summary.statusText) parts.push(summary.statusText);
  if (
    summary.source !== "indexed" &&
    (summary.entriesScanned !== undefined || summary.directoriesScanned !== undefined)
  ) {
    const scanned = summary.entriesScanned ?? summary.directoriesScanned ?? 0;
    parts.push(`${scanned} scanned`);
  }
  if (summary.resultLimitReached) parts.push("result limit reached");
  if (summary.traversalLimitReached) parts.push("search traversal limit reached");
  if (summary.cancelled) parts.push("cancelled");
  if (summary.skippedCount) {
    parts.push(`${summary.skippedCount} subtree${summary.skippedCount === 1 ? "" : "s"} skipped`);
  }
  return parts.join(" · ");
}

export function searchResultIsCurrent(
  completedSearchId: string,
  activeSearchId: string | null,
) {
  return Boolean(activeSearchId) && completedSearchId === activeSearchId;
}

export function validateBrowserName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name must not be empty." };
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return { ok: false as const, error: "Name must not contain path separators." };
  }
  if (trimmed === "." || trimmed === "..") {
    return { ok: false as const, error: "Name must not be . or ..." };
  }
  return { ok: true as const, name: trimmed };
}

export function isSameOrDescendantPath(path: string, possibleAncestor: string) {
  const target = path.replace(/\/+$/, "");
  const ancestor = possibleAncestor.replace(/\/+$/, "");
  return target === ancestor || target.startsWith(`${ancestor}/`);
}

export function validatePasteDestination({
  mode,
  sourcePaths,
  sourceEntries,
  destinationDirectory,
}: {
  mode: FileOperationClipboardMode;
  sourcePaths: string[];
  sourceEntries?: Array<Pick<GenericFileEntry, "path" | "kind" | "targetKind">>;
  destinationDirectory: string;
}) {
  const destination = destinationDirectory.replace(/\/+$/, "");
  for (const sourcePath of sourcePaths) {
    const source = sourcePath.replace(/\/+$/, "");
    const sourceEntry = sourceEntries?.find((entry) => entry.path === sourcePath);
    const sourceMayContainDestination = sourceEntry
      ? isDirectoryLikeEntry(sourceEntry)
      : true;
    if (sourceMayContainDestination && isSameOrDescendantPath(destination, source)) {
      return {
        ok: false as const,
        error:
          mode === "cut"
            ? "Cannot move a directory into itself or one of its descendants."
            : "Cannot copy a directory into itself or one of its descendants.",
      };
    }
  }
  return { ok: true as const };
}

export function createFileOperationClipboard(
  mode: FileOperationClipboardMode,
  sourcePaths: string[],
  sourcePanelId?: string,
  now = new Date().toISOString(),
  sourceEntries?: Array<Pick<GenericFileEntry, "path" | "kind" | "targetKind">>,
): FileOperationClipboard | null {
  const paths = sourcePaths.map((path) => path.trim()).filter(Boolean);
  if (paths.length === 0) return null;
  return {
    mode,
    sourcePaths: paths,
    sourceEntries: sourceEntries
      ?.filter((entry) => paths.includes(entry.path))
      .map((entry) => ({
        path: entry.path,
        kind: entry.kind,
        targetKind: entry.targetKind,
      })),
    sourcePanelId,
    createdAt: now,
    operationId: `${mode}:${now}:${paths.join("|")}`,
  };
}
