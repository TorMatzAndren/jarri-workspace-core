import { copyFileBrowserPath, normalizeFileBrowserState } from "./FileBrowserPanel";
import {
  ancestorDirectoryPaths,
  classifyFileIcon,
  createFileOperationClipboard,
  filterHiddenEntries,
  formatSearchSkipSummary,
  formatSearchRuntimeSummary,
  isDirectoryLikeEntry,
  resourceRequestForFile,
  searchEntriesByPath,
  searchResultIsCurrent,
  sortFileEntries,
  validateBrowserName,
  validatePasteDestination,
  type GenericFileEntry,
} from "../core/fileBrowserModel";

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, received ${String(actual)}`,
    );
  }
}

async function testSelectedPathIsCopiedExactly() {
  let copiedText = "";

  const result = await copyFileBrowserPath(
    "  /opt/jarri/docs/example.md  ",
    async (text) => {
      copiedText = text;
    },
  );

  assertEqual(result.kind, "copied", "selected path copy succeeds");
  assertEqual(
    copiedText,
    "/opt/jarri/docs/example.md",
    "selected path is trimmed and copied exactly",
  );
  assertEqual(
    result.message,
    "Copied path: /opt/jarri/docs/example.md",
    "successful copy returns visible feedback",
  );
}

async function testDirectoryPathCanBeCopied() {
  let copiedText = "";

  const result = await copyFileBrowserPath(
    "/opt/jarri/docs",
    async (text) => {
      copiedText = text;
    },
  );

  assertEqual(result.kind, "copied", "directory path copy succeeds");
  assertEqual(
    copiedText,
    "/opt/jarri/docs",
    "directory path is copied exactly",
  );
}

async function testBlankSelectionIsUnavailable() {
  let writes = 0;

  const result = await copyFileBrowserPath("   ", async () => {
    writes += 1;
  });

  assertEqual(result.kind, "unavailable", "blank selection is unavailable");
  assertEqual(writes, 0, "blank selection does not invoke clipboard");
}

async function testClipboardFailureIsReported() {
  const result = await copyFileBrowserPath(
    "/opt/jarri/docs/example.md",
    async () => {
      throw new Error("clipboard unavailable");
    },
  );

  assertEqual(result.kind, "error", "clipboard failure is contained");
  assertEqual(
    result.message,
    "Copy path failed.",
    "clipboard failure returns bounded feedback",
  );
}

function testFileTypeIconClassification() {
  assertEqual(
    classifyFileIcon({ path: "/tmp/image.png", kind: "file" }),
    "image",
    "image extension gets image icon",
  );
  assertEqual(
    classifyFileIcon({ path: "/tmp/source.tsx", kind: "file" }),
    "text",
    "source extension gets text icon",
  );
  assertEqual(
    classifyFileIcon({ path: "/tmp/archive.zip", kind: "file" }),
    "archive",
    "archive extension gets archive icon",
  );
  assertEqual(
    classifyFileIcon({ path: "/tmp/config.toml", kind: "file" }),
    "config",
    "toml gets config icon",
  );
  assertEqual(
    classifyFileIcon({ path: "/tmp/link", kind: "symlink" }),
    "symlink",
    "symlink gets symlink icon",
  );
  assertEqual(
    classifyFileIcon({ path: "/tmp/folder", kind: "directory" }, true),
    "folder-open",
    "expanded directory gets open folder icon",
  );
}

function testDirectoriesFirstSortingAndHiddenFiltering() {
  const entries: GenericFileEntry[] = [
    { path: "/root/z.txt", name: "z.txt", kind: "file" },
    { path: "/root/.secret", name: ".secret", kind: "file", hidden: true },
    { path: "/root/alpha", name: "alpha", kind: "directory" },
    { path: "/root/Beta.txt", name: "Beta.txt", kind: "file" },
  ];

  const visible = sortFileEntries(filterHiddenEntries(entries, false));
  assertEqual(visible[0].path, "/root/alpha", "directories sort first");
  assertEqual(visible[1].path, "/root/Beta.txt", "files sort case-insensitively");
  assertEqual(visible.length, 3, "hidden files are filtered by default");
  assertEqual(filterHiddenEntries(entries, true).length, 4, "hidden files can be shown");
}

function testSearchFilteringAndOrdering() {
  const entries: GenericFileEntry[] = [
    { path: "/root/beta.txt", name: "beta.txt", kind: "file" },
    { path: "/root/alpha", name: "alpha", kind: "directory" },
    { path: "/root/.alpha-secret", name: ".alpha-secret", kind: "file", hidden: true },
  ];
  const visible = searchEntriesByPath(entries, "alpha", false);
  assertEqual(visible.length, 1, "hidden search result is filtered");
  assertEqual(visible[0].path, "/root/alpha", "directory search result is returned");
  assertEqual(searchEntriesByPath(entries, "alpha", true).length, 2, "hidden search can be included");
}

function testOperationValidationAndClipboard() {
  const copy = createFileOperationClipboard(
    "copy",
    ["/tmp/source.txt"],
    "panel-a",
    "2026-08-23T00:00:00.000Z",
  );
  assertEqual(copy?.mode, "copy", "copy clipboard stores mode");
  assertEqual(copy?.sourcePanelId, "panel-a", "copy clipboard stores source panel");

  const cut = createFileOperationClipboard(
    "cut",
    ["/tmp/source.txt"],
    "panel-a",
    "2026-08-23T00:01:00.000Z",
  );
  assertEqual(cut?.mode, "cut", "cut clipboard stores mode");

  assertEqual(
    validatePasteDestination({
      mode: "copy",
      sourcePaths: ["/tmp/source"],
      sourceEntries: [{ path: "/tmp/source", kind: "directory" }],
      destinationDirectory: "/tmp/source/child",
    }).ok,
    false,
    "self-copy is rejected",
  );
  assertEqual(
    validatePasteDestination({
      mode: "cut",
      sourcePaths: ["/tmp/source"],
      sourceEntries: [{ path: "/tmp/source", kind: "directory" }],
      destinationDirectory: "/tmp/source/child",
    }).ok,
    false,
    "ancestor to descendant move is rejected",
  );
  assertEqual(
    validatePasteDestination({
      mode: "copy",
      sourcePaths: ["/tmp/source-link"],
      sourceEntries: [{ path: "/tmp/source-link", kind: "symlink", targetKind: "directory" }],
      destinationDirectory: "/tmp/source-link/child",
    }).ok,
    false,
    "symlink directory self-copy is rejected",
  );
  assertEqual(
    validatePasteDestination({
      mode: "copy",
      sourcePaths: ["/tmp/source"],
      sourceEntries: [{ path: "/tmp/source", kind: "file" }],
      destinationDirectory: "/tmp/source/child",
    }).ok,
    true,
    "plain files are not treated as containers by paste validation",
  );
  assertEqual(
    copy?.sourceEntries?.length,
    undefined,
    "clipboard source entry metadata remains optional for restored state compatibility",
  );
}

function testDirectoryLikeSymlinkBehavior() {
  assertEqual(
    isDirectoryLikeEntry({ kind: "directory" }),
    true,
    "directories are navigable containers",
  );
  assertEqual(
    isDirectoryLikeEntry({ kind: "symlink", targetKind: "directory" }),
    true,
    "symlinks to directories are navigable containers",
  );
  assertEqual(
    isDirectoryLikeEntry({ kind: "symlink", targetKind: "file" }),
    false,
    "symlinks to files open as resources",
  );
}

function testRenameValidationAndResourceRoutingRequest() {
  assertEqual(validateBrowserName("renamed.txt").ok, true, "plain rename is valid");
  assertEqual(validateBrowserName("../bad").ok, false, "path separator rename is rejected");

  const textRequest = resourceRequestForFile("/tmp/readme.md", "readme.md");
  assertEqual(textRequest.preferredModuleId, "core", "text files route to Core");
  assertEqual(textRequest.preferredPanelType, "text-viewer", "text files route to text viewer");

  const imageRequest = resourceRequestForFile("/tmp/image.png", "image.png");
  assertEqual(imageRequest.preferredModuleId, "core", "images route to Core");
  assertEqual(imageRequest.preferredPanelType, "image-viewer", "images route to image viewer");
}

function testStateNormalizationPreservesUsefulNavigationState() {
  const state = normalizeFileBrowserState({
    selectedRootPath: "/tmp/browser-a",
    currentDirectoryPath: "/tmp/browser-a/folder",
    selectedPath: "/tmp/browser-a/file.txt",
    selectedEntryType: "file",
    expandedDirs: ["/tmp/browser-a"],
    showHidden: true,
    searchQuery: "file",
    visibleMode: "docs",
    expandedDocGroups: ["legacy"],
  });

  assertEqual(state.browserRoot, "/tmp/browser-a", "root path persists per panel");
  assertEqual(state.currentDirectoryPath, "/tmp/browser-a/folder", "current directory persists per panel");
  assertEqual(state.selectedPath, "/tmp/browser-a/file.txt", "selection persists per panel");
  assertEqual(state.selectedEntryKind, "file", "selection kind persists");
  assertEqual(state.expandedPaths.length, 1, "expanded paths persist");
  assertEqual(state.showHidden, true, "hidden preference persists");
  assertEqual(state.search.query, "file", "search query persists");
}

function testStateNormalizationDefaultsCurrentDirectoryToRoot() {
  const state = normalizeFileBrowserState({
    selectedRootPath: "/tmp/browser-a",
  });

  assertEqual(
    state.currentDirectoryPath,
    "/tmp/browser-a",
    "current directory defaults to selected root",
  );
}

function testDirectoryAncestorExpansionIsStable() {
  const ancestors = ancestorDirectoryPaths("/tmp/browser-a/folder/child", "/tmp/browser-a");

  assertEqual(ancestors.length, 3, "ancestor expansion includes root and descendants");
  assertEqual(ancestors[0], "/tmp/browser-a", "ancestor expansion starts at browser root");
  assertEqual(ancestors[2], "/tmp/browser-a/folder/child", "ancestor expansion includes target");
}

function testSearchSkipDiagnosticProjection() {
  assertEqual(
    formatSearchSkipSummary([]),
    "",
    "empty skipped search diagnostic is hidden",
  );
  assertEqual(
    formatSearchSkipSummary([
      { path: "/etc/libvirt/secrets", reason: "Permission denied" },
      { path: "/root", reason: "Permission denied" },
    ]),
    "2 subtrees skipped: /etc/libvirt/secrets (Permission denied)",
    "skipped search diagnostic exposes count and first deterministic path",
  );
}

function testSearchRuntimeSummarySeparatesStopReasons() {
  assertEqual(
    formatSearchRuntimeSummary({
      matches: 200,
      entriesScanned: 820,
      resultLimitReached: true,
    }),
    "200 matches · 820 scanned · result limit reached",
    "result-limit summary is explicit",
  );
  assertEqual(
    formatSearchRuntimeSummary({
      matches: 0,
      entriesScanned: 25000,
      traversalLimitReached: true,
    }),
    "0 matches · 25000 scanned · search traversal limit reached",
    "traversal-limit summary is explicit",
  );
  assertEqual(
    formatSearchRuntimeSummary({
      matches: 34,
      skippedCount: 7,
    }),
    "34 matches · 7 subtrees skipped",
    "skipped summary remains distinct",
  );
  assertEqual(
    formatSearchRuntimeSummary({
      matches: 417,
      source: "indexed",
      statusText: "coherent",
    }),
    "417 matches · indexed · coherent",
    "indexed search summary exposes source and generic status",
  );
  assertEqual(
    formatSearchRuntimeSummary({
      matches: 12,
      source: "live",
      entriesScanned: 25000,
      traversalLimitReached: true,
    }),
    "12 matches · live · 25000 scanned · search traversal limit reached",
    "live search summary exposes traversal limits",
  );
}

function testSearchStalenessGuard() {
  assertEqual(
    searchResultIsCurrent("search-2", "search-2"),
    true,
    "current search may publish",
  );
  assertEqual(
    searchResultIsCurrent("search-1", "search-2"),
    false,
    "stale search cannot publish over newer state",
  );
  assertEqual(
    searchResultIsCurrent("search-1", null),
    false,
    "cleared search cannot publish",
  );
}

async function main() {
  await testSelectedPathIsCopiedExactly();
  await testDirectoryPathCanBeCopied();
  await testBlankSelectionIsUnavailable();
  await testClipboardFailureIsReported();
  testFileTypeIconClassification();
  testDirectoriesFirstSortingAndHiddenFiltering();
  testSearchFilteringAndOrdering();
  testOperationValidationAndClipboard();
  testDirectoryLikeSymlinkBehavior();
  testRenameValidationAndResourceRoutingRequest();
  testStateNormalizationPreservesUsefulNavigationState();
  testStateNormalizationDefaultsCurrentDirectoryToRoot();
  testDirectoryAncestorExpansionIsStable();
  testSearchSkipDiagnosticProjection();
  testSearchRuntimeSummarySeparatesStopReasons();
  testSearchStalenessGuard();
  console.log("File Browser Copy Path tests passed");
}

void main();
