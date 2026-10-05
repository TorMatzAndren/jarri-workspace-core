import { useCallback, useEffect, useRef, useState } from "react";
import type { PanelBodyProps } from "../../../core/types";
import {
  adoptWorkspaceX11Window,
  releaseWorkspaceX11Window,
} from "../../../core/platform/nativeSurface";
import { useWorkspaceNativeSurfaceMount } from "../../../core/platform/nativeSurfaceMount";
import {
  findOrLaunchSteamClient,
  type SteamClientWindow,
} from "../steamClientApi";

type SteamClientPanelState = {
  windowId?: string;
  released?: boolean;
};

function readState(value: unknown): SteamClientPanelState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const record = value as {
    windowId?: unknown;
    released?: unknown;
  };

  return {
    ...(typeof record.windowId === "string"
      ? { windowId: record.windowId }
      : {}),
    ...(record.released === true ? { released: true } : {}),
  };
}

export function SteamClientPanel({ panel, updatePanelState }: PanelBodyProps) {
  const {
    mountRef,
    surface,
    error: surfaceError,
  } = useWorkspaceNativeSurfaceMount(panel.id);

  const state = readState(panel.panelState);

  const connectionAttemptRef = useRef<string>("");

  const [client, setClient] = useState<SteamClientWindow | null>(null);

  const [status, setStatus] = useState("Preparing native surface…");

  const [error, setError] = useState("");

  const connect = useCallback(async () => {
    if (!surface) {
      return;
    }

    setError("");
    setStatus("Connecting Steam to Workspace…");

    try {
      if (state.windowId) {
        try {
          await adoptWorkspaceX11Window(surface.surfaceId, state.windowId);

          setClient(
            (current) =>
              current ?? {
                windowId: state.windowId ?? "",
                pid: null,
                title: "Steam",
                launched: false,
              },
          );

          setStatus(`Hosted ${state.windowId}`);

          return;
        } catch {
          /*
           * A remembered X11 id can become
           * stale if Steam restarted.
           * Fall through to authoritative
           * Steam window discovery.
           */
        }
      }

      const discovered = await findOrLaunchSteamClient();

      await adoptWorkspaceX11Window(surface.surfaceId, discovered.windowId);

      setClient(discovered);

      updatePanelState({
        windowId: discovered.windowId,
      });

      setStatus(
        discovered.launched
          ? `Steam launched and hosted · ${discovered.windowId}`
          : `Steam hosted · ${discovered.windowId}`,
      );
    } catch (cause) {
      setError(String(cause));
      setStatus("Steam client host unavailable");
    }
  }, [state.windowId, surface, updatePanelState]);

  useEffect(() => {
    if (!surface || state.released) {
      return;
    }

    const key = `${surface.surfaceId}:${state.windowId ?? ""}`;

    if (connectionAttemptRef.current === key) {
      return;
    }

    connectionAttemptRef.current = key;

    void connect();
  }, [connect, state.released, state.windowId, surface]);

  async function release() {
    if (!surface) {
      return;
    }

    try {
      await releaseWorkspaceX11Window(surface.surfaceId);

      updatePanelState({
        ...(client?.windowId || state.windowId
          ? {
              windowId: client?.windowId ?? state.windowId,
            }
          : {}),
        released: true,
      });

      setClient(null);
      setStatus("Steam released to desktop");
      setError("");

      connectionAttemptRef.current = `released:${surface.surfaceId}`;
    } catch (cause) {
      setError(String(cause));
    }
  }

  function reconnect() {
    if (!surface) {
      return;
    }

    connectionAttemptRef.current = "";

    updatePanelState({
      ...(state.windowId ? { windowId: state.windowId } : {}),
      released: false,
    });

    setStatus("Connecting Steam to Workspace…");
    setError("");
  }

  return (
    <div
      className="panel-body"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          flex: "0 0 auto",
        }}
      >
        <strong>Steam Native Client</strong>

        <span
          style={{
            opacity: 0.72,
            fontSize: "0.9em",
          }}
        >
          {status}
        </span>

        <span style={{ flex: 1 }} />

        <button type="button" onClick={reconnect} disabled={!surface}>
          Reconnect
        </button>

        <button
          type="button"
          onClick={() => {
            void release();
          }}
          disabled={!surface || !client}
        >
          Release
        </button>
      </div>

      {surfaceError || error ? (
        <div
          style={{
            flex: "0 0 auto",
            padding: 8,
            border: "1px solid currentColor",
            opacity: 0.9,
          }}
        >
          {surfaceError || error}
        </div>
      ) : null}

      <div
        ref={mountRef}
        style={{
          position: "relative",
          flex: "1 1 auto",
          minWidth: 1,
          minHeight: 1,
          overflow: "hidden",
          background: "#000",
        }}
      />
    </div>
  );
}
