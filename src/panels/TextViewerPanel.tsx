import { useEffect, useMemo, useState } from "react";
import { workspaceFilesystemProvider } from "../core/filesystemProvider";
import {
  base64ContentLooksLikeUtf8Text,
  TEXT_CONTENT_PROBE_BYTE_LIMIT,
} from "../core/textContent";
import {
  resourceUriToFilePath,
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
    resourceUriToFilePath(input.resourceUri)
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

    void (async () => {
      const probe = await workspaceFilesystemProvider.readBinary(
        path,
        TEXT_CONTENT_PROBE_BYTE_LIMIT,
      );

      if (cancelled) return;

      if (!probe.ok) {
        setStatus("error");
        setContent("");
        setMessage(
          probe.detail
            ? `${probe.error} (${probe.detail})`
            : probe.error,
        );
        return;
      }

      if (
        !base64ContentLooksLikeUtf8Text(
          probe.data.contentBase64,
          probe.data.truncated,
        )
      ) {
        setStatus("error");
        setContent("");
        setMessage(`File does not appear to contain UTF-8 text: ${path}`);
        return;
      }

      const result = await workspaceFilesystemProvider.readText(path);

      if (cancelled) return;

      if (!result.ok) {
        setStatus("error");
        setContent("");
        setMessage(
          result.detail
            ? `${result.error} (${result.detail})`
            : result.error,
        );
        return;
      }

      setStatus("ready");
      setContent(result.data.content);
      setMessage(
        result.data.truncated
          ? `Showing first ${result.data.bytesRead} bytes of ${path}.`
          : path,
      );
    })();

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
