import { invoke } from "@tauri-apps/api/core";

export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; detail?: string };

export type WorkspaceFilesystemEntryKind =
  | "file"
  | "directory"
  | "symlink"
  | "other";

export type WorkspaceFilesystemEntry = {
  path: string;
  parentPath?: string | null;
  name: string;
  kind: WorkspaceFilesystemEntryKind;
  targetKind?: WorkspaceFilesystemEntryKind | null;
  size?: number | null;
  modifiedMs?: number | null;
  readonly?: boolean;
  hidden?: boolean;
  hasChildren?: boolean | null;
  executable?: boolean;
};

export type WorkspaceFilesystemListPayload = {
  path: string;
  parentPath?: string | null;
  entries: WorkspaceFilesystemEntry[];
};

export type WorkspaceFilesystemSearchSource = "live" | "indexed" | string;

export type WorkspaceFilesystemSearchRequest = {
  root: string;
  query: string;
  includeHidden: boolean;
  limit: number;
  traversalLimit?: number;
  searchId?: string;
};

export type WorkspaceFilesystemSearchResult = {
  root: string;
  query: string;
  entries: WorkspaceFilesystemEntry[];
  source: WorkspaceFilesystemSearchSource;
  resultCount: number;
  complete: boolean;
  resultLimitReached: boolean;
  traversalLimitReached: boolean;
  skippedCount: number;
  skipped: Array<{ path: string; reason: string }>;
  entriesScanned?: number;
  directoriesScanned?: number;
  cancelled?: boolean;
  resultLimit?: number;
  traversalLimit?: number;
  statusText?: string;
  metadata?: unknown;
};

export type WorkspaceFilesystemOperationPayload = {
  affectedPaths: string[];
  message: string;
};

export type WorkspaceFilesystemTextPayload = {
  path: string;
  content: string;
  truncated: boolean;
  bytesRead: number;
  byteLimit: number;
};

export type WorkspaceFilesystemBinaryPayload = {
  path: string;
  contentBase64: string;
  truncated: boolean;
  bytesRead: number;
  byteLimit: number;
};

type TauriEnvelope<T> =
  | { ok: true; data: T }
  | {
      ok?: false;
      error?: string;
      message?: string;
      status?: string;
      data?: never;
    };

export interface WorkspaceFilesystemSearchProvider {
  search(
    request: WorkspaceFilesystemSearchRequest,
  ): Promise<ProviderResult<WorkspaceFilesystemSearchResult>>;
}

async function invokeWorkspaceFilesystem<T>(
  command: string,
  request: unknown,
): Promise<ProviderResult<T>> {
  try {
    const result = await invoke<TauriEnvelope<T>>(command, { request });
    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? result.message ?? `${command} failed.`,
        detail: result.status,
      };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    if (error && typeof error === "object") {
      const raw = error as {
        error?: unknown;
        message?: unknown;
        status?: unknown;
      };
      return {
        ok: false,
        error:
          typeof raw.error === "string"
            ? raw.error
            : typeof raw.message === "string"
              ? raw.message
              : `${command} failed.`,
        detail: typeof raw.status === "string" ? raw.status : undefined,
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const workspaceFilesystemProvider = {
  list(
    path: string,
    showHidden = false,
  ): Promise<ProviderResult<WorkspaceFilesystemListPayload>> {
    return invokeWorkspaceFilesystem("workspace_fs_list", {
      path,
      showHidden,
    });
  },

  stat(path: string): Promise<ProviderResult<WorkspaceFilesystemEntry>> {
    return invokeWorkspaceFilesystem("workspace_fs_stat", { path });
  },

  search(
    request: WorkspaceFilesystemSearchRequest,
  ): Promise<ProviderResult<WorkspaceFilesystemSearchResult>> {
    return invokeWorkspaceFilesystem("workspace_fs_search", {
      rootPath: request.root,
      query: request.query,
      showHidden: request.includeHidden,
      limit: request.limit,
      traversalLimit: request.traversalLimit,
      searchId: request.searchId,
    });
  },

  searchCancel(
    searchId: string,
  ): Promise<ProviderResult<{ cancelled: boolean }>> {
    return invokeWorkspaceFilesystem("workspace_fs_search_cancel", { searchId });
  },

  copy(
    sourcePaths: string[],
    destinationDirectory: string,
  ): Promise<ProviderResult<WorkspaceFilesystemOperationPayload>> {
    return invokeWorkspaceFilesystem("workspace_fs_copy", {
      sourcePaths,
      destinationDirectory,
    });
  },

  move(
    sourcePaths: string[],
    destinationDirectory: string,
  ): Promise<ProviderResult<WorkspaceFilesystemOperationPayload>> {
    return invokeWorkspaceFilesystem("workspace_fs_move", {
      sourcePaths,
      destinationDirectory,
    });
  },

  rename(
    path: string,
    newName: string,
  ): Promise<ProviderResult<WorkspaceFilesystemOperationPayload>> {
    return invokeWorkspaceFilesystem("workspace_fs_rename", {
      path,
      newName,
    });
  },

  createDirectory(
    parentPath: string,
    name: string,
  ): Promise<ProviderResult<WorkspaceFilesystemOperationPayload>> {
    return invokeWorkspaceFilesystem("workspace_fs_create_directory", {
      parentPath,
      name,
    });
  },

  delete(
    paths: string[],
    recursive: boolean,
  ): Promise<ProviderResult<WorkspaceFilesystemOperationPayload>> {
    return invokeWorkspaceFilesystem("workspace_fs_delete", {
      paths,
      recursive,
    });
  },

  readText(
    path: string,
    byteLimit = 1_000_000,
  ): Promise<ProviderResult<WorkspaceFilesystemTextPayload>> {
    return invokeWorkspaceFilesystem("workspace_fs_read_text", {
      path,
      byteLimit,
    });
  },

  readBinary(
    path: string,
    byteLimit = 10_000_000,
  ): Promise<ProviderResult<WorkspaceFilesystemBinaryPayload>> {
    return invokeWorkspaceFilesystem("workspace_fs_read_binary", {
      path,
      byteLimit,
    });
  },
};
