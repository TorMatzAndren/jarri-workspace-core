# Spatial Workspace Architecture

Project: Jarri Workspace Core 0.4.0

Implementation checkpoint:
f83bdf9 — establish spatial organization and persistent canvas geometry

Status: Implemented geometry foundation.

## Overview

Jarri Workspace Core provides a logical spatial canvas containing
independently positioned and sized panels.

Four responsibilities are kept separate:

1. Canvas bounds define the logical workspace area.
2. Panel geometry defines panel positions and dimensions.
3. Camera and zoom control the viewport.
4. Spatial Organize proposes arrangements within the canvas.

The workspace is not a conventional desktop tiling system.

The implementation supports negative logical coordinates and
independent canvas, panel, and camera geometry.

## Architecture

Primary implementation files:

- src/core/types.ts
- src/core/layoutEngine.ts
- src/core/layoutPersistence.ts
- src/core/workspaceController.ts
- src/core/workspaceCanvasBounds.ts
- src/core/spatialLayoutSearch.ts
- src/core/spatialLayoutMetrics.ts
- src/core/panelArrangement.ts
- src/core/panelArrangementPreserve.ts
- src/workspace/WorkspaceCanvas.tsx

## Coordinate model

### Canvas

Canvas bounds consist of:

- x
- y
- width
- height

Canvas coordinates may be negative.

The canvas origin need not be logical (0,0).

The canvas represents available space, not a region the organizer
must completely fill.

### Panels

Each panel owns:

- Logical X/Y position
- Width and height
- Applicable minimum dimensions

Panel coordinates may be negative.

Panel geometry is independent of viewport coordinates.

### Camera and zoom

The camera determines which logical region is visible.

Zoom determines how logical distances map to screen distances.

Moving the camera must not alter panel positions or canvas dimensions.

## Canvas resizing

Canvas dimensions are controlled by the user.

Current minimum width: 900 logical pixels.
Current minimum height: 700 logical pixels.
Canvas grid: 24 logical pixels.

Grid alignment may result in a minimum aligned height of 720 pixels.

Bounds calculations respect the proposed canvas origin.

They must not impose a false minimum based on global logical (0,0).

Panel containment constrains canvas contraction.

There is no artificial 48-pixel clearance requirement around panels.

Panel movement or resizing does not automatically contract the canvas.

## Spatial Organize

### Design objective

Preserve Sizes organization aims to produce:

A compact, non-overlapping cluster of panels whose bounding rectangle
approximates the logical canvas aspect ratio.

The organizer does not attempt to fill the entire canvas.

The primary optimization target is the shape and compactness of the
occupied panel cluster.

### Preserve Sizes contract

Preserve Sizes organization must retain:

- Panel widths and heights
- Canvas origin and dimensions
- Camera coordinates
- Zoom

Only eligible panel positions may change.

### Spacing

Organize supports a configurable gap expressed in 24-pixel grid units.

Current range: 0 through 4 grid units.

Default: 0.

### Search and fallback

The spatial search handles small panel sets.

The current interactive search threshold is eight panels.

Larger sets use a deterministic arrangement fallback.

Proposed results must satisfy geometry validation before commitment.

Failed arrangements must not partially modify workspace geometry.

### Organize, Unlock and Restore

Organize creates an arrangement and retains an original-layout
restoration snapshot.

Unlock preserves the organized layout while returning to ordinary
manual panel interactions.

Restore returns the captured pre-organization arrangement.

These operations do not own canvas sizing or camera navigation.

### Uniform Organize

Uniform Organize has a separate sizing and arrangement policy.

Its behavior must not be confused with the Preserve Sizes contract.

Uniform mode is outside the verified spatial-search milestone and
requires its own functional validation before further promotion.

## Persistence

Persistence preserves:

- Tab canvas bounds
- Camera coordinates
- Zoom
- Panel positions
- Panel dimensions

Valid negative panel coordinates must survive load/save/reload cycles.

Geometry normalization must not collapse separate negative positions
into overlapping coordinates at zero.

Canvas origin must be respected when reconstructing bounds.

Loading valid persisted data must not produce destructive coordinate
changes merely because the application restarted.

## Geometry invariants

1. Panel geometry is separate from viewport geometry.
2. Canvas dimensions are independent of organizer results.
3. Preserve Sizes organization never changes panel dimensions.
4. Negative logical coordinates are valid.
5. A committed arrangement must pass collision and boundary checks.
6. Invalid organization must not partially commit geometry.
7. Canvas contraction must not depend on a global-origin floor.
8. Valid saved geometry must survive restart without collapsing.

## Verification

Relevant commands:

    npm run build
    npm run test:core
    npm run test:appearance-contracts
    npm run test:architecture-boundary
    git diff --check

Focused test files:

- src/core/layoutPersistence.test.ts
- src/core/tabTemplates.test.ts
- src/core/workspaceController.test.ts
- src/core/workspaceCanvasBounds.test.ts
- src/core/workspaceOrganizeSpatial.test.ts
- src/core/spatialLayoutSearch.test.ts
- src/core/spatialLayoutMetrics.test.ts
- src/core/panelArrangementPreserve.test.ts
- src/core/negativeCoordinateDrag.test.ts

Native acceptance additionally covers:

- Manual panel movement
- Manual panel resizing
- Manual canvas resizing
- Spatial organization
- Cold application restart
- Persisted geometry restoration

## Troubleshooting

When a layout appears incorrectly positioned, investigate
the following independently.

### Persisted geometry

Inspect saved panel coordinates and dimensions.

Determine whether distinct positions were collapsed during loading.

### Canvas bounds

Inspect canvas origin, dimensions, minimum bounds, and panel extents.

Confirm origin-relative normalization.

### Camera and zoom

Determine whether a visible displacement is caused by the camera
rather than by changes to logical panel positions.

### Spatial Organize

Inspect the proposed placement, canvas containment,
collision validation, and stationary obstacles.

Back up browser or WebKit workspace storage before any destructive
layout recovery procedure.

## Planned: Organize Lock

Organize Lock is not implemented in this milestone.

Its intended integration point is the existing Frame Controls
architecture.

An Organize-locked panel should:

- Remain stationary during automatic organization.
- Continue supporting ordinary manual movement and resizing.
- Act as a stationary obstacle for other organized panels.

Organize Lock must not be implemented by globally disabling
normal panel movement or resizing.

## Milestone

Implementation commit:

f83bdf9 feat(core): establish spatial organization and persistent canvas geometry

This checkpoint establishes the geometry foundation for subsequent
workspace organization features.
