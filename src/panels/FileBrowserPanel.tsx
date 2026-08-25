import { useEffect, useMemo, useRef, useState } from "react";
import type { PanelBodyProps } from "../core/types";
import { FileTypeIcon } from "../core/FileTypeIcon";
import { WorkspaceSelect, type WorkspaceSelectOption } from "../core/WorkspaceSelect";
import {
  workspaceFilesystemProvider,
  type WorkspaceFilesystemEntry,
  type WorkspaceFilesystemListPayload,
} from "../core/filesystemProvider";
import {
  DEFAULT_FILE_BROWSER_SORT,
  ancestorDirectoryPaths,
  classifyFileIcon,
  createFileOperationClipboard,
  fileNameFromPath,
  filterHiddenEntries,
  type FileBrowserSortField,
  type FileBrowserSortState,
  formatSearchRuntimeSummary,
  formatSearchSkipSummary,
  isDirectoryLikeEntry,
  parentPath,
  resourceRequestForFile,
  sortFileEntries,
  searchResultIsCurrent,
  validateBrowserName,
  validatePasteDestination,
  type FileOperationClipboard,
  type GenericFileEntry,
  type GenericFileKind,
  type SearchSkipDiagnostic,
} from "../core/fileBrowserModel";

export type FileBrowserPanelState = {
  browserRoot: string;
  currentDirectoryPath: string;
  selectedPath: string | null;
  selectedEntryKind: GenericFileKind | "";
  expandedPaths: string[];
  showHidden: boolean;
  sort: FileBrowserSortState;
  search: {
    query: string;
  };
};

type DirectoryCacheEntry = {
  payload?: WorkspaceFilesystemListPayload;
  loading: boolean;
  error: string;
};

type DirectoryCache = Record<string, DirectoryCacheEntry>;

type InlineEdit =
  | { kind: "rename"; path: string; value: string }
  | { kind: "new-folder"; parentPath: string; value: string };

type DeleteCandidate = {
  paths: string[];
  recursive: boolean;
};

type SearchState =
  | { kind: "idle"; entries: GenericFileEntry[]; skipped: SearchSkipDiagnostic[]; runtime: SearchRuntimeState }
  | { kind: "loading"; entries: GenericFileEntry[]; skipped: SearchSkipDiagnostic[]; runtime: SearchRuntimeState; searchId: string }
  | { kind: "ready"; entries: GenericFileEntry[]; skipped: SearchSkipDiagnostic[]; runtime: SearchRuntimeState }
  | { kind: "error"; entries: GenericFileEntry[]; message: string };

const DEFAULT_ROOT_PATH = "/";
const DEFAULT_SEARCH_RESULT_LIMIT = 200;
const DEFAULT_SEARCH_TRAVERSAL_LIMIT = 25000;

type SearchRuntimeState = {
  entriesScanned: number;
  directoriesScanned: number;
  resultLimitReached: boolean;
  traversalLimitReached: boolean;
  cancelled: boolean;
  resultLimit: number;
  traversalLimit: number;
  source: "indexed" | "live" | "";
  statusText?: string;
};

const sortFieldOptions: Array<WorkspaceSelectOption<FileBrowserSortField>> = [
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
  { value: "modified", label: "Modified" },
  { value: "size", label: "Size" },
];

const sortDirectionOptions: Array<WorkspaceSelectOption<"asc" | "desc">> = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

function emptySearchRuntime(): SearchRuntimeState {
  return {
    entriesScanned: 0,
    directoriesScanned: 0,
    resultLimitReached: false,
    traversalLimitReached: false,
    cancelled: false,
    resultLimit: DEFAULT_SEARCH_RESULT_LIMIT,
    traversalLimit: DEFAULT_SEARCH_TRAVERSAL_LIMIT,
    source: "",
  };
}

function normalizeAbsolutePath(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  return trimmed.replace(/\/+$/, "") || "/";
}

function isSameOrDescendantPath(path: string, root: string) {
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  const normalizedRoot = root.replace(/\/+$/, "") || "/";
  return (
    normalizedPath === normalizedRoot ||
    normalizedRoot === "/" ||
    normalizedPath.startsWith(`${normalizedRoot}/`)
  );
}

function normalizeSort(input: unknown): FileBrowserSortState {
  if (!isRecord(input)) return DEFAULT_FILE_BROWSER_SORT;
  const field =
    input.field === "type" ||
    input.field === "modified" ||
    input.field === "size" ||
    input.field === "name"
      ? input.field
      : DEFAULT_FILE_BROWSER_SORT.field;
  const direction = input.direction === "desc" ? "desc" : "asc";
  return {
    field,
    direction,
    foldersFirst:
      typeof input.foldersFirst === "boolean"
        ? input.foldersFirst
        : DEFAULT_FILE_BROWSER_SORT.foldersFirst,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEntryType(value: unknown): GenericFileKind | "" {
  return value === "directory" ||
    value === "file" ||
    value === "symlink" ||
    value === "other"
    ? value
    : "";
}

export function normalizeFileBrowserState(input: unknown): FileBrowserPanelState {
  if (!isRecord(input)) {
    return {
      browserRoot: DEFAULT_ROOT_PATH,
      currentDirectoryPath: DEFAULT_ROOT_PATH,
      selectedPath: null,
      selectedEntryKind: "",
      expandedPaths: [],
      showHidden: false,
      sort: DEFAULT_FILE_BROWSER_SORT,
      search: { query: "" },
    };
  }

  const browserRoot = normalizeAbsolutePath(
    input.browserRoot ?? input.selectedRootPath,
    DEFAULT_ROOT_PATH,
  );
  const requestedCurrent = normalizeAbsolutePath(
    input.currentDirectoryPath,
    browserRoot,
  );
  const currentDirectoryPath = isSameOrDescendantPath(requestedCurrent, browserRoot)
    ? requestedCurrent
    : browserRoot;
  const selectedPath =
    typeof input.selectedPath === "string" &&
    input.selectedPath.trim().startsWith("/") &&
    isSameOrDescendantPath(input.selectedPath.trim(), browserRoot)
      ? input.selectedPath.trim()
      : null;

  return {
    browserRoot,
    currentDirectoryPath,
    selectedPath,
    selectedEntryKind: selectedPath
      ? normalizeEntryType(input.selectedEntryKind ?? input.selectedEntryType)
      : "",
    expandedPaths: (Array.isArray(input.expandedPaths)
      ? input.expandedPaths
      : Array.isArray(input.expandedDirs)
        ? input.expandedDirs
        : []
    ).filter(
      (entry): entry is string =>
        typeof entry === "string" &&
        entry.startsWith("/") &&
        isSameOrDescendantPath(entry, browserRoot),
    ),
    showHidden: input.showHidden === true,
    sort: normalizeSort(input.sort),
    search: {
      query:
        isRecord(input.search) && typeof input.search.query === "string"
          ? input.search.query
          : typeof input.searchQuery === "string"
            ? input.searchQuery
            : "",
    },
  };
}

function genericEntry(entry: WorkspaceFilesystemEntry): GenericFileEntry {
  return {
    path: entry.path,
    parentPath: entry.parentPath ?? parentPath(entry.path),
    name: entry.name || fileNameFromPath(entry.path),
    kind: entry.kind,
    targetKind: entry.targetKind ?? undefined,
    size: entry.size ?? null,
    modifiedMs: entry.modifiedMs ?? null,
    readonly: entry.readonly,
    hidden: entry.hidden,
    hasChildren: entry.hasChildren ?? undefined,
  };
}

function isFileOperationClipboard(value: unknown): value is FileOperationClipboard {
  return (
    isRecord(value) &&
    (value.mode === "copy" || value.mode === "cut") &&
    Array.isArray(value.sourcePaths) &&
    value.sourcePaths.every((path) => typeof path === "string")
  );
}

export async function copyFileBrowserPath(
  path: string,
  writeText: (text: string) => Promise<void>,
) {
  const selectedPath = path.trim();

  if (!selectedPath) {
    return {
      kind: "unavailable",
      message: "No path selected.",
    } as const;
  }

  try {
    await writeText(selectedPath);
    return {
      kind: "copied",
      message: `Copied path: ${selectedPath}`,
    } as const;
  } catch {
    return {
      kind: "error",
      message: "Copy path failed.",
    } as const;
  }
}

function errorMessage(result: { error: string; detail?: string }) {
  return result.detail ? `${result.error} (${result.detail})` : result.error;
}

function formatBytes(size: number | null | undefined) {
  if (size === null || size === undefined) return "n/a";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatModified(modifiedMs: number | null | undefined) {
  if (!modifiedMs) return "n/a";
  return new Date(modifiedMs).toLocaleString();
}

function breadcrumbSegments(path: string) {
  const cleaned = path.replace(/\/+$/, "") || "/";
  if (cleaned === "/") return [{ label: "/", path: "/" }];
  const parts = cleaned.split("/").filter(Boolean);
  const segments = [{ label: "/", path: "/" }];
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    segments.push({ label: part, path: current });
  }
  return segments;
}

function shouldIgnoreShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function FileBrowserPanel({
  panel,
  updatePanelState,
  openResource,
  fileOperationClipboard,
  setFileOperationClipboard,
}: PanelBodyProps) {
  const state = normalizeFileBrowserState(panel.panelState);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const rootInputRef = useRef<HTMLInputElement | null>(null);
  const [rootDraft, setRootDraft] = useState(state.browserRoot);
  const [directoryCache, setDirectoryCache] = useState<DirectoryCache>({});
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate | null>(null);
  const [searchState, setSearchState] = useState<SearchState>({
    kind: "idle",
    entries: [],
    skipped: [],
    runtime: emptySearchRuntime(),
  });
  const activeSearchIdRef = useRef<string | null>(null);

  const clipboard = isFileOperationClipboard(fileOperationClipboard)
    ? fileOperationClipboard
    : null;
  const expandedPaths = useMemo(() => new Set(state.expandedPaths), [state.expandedPaths]);
  const rootEntry: GenericFileEntry = {
    path: state.browserRoot,
    name: state.browserRoot === "/" ? "/" : fileNameFromPath(state.browserRoot),
    kind: "directory",
  };
  const selectedEntryForActions =
    state.selectedPath === state.browserRoot ? rootEntry : findCachedEntry(state.selectedPath ?? "");
  const selectedDirectory =
    selectedEntryForActions && isDirectoryLikeEntry(selectedEntryForActions)
      ? selectedEntryForActions.path
      : state.currentDirectoryPath || state.browserRoot;

  function updateState(updates: Partial<FileBrowserPanelState>) {
    updatePanelState({ ...state, ...updates });
  }

  function updateSearchQuery(query: string) {
    updateState({ search: { query } });
  }

  function updateSort(updates: Partial<FileBrowserSortState>) {
    updateState({ sort: { ...state.sort, ...updates } });
  }

  function reportError(message: string) {
    setErrorText(message);
    setStatusText("");
  }

  function reportStatus(message: string) {
    setStatusText(message);
    setErrorText("");
  }

  function cancelActiveSearch(searchId: string) {
    if (searchResultIsCurrent(searchId, activeSearchIdRef.current)) {
      activeSearchIdRef.current = null;
    }
    void workspaceFilesystemProvider.searchCancel(searchId);
    setSearchState((current) =>
      current.kind === "loading" && current.searchId === searchId
        ? {
            kind: "ready",
            entries: current.entries,
            skipped: current.skipped,
            runtime: {
              ...current.runtime,
              cancelled: true,
            },
          }
        : current,
    );
  }

  async function navigateDirectory(path: string) {
    const ok = directoryCache[path]?.payload ? true : await loadDirectory(path);
    if (!ok) return;
    updateState({
      currentDirectoryPath: path,
      selectedPath: path,
      selectedEntryKind: "directory",
      expandedPaths: [
        ...new Set([
          ...state.expandedPaths,
          ...ancestorDirectoryPaths(path, state.browserRoot),
        ]),
      ],
    });
  }

  async function loadDirectory(path: string) {
    setDirectoryCache((current) => ({
      ...current,
      [path]: {
        ...current[path],
        loading: true,
        error: "",
      },
    }));

    const result = await workspaceFilesystemProvider.list(path, state.showHidden);
    if (!result.ok) {
      setDirectoryCache((current) => ({
        ...current,
        [path]: {
          ...current[path],
          loading: false,
          error: errorMessage(result),
        },
      }));
      reportError(errorMessage(result));
      return false;
    }

    setDirectoryCache((current) => ({
      ...current,
      [result.data.path]: {
        payload: {
          ...result.data,
          entries: sortFileEntries(
            filterHiddenEntries(
              result.data.entries.map(genericEntry),
              state.showHidden,
            ),
            state.sort,
          ) as WorkspaceFilesystemEntry[],
        },
        loading: false,
        error: "",
      },
    }));
    return true;
  }

  async function refreshDirectory(path = state.browserRoot) {
    const ok = await loadDirectory(path);
    if (ok) reportStatus(`Refreshed ${path}`);
  }

  async function refreshAffected(paths: string[]) {
    const parents = new Set<string>();
    paths.forEach((path) => {
      parents.add(parentPath(path));
      if (
        path === state.browserRoot ||
        path === state.currentDirectoryPath ||
        expandedPaths.has(path) ||
        directoryCache[path]?.payload
      ) {
        parents.add(path);
      }
    });
    await Promise.all([...parents].map((path) => loadDirectory(path)));
  }

  useEffect(() => {
    setRootDraft(state.browserRoot);
  }, [state.browserRoot]);

  useEffect(() => {
    void loadDirectory(state.browserRoot);
  }, [state.browserRoot, state.showHidden]);

  useEffect(() => {
    if (state.currentDirectoryPath && state.currentDirectoryPath !== state.browserRoot) {
      void loadDirectory(state.currentDirectoryPath);
    }
  }, [state.currentDirectoryPath, state.browserRoot, state.showHidden]);

  useEffect(() => {
    if (!state.search.query.trim()) {
      if (activeSearchIdRef.current) {
        void workspaceFilesystemProvider.searchCancel(activeSearchIdRef.current);
      }
      activeSearchIdRef.current = null;
      setSearchState({ kind: "idle", entries: [], skipped: [], runtime: emptySearchRuntime() });
      return;
    }

    const searchId = `${panel.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const previousSearchId = activeSearchIdRef.current;
    if (previousSearchId) {
      void workspaceFilesystemProvider.searchCancel(previousSearchId);
    }
    activeSearchIdRef.current = searchId;
    setSearchState((current) => ({
      kind: "loading",
      entries: current.entries,
      skipped: current.kind === "error" ? [] : current.skipped,
      runtime: current.kind === "error" ? emptySearchRuntime() : current.runtime,
      searchId,
    }));
    const timeout = window.setTimeout(() => {
      void workspaceFilesystemProvider
        .search({
          root: state.browserRoot,
          query: state.search.query,
          includeHidden: state.showHidden,
          limit: DEFAULT_SEARCH_RESULT_LIMIT,
          traversalLimit: DEFAULT_SEARCH_TRAVERSAL_LIMIT,
          searchId,
        })
        .then((result) => {
          if (!searchResultIsCurrent(searchId, activeSearchIdRef.current)) return;
          if (!result.ok) {
            activeSearchIdRef.current = null;
            setSearchState({
              kind: "error",
              entries: [],
              message: errorMessage(result),
            });
            return;
          }
          activeSearchIdRef.current = null;
          setSearchState({
            kind: "ready",
            entries: sortFileEntries(result.data.entries.map(genericEntry), state.sort),
            skipped: result.data.skipped ?? [],
            runtime: {
              entriesScanned: result.data.entriesScanned ?? 0,
              directoriesScanned: result.data.directoriesScanned ?? 0,
              resultLimitReached: result.data.resultLimitReached,
              traversalLimitReached: result.data.traversalLimitReached,
              cancelled: result.data.cancelled ?? false,
              resultLimit: result.data.resultLimit ?? DEFAULT_SEARCH_RESULT_LIMIT,
              traversalLimit:
                result.data.traversalLimit ?? DEFAULT_SEARCH_TRAVERSAL_LIMIT,
              source:
                result.data.source === "indexed" || result.data.source === "live"
                  ? result.data.source
                  : "",
              statusText: result.data.statusText,
            },
          });
        });
    }, 250);

    return () => {
      if (searchResultIsCurrent(searchId, activeSearchIdRef.current)) {
        activeSearchIdRef.current = null;
        void workspaceFilesystemProvider.searchCancel(searchId);
      }
      window.clearTimeout(timeout);
    };
  }, [panel.id, state.search.query, state.browserRoot, state.showHidden, state.sort]);

  function selectEntry(entry: GenericFileEntry) {
    updateState({
      selectedPath: entry.path,
      selectedEntryKind: entry.kind,
      ...(entry.kind === "directory" ? { currentDirectoryPath: entry.path } : {}),
    });
  }

  async function toggleDirectory(path: string) {
    if (expandedPaths.has(path)) {
      updateState({ expandedPaths: state.expandedPaths.filter((entry) => entry !== path) });
      return;
    }

    const ok = directoryCache[path]?.payload ? true : await loadDirectory(path);
    if (ok) {
      updateState({
        expandedPaths: [...state.expandedPaths, path],
        currentDirectoryPath: path,
        selectedPath: path,
        selectedEntryKind: "directory",
      });
    }
  }

  function openEntry(entry: GenericFileEntry) {
    if (isDirectoryLikeEntry(entry)) {
      void navigateDirectory(entry.path);
      return;
    }
    if (entry.kind !== "file" && entry.kind !== "symlink") {
      reportError(`Cannot open unsupported filesystem entry: ${entry.path}`);
      return;
    }

    try {
      const result = openResource(resourceRequestForFile(entry.path, entry.name));
      if (!result.ok) reportError(result.error);
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error));
    }
  }

  function copyOperation(mode: "copy" | "cut") {
    if (!state.selectedPath) {
      reportError("Select a file or folder first.");
      return;
    }

    const sourceEntry =
      state.selectedPath === state.browserRoot ? rootEntry : findCachedEntry(state.selectedPath);
    const next = createFileOperationClipboard(
      mode,
      [state.selectedPath],
      panel.id,
      undefined,
      sourceEntry ? [sourceEntry] : undefined,
    );
    if (!next) {
      reportError("No file operation could be created.");
      return;
    }
    setFileOperationClipboard(next);
    reportStatus(`${mode === "copy" ? "Copy" : "Cut"} ready: ${state.selectedPath}`);
  }

  async function pasteOperation() {
    if (!clipboard) {
      reportError("Nothing to paste.");
      return;
    }

    const validation = validatePasteDestination({
      mode: clipboard.mode,
      sourcePaths: clipboard.sourcePaths,
      sourceEntries: clipboard.sourceEntries,
      destinationDirectory: selectedDirectory,
    });
    if (!validation.ok) {
      reportError(validation.error);
      return;
    }

    const result =
      clipboard.mode === "copy"
        ? await workspaceFilesystemProvider.copy(clipboard.sourcePaths, selectedDirectory)
        : await workspaceFilesystemProvider.move(clipboard.sourcePaths, selectedDirectory);

    if (!result.ok) {
      reportError(errorMessage(result));
      return;
    }

    if (clipboard.mode === "cut") {
      setFileOperationClipboard(null);
    }
    await refreshAffected(result.data.affectedPaths);
    reportStatus(result.data.message);
  }

  function beginRename() {
    if (!state.selectedPath) {
      reportError("Select a file or folder to rename.");
      return;
    }
    setInlineEdit({
      kind: "rename",
      path: state.selectedPath,
      value: fileNameFromPath(state.selectedPath),
    });
  }

  function beginNewFolder() {
    setInlineEdit({
      kind: "new-folder",
      parentPath: selectedDirectory,
      value: "New Folder",
    });
  }

  async function commitInlineEdit() {
    if (!inlineEdit) return;
    const validation = validateBrowserName(inlineEdit.value);
    if (!validation.ok) {
      reportError(validation.error);
      return;
    }

    const result =
      inlineEdit.kind === "rename"
        ? await workspaceFilesystemProvider.rename(inlineEdit.path, validation.name)
        : await workspaceFilesystemProvider.createDirectory(inlineEdit.parentPath, validation.name);

    if (!result.ok) {
      reportError(errorMessage(result));
      return;
    }

    const createdOrRenamed = result.data.affectedPaths.at(-1) ?? "";
    setInlineEdit(null);
    updateState({
      selectedPath: createdOrRenamed,
      selectedEntryKind: inlineEdit.kind === "new-folder" ? "directory" : state.selectedEntryKind,
    });
    await refreshAffected(result.data.affectedPaths);
    reportStatus(result.data.message);
  }

  function requestDelete() {
    if (!state.selectedPath) {
      reportError("Select a file or folder to delete.");
      return;
    }
    setDeleteCandidate({
      paths: [state.selectedPath],
      recursive: state.selectedEntryKind === "directory",
    });
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    const result = await workspaceFilesystemProvider.delete(
      deleteCandidate.paths,
      deleteCandidate.recursive,
    );
    if (!result.ok) {
      reportError(errorMessage(result));
      return;
    }
    setDeleteCandidate(null);
    updateState({ selectedPath: null, selectedEntryKind: "" });
    await refreshAffected(result.data.affectedPaths);
    reportStatus(result.data.message);
  }

  async function applyRootDraft() {
    const nextRoot = rootDraft.trim();
    if (!nextRoot.startsWith("/")) {
      reportError("Root path must be absolute.");
      return;
    }
    const normalizedRoot = nextRoot.replace(/\/+$/, "") || "/";
    const ok = await loadDirectory(normalizedRoot);
    if (!ok) return;
    const currentDirectoryPath = isSameOrDescendantPath(
      state.currentDirectoryPath,
      normalizedRoot,
    )
      ? state.currentDirectoryPath
      : normalizedRoot;
    updateState({
      browserRoot: normalizedRoot,
      currentDirectoryPath,
      selectedPath:
        state.selectedPath && isSameOrDescendantPath(state.selectedPath, normalizedRoot)
          ? state.selectedPath
          : currentDirectoryPath,
      selectedEntryKind: "directory",
      expandedPaths: state.expandedPaths.filter((path) =>
        isSameOrDescendantPath(path, normalizedRoot),
      ),
    });
  }

  function setSelectedDirectoryAsRoot() {
    const nextRoot =
      selectedEntryForActions && isDirectoryLikeEntry(selectedEntryForActions)
        ? selectedEntryForActions.path
        : state.currentDirectoryPath;
    if (!nextRoot) return;
    setRootDraft(nextRoot);
    updateState({
      browserRoot: nextRoot,
      currentDirectoryPath: nextRoot,
      selectedPath: nextRoot,
      selectedEntryKind: "directory",
      expandedPaths: [],
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (shouldIgnoreShortcutTarget(event.target)) {
      if (event.key === "Escape" && inlineEdit) {
        setInlineEdit(null);
      }
      return;
    }

    if (event.key === "Enter" && state.selectedPath) {
      const entry =
        findCachedEntry(state.selectedPath) ??
        (state.selectedPath === state.browserRoot ? rootEntry : null);
      if (entry) openEntry(entry);
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      requestDelete();
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      beginRename();
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copyOperation("copy");
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "x") {
      event.preventDefault();
      copyOperation("cut");
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      void pasteOperation();
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      searchInputRef.current?.focus();
      return;
    }

    if (event.key === "Escape") {
      if (inlineEdit) {
        setInlineEdit(null);
        return;
      }
      if (state.search.query) {
        updateSearchQuery("");
      }
    }
  }

  function findCachedEntry(path: string) {
    for (const cacheEntry of Object.values(directoryCache)) {
      const match = cacheEntry.payload?.entries
        .map(genericEntry)
        .find((entry) => entry.path === path);
      if (match) return match;
    }
    return null;
  }

  function renderInlineEdit() {
    if (!inlineEdit) return null;
    return (
      <div className="workspace-file-browser-inline-edit">
        <span>{inlineEdit.kind === "rename" ? "Rename" : "New Folder"}</span>
        <input
          value={inlineEdit.value}
          autoFocus
          onChange={(event) =>
            setInlineEdit({ ...inlineEdit, value: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") void commitInlineEdit();
            if (event.key === "Escape") setInlineEdit(null);
          }}
        />
        <button type="button" onClick={() => void commitInlineEdit()}>
          Apply
        </button>
        <button type="button" onClick={() => setInlineEdit(null)}>
          Cancel
        </button>
      </div>
    );
  }

  function renderEntry(entry: GenericFileEntry, depth: number) {
    const isDirectory = isDirectoryLikeEntry(entry);
    const isExpanded = expandedPaths.has(entry.path);
    const directoryPayload = directoryCache[entry.path];
    const children = sortFileEntries(
      filterHiddenEntries(
        directoryPayload?.payload?.entries.map(genericEntry) ?? [],
        state.showHidden,
      ),
      state.sort,
    );

    return (
      <div className="workspace-file-browser-tree-row" key={entry.path}>
        <button
          type="button"
          className={`workspace-file-browser-row ${state.selectedPath === entry.path ? "workspace-file-browser-row--selected" : ""}`}
          aria-pressed={state.selectedPath === entry.path}
          onClick={() => selectEntry(entry)}
          onDoubleClick={() => openEntry(entry)}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          title={entry.path}
        >
          <span
            className="workspace-file-browser-row__disclosure"
            onClick={(event) => {
              event.stopPropagation();
              if (isDirectory) void toggleDirectory(entry.path);
            }}
          >
            {isDirectory ? (isExpanded ? "v" : ">") : ""}
          </span>
          <span className="workspace-file-browser-row__icon">
            <FileTypeIcon kind={classifyFileIcon(entry, isExpanded)} />
          </span>
          <span className="workspace-file-browser-row__name">{entry.name}</span>
          <span className="workspace-file-browser-row__type">
            {entry.kind === "symlink" && entry.targetKind
              ? `symlink -> ${entry.targetKind}`
              : entry.kind}
          </span>
        </button>

        {isDirectory && isExpanded ? (
          <div className="workspace-file-browser-tree-children">
            {directoryPayload?.loading ? (
              <div className="workspace-file-browser-empty" style={{ paddingLeft: `${24 + depth * 16}px` }}>
                Loading...
              </div>
            ) : directoryPayload?.error ? (
              <div className="workspace-file-browser-empty" style={{ paddingLeft: `${24 + depth * 16}px` }}>
                {directoryPayload.error}
              </div>
            ) : children.length > 0 ? (
              children.map((child) => renderEntry(child, depth + 1))
            ) : (
              <div className="workspace-file-browser-empty" style={{ paddingLeft: `${24 + depth * 16}px` }}>
                Empty directory.
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const rootCache = directoryCache[state.browserRoot];
  const currentDirectoryPath = state.currentDirectoryPath || state.browserRoot;
  const currentDirectoryCache = directoryCache[currentDirectoryPath];
  const rootChildren = sortFileEntries(
    filterHiddenEntries(rootCache?.payload?.entries.map(genericEntry) ?? [], state.showHidden),
    state.sort,
  );
  const currentDirectoryChildren = sortFileEntries(
    filterHiddenEntries(
      currentDirectoryCache?.payload?.entries.map(genericEntry) ?? [],
      state.showHidden,
    ),
    state.sort,
  );
  const searchActive = Boolean(state.search.query.trim());
  const searchSkipSummary =
    searchState.kind === "error" ? "" : formatSearchSkipSummary(searchState.skipped);
  const searchRuntimeSummary =
    searchState.kind === "error"
      ? ""
      : formatSearchRuntimeSummary({
          matches: searchState.entries.length,
          entriesScanned: searchState.runtime.entriesScanned,
          directoriesScanned: searchState.runtime.directoriesScanned,
          skippedCount: searchState.skipped.length,
          resultLimitReached: searchState.runtime.resultLimitReached,
          traversalLimitReached: searchState.runtime.traversalLimitReached,
          cancelled: searchState.runtime.cancelled,
          source: searchState.runtime.source,
          statusText: searchState.runtime.statusText,
        });
  const selectedEntry = selectedEntryForActions;
  const breadcrumbs = breadcrumbSegments(currentDirectoryPath);

  return (
    <div
      className="panel-body workspace-file-browser-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <header className="workspace-file-browser-toolbar">
        <div>
          <span>File Browser</span>
          <strong>{state.browserRoot}</strong>
          <small className="workspace-file-browser-toolbar__hint">
            Tree browser · Enter opens · F2 renames · Delete removes
          </small>
        </div>
        <div className="workspace-file-browser-actions">
          <button type="button" onClick={() => void refreshDirectory()}>
            Refresh
          </button>
          <button type="button" onClick={setSelectedDirectoryAsRoot}>
            Set as Root
          </button>
          <button type="button" onClick={() => copyOperation("copy")} disabled={!state.selectedPath}>
            Copy
          </button>
          <button type="button" onClick={() => copyOperation("cut")} disabled={!state.selectedPath}>
            Cut
          </button>
          <button type="button" onClick={() => void pasteOperation()} disabled={!clipboard}>
            Paste
          </button>
          <button type="button" onClick={beginNewFolder}>
            New Folder
          </button>
          <button type="button" onClick={beginRename} disabled={!state.selectedPath}>
            Rename
          </button>
          <button type="button" onClick={requestDelete} disabled={!state.selectedPath}>
            Delete
          </button>
        </div>
      </header>

      <div className="workspace-file-browser-controls">
        <label>
          <span>Root</span>
          <input
            ref={rootInputRef}
            value={rootDraft}
            onChange={(event) => setRootDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void applyRootDraft();
            }}
          />
          <button type="button" onClick={() => void applyRootDraft()}>
            Go
          </button>
        </label>
        <label>
          <span>Search</span>
          <input
            ref={searchInputRef}
            value={state.search.query}
            onChange={(event) => updateSearchQuery(event.target.value)}
            placeholder="Filename or path"
          />
          {state.search.query ? (
            <button type="button" onClick={() => updateSearchQuery("")}>
              Clear
            </button>
          ) : null}
        </label>
        <label>
          <span>Sort</span>
          <WorkspaceSelect
            ariaLabel="Sort field"
            value={state.sort.field}
            options={sortFieldOptions}
            onChange={(field) => updateSort({ field })}
          />
          <WorkspaceSelect
            ariaLabel="Sort direction"
            value={state.sort.direction}
            options={sortDirectionOptions}
            onChange={(direction) => updateSort({ direction })}
          />
        </label>
        <label className="workspace-file-browser-toggle">
          <input
            type="checkbox"
            checked={state.showHidden}
            onChange={(event) => updateState({ showHidden: event.target.checked })}
          />
          <span>Show hidden files</span>
        </label>
        <label className="workspace-file-browser-toggle">
          <input
            type="checkbox"
            checked={state.sort.foldersFirst}
            onChange={(event) => updateSort({ foldersFirst: event.target.checked })}
          />
          <span>Folders first</span>
        </label>
      </div>

      {renderInlineEdit()}

      {deleteCandidate ? (
        <div className="workspace-file-browser-confirm">
          <span>Delete {deleteCandidate.paths[0]}</span>
          <strong>{deleteCandidate.recursive ? "Folder deletion is recursive." : "File deletion is permanent."}</strong>
          <button type="button" onClick={() => void confirmDelete()}>
            Confirm Delete
          </button>
          <button type="button" onClick={() => setDeleteCandidate(null)}>
            Cancel
          </button>
        </div>
      ) : null}

      {errorText ? <div className="workspace-degraded workspace-degraded--inline">{errorText}</div> : null}
      {statusText ? <div className="workspace-file-browser-status">{statusText}</div> : null}

      <main className="workspace-file-browser-main">
        <div className="workspace-file-browser-tree" aria-label="Directory tree">
          <div className="workspace-file-browser-tree-row">
            {renderEntry(rootEntry, 0)}
          </div>
          {expandedPaths.has(state.browserRoot) ? null : rootCache?.loading ? (
            <div className="workspace-file-browser-empty">Loading...</div>
          ) : rootCache?.error ? (
            <div className="workspace-file-browser-empty">{rootCache.error}</div>
          ) : rootChildren.length > 0 ? (
            rootChildren.map((entry) => renderEntry(entry, 1))
          ) : (
            <div className="workspace-file-browser-empty">No entries returned.</div>
          )}
        </div>

        {searchActive ? (
          <div className="workspace-file-browser-directory" aria-label="Search results">
            <div className="workspace-file-browser-directory__heading">
              <strong>Search results</strong>
              <span>
                {searchState.kind === "loading"
                  ? `Searching... ${searchRuntimeSummary}`
                  : searchRuntimeSummary}
              </span>
              {searchState.kind === "loading" ? (
                <button
                  type="button"
                  onClick={() => cancelActiveSearch(searchState.searchId)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
            {searchSkipSummary ? (
              <div className="workspace-file-browser-search-diagnostic">{searchSkipSummary}</div>
            ) : null}
            {searchState.kind === "error" ? (
              <div className="workspace-file-browser-empty">{searchState.message}</div>
            ) : searchState.entries.length > 0 ? (
              <div className="workspace-file-browser-search-results">
                {searchState.entries.map((entry) => (
                  <button
                    type="button"
                    key={entry.path}
                    className={`workspace-file-browser-row ${state.selectedPath === entry.path ? "workspace-file-browser-row--selected" : ""}`}
                    onClick={() => selectEntry(entry)}
                    onDoubleClick={() => openEntry(entry)}
                    title={entry.path}
                  >
                    <span className="workspace-file-browser-row__disclosure" />
                    <span className="workspace-file-browser-row__icon">
                      <FileTypeIcon kind={classifyFileIcon(entry)} />
                    </span>
                    <span className="workspace-file-browser-row__name">{entry.path}</span>
                    <span className="workspace-file-browser-row__type">{entry.kind}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="workspace-file-browser-empty">No matching paths.</div>
            )}
          </div>
        ) : (
          <div className="workspace-file-browser-directory" aria-label="Directory contents">
            <div className="workspace-file-browser-directory__heading">
              <strong className="workspace-file-browser-breadcrumb">
                <button
                  type="button"
                  onClick={() => void navigateDirectory(parentPath(currentDirectoryPath))}
                  disabled={currentDirectoryPath === state.browserRoot}
                  title="Parent directory"
                >
                  Up
                </button>
                {breadcrumbs.map((segment, index) => (
                  <button
                    key={segment.path}
                    type="button"
                    onClick={() => {
                      if (isSameOrDescendantPath(segment.path, state.browserRoot)) {
                        void navigateDirectory(segment.path);
                      }
                    }}
                    disabled={!isSameOrDescendantPath(segment.path, state.browserRoot)}
                    title={segment.path}
                  >
                    {index === 0 ? segment.label : segment.label}
                  </button>
                ))}
              </strong>
              <span>{currentDirectoryChildren.length} entries</span>
            </div>
            {currentDirectoryCache?.loading ? (
              <div className="workspace-file-browser-empty">Loading...</div>
            ) : currentDirectoryCache?.error ? (
              <div className="workspace-file-browser-empty">{currentDirectoryCache.error}</div>
            ) : currentDirectoryChildren.length > 0 ? (
              <div className="workspace-file-browser-grid">
                {currentDirectoryChildren.map((entry) => (
                  <button
                    type="button"
                    key={entry.path}
                    className={`workspace-file-browser-grid-item ${state.selectedPath === entry.path ? "workspace-file-browser-grid-item--selected" : ""}`}
                    aria-pressed={state.selectedPath === entry.path}
                    onClick={() => selectEntry(entry)}
                    onDoubleClick={() => openEntry(entry)}
                    title={entry.path}
                  >
                    <span className="workspace-file-browser-grid-item__icon">
                      <FileTypeIcon kind={classifyFileIcon(entry)} />
                    </span>
                    <span className="workspace-file-browser-grid-item__name">{entry.name}</span>
                    <span className="workspace-file-browser-grid-item__type">
                      {entry.kind === "directory" ? "Folder" : entry.kind}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="workspace-file-browser-empty">Empty directory.</div>
            )}
          </div>
        )}
      </main>

      <footer className="workspace-file-browser-selection">
        <span>Selected</span>
        <div className="workspace-file-browser-selection__value">
          <code>{state.selectedPath || "No entry selected."}</code>
          <small>
            {selectedEntry
              ? `${selectedEntry.kind} · ${formatBytes(selectedEntry.size)} · ${formatModified(selectedEntry.modifiedMs)}${selectedEntry.readonly ? " · read-only" : ""}${selectedEntry.kind === "symlink" && selectedEntry.targetKind ? ` · target ${selectedEntry.targetKind}` : ""}`
              : state.selectedEntryKind
                ? `Selected type: ${state.selectedEntryKind}`
              : "Single-click an entry to select it."}
          </small>
        </div>
        <em aria-live="polite">
          {clipboard
            ? `${clipboard.mode === "copy" ? "Copy" : "Cut"} clipboard: ${clipboard.sourcePaths.join(", ")}`
            : "File operation clipboard is empty."}
        </em>
        <button
          type="button"
          onClick={() => {
            const entry = state.selectedPath
              ? findCachedEntry(state.selectedPath)
              : null;
            if (entry) openEntry(entry);
          }}
          disabled={!state.selectedPath || state.selectedEntryKind === "directory"}
        >
          Open selected
        </button>
      </footer>
    </div>
  );
}
