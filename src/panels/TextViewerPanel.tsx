import { useEffect, useMemo, useState } from "react";
import { workspaceFilesystemProvider } from "../core/filesystemProvider";
import {
  resourceUriToFilePath,
  resourceUriToTextFilePath,
  type ResourceUri,
} from "../core/resources";
import type { PanelBodyProps } from "../core/types";

export type TextViewerPanelState = {
  resourceUri: ResourceUri | "";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeTextViewerState(input: unknown): TextViewerPanelState {
  if (!isRecord(input)) return { resourceUri: "" };
  if (
    typeof input.resourceUri === "string" &&
    resourceUriToTextFilePath(input.resourceUri)
  ) {
    return { resourceUri: input.resourceUri as ResourceUri };
  }
  return { resourceUri: "" };
}

export function TextViewerPanel({ panel }: PanelBodyProps) {
  const state = useMemo(
    () => normalizeTextViewerState(panel.panelState),
    [panel.panelState],
  );
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const path = state.resourceUri ? resourceUriToFilePath(state.resourceUri) : null;
    if (!path) {
      setContent("");
      setStatus("idle");
      setMessage("No text resource selected.");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setMessage("");
    void workspaceFilesystemProvider.readText(path).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setStatus("error");
        setContent("");
        setMessage(result.detail ? `${result.error} (${result.detail})` : result.error);
        return;
      }
      setStatus("ready");
      setContent(result.data.content);
      setMessage(
        result.data.truncated
          ? `Showing first ${result.data.bytesRead} bytes of ${path}.`
          : path,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [state.resourceUri]);

  return (
    <div className="panel-body workspace-text-viewer">
      <header className="workspace-text-viewer__header">
        <strong>{state.resourceUri ? resourceUriToFilePath(state.resourceUri) : "Text Viewer"}</strong>
        <span>{status === "loading" ? "Loading..." : message}</span>
      </header>
      {status === "error" ? (
        <div className="workspace-text-viewer__error">{message}</div>
      ) : (
        <pre className="workspace-text-viewer__content">{content}</pre>
      )}
    </div>
  );
}
