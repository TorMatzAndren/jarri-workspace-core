import type { DeveloperStatus } from "./developerStatus";
import type {
  UpdateProvider,
  UpdateProviderStatus,
} from "./updateAwareness";

export type CoreSourceReleaseContext = {
  sourceRepository: DeveloperStatus["sourceRepository"];
};

export type SourceReleaseMetadata = {
  schemaVersion: 1;
  version: string;
  releaseUrl?: string;
};

export type SourceReleaseProviderOptions = {
  metadataUrl?: string | null;
  getDeveloperStatus: () => Promise<DeveloperStatus>;
  fetchMetadata?: typeof fetch;
  isOffline?: () => boolean;
  now?: () => Date;
};

const PROVIDER = {
  providerId: "jarri.workspace-core.source-release",
  displayName: "Workspace Core source releases",
  capabilities: {
    checkForUpdates: true,
    installUpdate: false,
    restartAfterUpdate: false,
  },
} as const;

type ParsedVersion = {
  major: bigint;
  minor: bigint;
  patch: bigint;
  prerelease: string[] | null;
};

function parseVersion(input: string): ParsedVersion | null {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
    input,
  );
  if (!match) return null;

  const prerelease = match[4]?.split(".") ?? null;
  if (
    prerelease?.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith("0"))
  ) {
    return null;
  }

  return {
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    prerelease,
  };
}

function compareVersions(leftInput: string, rightInput: string): number | null {
  const left = parseVersion(leftInput);
  const right = parseVersion(rightInput);
  if (!left || !right) return null;

  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] < right[key]) return -1;
    if (left[key] > right[key]) return 1;
  }

  if (left.prerelease === null && right.prerelease === null) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;

  const count = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return BigInt(leftPart) < BigInt(rightPart) ? -1 : 1;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function secureUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseMetadata(input: unknown): SourceReleaseMetadata | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  const record = input as Record<string, unknown>;
  if (
    record.schemaVersion !== 1 ||
    typeof record.version !== "string" ||
    !parseVersion(record.version)
  ) {
    return null;
  }

  if (record.releaseUrl !== undefined && secureUrl(record.releaseUrl) === null) {
    return null;
  }

  return {
    schemaVersion: 1,
    version: record.version,
    ...(typeof record.releaseUrl === "string"
      ? { releaseUrl: secureUrl(record.releaseUrl) ?? undefined }
      : {}),
  };
}

function resultStatus(
  developerStatus: DeveloperStatus,
  state: UpdateProviderStatus<CoreSourceReleaseContext>["state"],
  values: Partial<UpdateProviderStatus<CoreSourceReleaseContext>> = {},
): UpdateProviderStatus<CoreSourceReleaseContext> {
  return {
    ...PROVIDER,
    state,
    currentVersion: developerStatus.applicationVersion,
    availableVersion: null,
    updateAvailable: null,
    lastSuccessfulCheck: null,
    releaseUrl: null,
    message: null,
    context: { sourceRepository: developerStatus.sourceRepository },
    ...values,
  };
}

export function createCoreSourceReleaseProvider({
  metadataUrl,
  getDeveloperStatus,
  fetchMetadata = fetch,
  isOffline = () => typeof navigator !== "undefined" && !navigator.onLine,
  now = () => new Date(),
}: SourceReleaseProviderOptions): UpdateProvider<CoreSourceReleaseContext> {
  const configuredMetadataUrl = metadataUrl?.trim() || null;

  return {
    ...PROVIDER,
    async check() {
      const developerStatus = await getDeveloperStatus();
      if (!configuredMetadataUrl) {
        return resultStatus(developerStatus, "unavailable", {
          message: "No source release metadata URL is configured.",
        });
      }

      const secureMetadataUrl = secureUrl(configuredMetadataUrl);
      if (!secureMetadataUrl) {
        return resultStatus(developerStatus, "error", {
          message: "Source release metadata URL must be a valid HTTPS URL.",
        });
      }

      let response: Response;
      try {
        response = await fetchMetadata(secureMetadataUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
        });
      } catch (error) {
        const offline = isOffline();
        return resultStatus(developerStatus, offline ? "offline" : "error", {
          message: offline
            ? "Network is offline; source release status is unavailable."
            : `Source release check failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      if (!response.ok) {
        return resultStatus(developerStatus, "error", {
          message: `Source release metadata request failed with HTTP ${response.status}.`,
        });
      }

      let rawMetadata: unknown;
      try {
        rawMetadata = await response.json();
      } catch {
        return resultStatus(developerStatus, "error", {
          message: "Source release metadata is not valid JSON.",
        });
      }

      const metadata = parseMetadata(rawMetadata);
      if (!metadata) {
        return resultStatus(developerStatus, "error", {
          message: "Source release metadata has an unsupported or malformed shape.",
        });
      }

      const comparison = compareVersions(
        developerStatus.applicationVersion,
        metadata.version,
      );
      if (comparison === null) {
        return resultStatus(developerStatus, "error", {
          message: "Installed application version is not valid semantic version data.",
        });
      }

      const updateAvailable = comparison < 0;
      return resultStatus(developerStatus, updateAvailable ? "available" : "current", {
        availableVersion: metadata.version,
        updateAvailable,
        lastSuccessfulCheck: now().toISOString(),
        releaseUrl: metadata.releaseUrl ?? null,
        message: updateAvailable
          ? `Version ${metadata.version} is available.`
          : "This installation matches the latest published source release.",
      });
    },
  };
}
