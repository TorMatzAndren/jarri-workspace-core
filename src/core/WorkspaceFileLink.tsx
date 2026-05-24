import { filePathToResourceUri } from "./resources";
import type { OpenResourceRequest, OpenResourceResult } from "./resources";

type Props = {
  path: string;
  label?: string;
  openResource: (request: OpenResourceRequest) => OpenResourceResult;
};

function basename(path: string) {
  return path.split("/").filter(Boolean).at(-1) || path;
}

export function WorkspaceFileLink({ path, label, openResource }: Props) {
  function handleClick() {
    try {
      openResource({
        uri: filePathToResourceUri(path),
        label: label ?? basename(path),
        preferredModuleId: "core",
        preferredPanelType: "file-editor",
        disposition: "reuse",
      });
    } catch {
      // Deliberately inert: callers should only pass known-good absolute paths.
    }
  }

  return (
    <button
      type="button"
      className="workspace-file-link"
      onClick={handleClick}
      title={path}
    >
      {label ?? path}
    </button>
  );
}
