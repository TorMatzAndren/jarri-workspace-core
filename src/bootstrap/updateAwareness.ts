import { getDeveloperStatus } from "../core/developerStatusApi";
import { createCoreSourceReleaseProvider } from "../core/sourceReleaseUpdateProvider";
import { createUpdateAwarenessService } from "../core/updateAwareness";

const metadataUrl = import.meta.env?.VITE_WORKSPACE_CORE_RELEASE_METADATA_URL;

/** Runtime-only update awareness; never stored in workspace layout state. */
export const updateAwareness = createUpdateAwarenessService(
  createCoreSourceReleaseProvider({ metadataUrl, getDeveloperStatus }),
);
