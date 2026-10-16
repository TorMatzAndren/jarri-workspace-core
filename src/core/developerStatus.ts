export type DeveloperStatusErrorCode =
  | "sourceUnavailable"
  | "notRepository"
  | "gitUnavailable"
  | "commandFailed"
  | "invalidOutput";

export type DeveloperStatusRepository = {
  available: boolean;
  branch: string | null;
  detachedHead: boolean;
  shortCommit: string | null;
  workingTreeClean: boolean | null;
  error: {
    code: DeveloperStatusErrorCode;
    message: string;
  } | null;
};

export type DeveloperReleaseAvailability = {
  state: "notChecked" | "available" | "current" | "unavailable";
  latestVersion: string | null;
  releaseUrl: string | null;
  checkedAt: string | null;
  error: string | null;
};

/** TypeScript shape of the Rust `developer_status` Tauri response. */
export type DeveloperStatus = {
  applicationVersion: string;
  sourceRepository: DeveloperStatusRepository;
  releaseAvailability: DeveloperReleaseAvailability;
};
