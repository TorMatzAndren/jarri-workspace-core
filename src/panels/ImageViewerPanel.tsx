import { convertFileSrc } from "@tauri-apps/api/core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { PanelBodyProps } from "../core/types";
import {
  filePathToResourceUri,
  resourceUriToFilePath,
  resourceUriToImageFilePath,
  type ResourceUri,
} from "../core/resources";

export type ImageViewerPanelState = {
  resourceUri: ResourceUri | "";
};

export type ImageViewportState = {
  zoom: number;
  panX: number;
  panY: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};

export const IMAGE_VIEWER_MIN_ZOOM = 0.25;
export const IMAGE_VIEWER_MAX_ZOOM = 16;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampImageViewerZoom(value: number): number {
  return clamp(value, IMAGE_VIEWER_MIN_ZOOM, IMAGE_VIEWER_MAX_ZOOM);
}

export function normalizeImageViewerState(input: unknown): ImageViewerPanelState {
  if (!isRecord(input)) {
    return { resourceUri: "" };
  }

  if (
    typeof input.resourceUri === "string" &&
    resourceUriToImageFilePath(input.resourceUri)
  ) {
    return { resourceUri: input.resourceUri as ResourceUri };
  }

  if (
    typeof input.selectedPath === "string" &&
    input.selectedPath.trim().startsWith("/") &&
    resourceUriToImageFilePath(filePathToResourceUri(input.selectedPath))
  ) {
    return { resourceUri: filePathToResourceUri(input.selectedPath) };
  }

  return { resourceUri: "" };
}

export function nextImageViewerViewportFromWheel(
  current: ImageViewportState,
  deltaY: number,
  pointerX: number,
  pointerY: number,
  boundsWidth: number,
  boundsHeight: number,
): ImageViewportState {
  const zoomFactor = Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
  const nextZoom = clampImageViewerZoom(current.zoom * zoomFactor);

  if (nextZoom === current.zoom) {
    return current;
  }

  const ratio = nextZoom / current.zoom;
  const centerX = boundsWidth / 2;
  const centerY = boundsHeight / 2;

  const pointerFromImageCenterX = pointerX - centerX - current.panX;
  const pointerFromImageCenterY = pointerY - centerY - current.panY;

  return {
    zoom: nextZoom,
    panX: current.panX + pointerFromImageCenterX * (1 - ratio),
    panY: current.panY + pointerFromImageCenterY * (1 - ratio),
  };
}

export function imageResourceUriToImageSource(uri: ResourceUri | string): string {
  const path = resourceUriToFilePath(uri);

  if (!path) {
    return String(uri);
  }

  return convertFileSrc(path);
}

export function ImageViewerPanel({ panel }: PanelBodyProps) {
  const state = useMemo(
    () => normalizeImageViewerState(panel.panelState),
    [panel.panelState],
  );

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const [loadError, setLoadError] = useState("");
  const [viewport, setViewport] = useState<ImageViewportState>({
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setViewport({ zoom: 1, panX: 0, panY: 0 });
    setLoadError("");
    dragRef.current = null;
    setDragging(false);
  }, [state.resourceUri]);

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!state.resourceUri || loadError) {
      return;
    }

    if (event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const bounds = element.getBoundingClientRect();
    setViewport((current) =>
      nextImageViewerViewportFromWheel(
        current,
        event.deltaY,
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        bounds.width,
        bounds.height,
      ),
    );
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!state.resourceUri || loadError || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: viewport.panX,
      startPanY: viewport.panY,
    };

    setDragging(true);
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setViewport((current) => ({
      ...current,
      panX: drag.startPanX + (event.clientX - drag.startClientX),
      panY: drag.startPanY + (event.clientY - drag.startClientY),
    }));
  }

  function finishDrag(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setDragging(false);
  }

  if (!state.resourceUri) {
    return (
      <div className="workspace-image-viewer">
        <div className="workspace-image-viewer__status">
          No image selected.
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="workspace-image-viewer">
        <div className="workspace-image-viewer__status">
          {loadError}
        </div>
      </div>
    );
  }

  const imageSrc = imageResourceUriToImageSource(state.resourceUri);
  const imagePath = resourceUriToFilePath(state.resourceUri) ?? state.resourceUri;

  return (
    <div
      ref={viewportRef}
      className="workspace-image-viewer"
      data-workspace-local-wheel-surface="true"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      data-dragging={dragging}
    >
      <img
        className="workspace-image-viewer__image"
        src={imageSrc}
        alt={imagePath}
        draggable={false}
        onError={() => setLoadError(`Unable to load image: ${imagePath}`)}
        style={{
          transform:
            `translate(${viewport.panX}px, ${viewport.panY}px) ` +
            `scale(${viewport.zoom})`,
        }}
      />

      <div className="workspace-image-viewer__zoom">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}
