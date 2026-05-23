# Jarri Workspace Core Source Audit

## Scope

Investigation-only audit of three existing UI/codebases to extract reusable foundations for a future Jarri Workspace Core. No source project code was changed. This report focuses on workspace layouts, panels, tabs, high-density operational views, temporal/replay concepts, state persistence, visual hierarchy, and component boundaries.

Sources inspected:

- `/home/dretski/projects/spooty-hardened`
- `/opt/jarri/ui/workspace`
- `/home/dretski/projects/ChronoGit`

## Source Projects

### ChronoGit

- Frontend: React 19, Vite 7, TypeScript, Tauri 2.
- Entrypoints: `chronogit-app/src/main.tsx`, `chronogit-app/src/App.tsx`.
- Key organization:
  - `src/core`: workspace state, layout normalization, persistence helpers, runtime types, git action wrappers.
  - `src/panels`: Git-specific workflow panels such as Current State, Change Lists, Commit Preflight, Time Machine, Remote Actions, logs, notes.
  - `src/shell`, `src/tabs`, `src/workspace`: shell, tab bar, canvas wrappers.
- Build/package: `chronogit-app/package.json`, `chronogit-app/vite.config.ts`, `chronogit-app/src-tauri`.

### Jarri Workspace

- Frontend: React 19, Vite 8, TypeScript, Tauri 2, `react-rnd`, Three.js.
- Entrypoints: `app/src/main.tsx`, `app/src/App.tsx`, `app/src/shell/WorkspaceShell.tsx`.
- Key organization:
  - `app/src/core`: typed workspace state, state normalization and persistence, markdown TOC/link helpers, modals.
  - `app/src/panels`: panel frame, registry, snap behavior, browser, editor, git, audit, observatory, infrastructure, system stats, chrono-field.
  - `app/src/workspace`, `app/src/tabs`, `app/src/shell`: canvas, tabs, shell.
- Build/package: `app/package.json`, `app/vite.config.ts`, `app/src-tauri`.
- There is also a smaller `frontend/` Vite app, but the reusable workspace implementation is in `app/`.

### Jarri Spooty

- Frontend: Angular 19, Bulma, Font Awesome, RxJS, `@ngneat/elf`; backend NestJS.
- Entrypoints: `src/frontend/src/main.ts`, `src/frontend/src/app/app.component.ts`.
- Key organization:
  - `app.component.*`: current workspace shell, panel model, tab state, drag/resize behavior, archive and intake workflows.
  - `components/playlist-box`, `components/track-list`: high-density queue/history presentation.
  - `services`: playlist, track, archive, version, auth token interceptor.
- Build/package: root npm workspaces plus `src/frontend/angular.json`, `src/frontend/package.json`.

## Executive Findings

The best Jarri Workspace Core foundation is the Jarri Workspace panel engine, enriched with ChronoGit's doctrine-grade cognitive workflow patterns and Spooty's compact operational information design.

Jarri Workspace has the most reusable implementation shape: typed workspace state, tab state, `react-rnd` panel movement/resizing, z-index focus, localStorage normalization, panel registry, snap-to-sibling behavior, save-aware editor panels, filesystem/docs browser state, and module-specific panel state.

ChronoGit has the strongest product doctrine: truth strips, beginner/pro labeling, preflight before destructive or historical operations, local LLM as advisory context, temporal inspection through Time Machine, and Git-state-driven workflows. Its implementation is more monolithic than Jarri Workspace, but its concepts should become core doctrine.

Spooty contributes a practical middle layer: fixed-purpose workspace tabs, dense queue cards, progress strips, archive grouping, candidate inspection, compact metrics, and simple pointer-based drag/resize. Its single-file Angular workspace implementation should not be copied directly, but its information density and operational cards are valuable.

## ChronoGit Findings

ChronoGit models a workspace as tabs containing absolute-positioned panels:

- `WorkspaceTab`: `{ id, name, panels }`
- `PanelInstance`: `{ id, type, title, x, y, w, h }`
- `PanelType`: Git-domain panels such as `current-state`, `commit-preflight`, `change-lists`, `time-machine`, `remote-actions`, `branches`, logs, notes.

Its layout utilities in `workspaceLayout.ts` are small and durable:

- 12 px grid snapping.
- Type-based default panel sizes.
- State normalization that repairs missing IDs, invalid active tab IDs, missing panels, and invalid dimensions.
- Migration from older storage key in `App.tsx`.

The main cognitive workflow value is not the panel mechanics; it is the way panels encode Git as a sequence of observable truth states:

- `TruthStripPanel`: compact counts and remote state.
- `FlowStripPanel`: working files -> prepared changes -> snapshot.
- `ChangeListsPanel`: files grouped by risk, staged/working state, direct but guarded actions.
- `CommitPreflightPanel`: commit boundary before history creation.
- `RemoteActionsPanel`: preview and token-gated remote operations.
- `TimeMachinePanel`: commit history, changed files, file diffs, A/B comparisons, file lineage, selected hunk explanations, patch backup.
- System and LLM logs: session memory and advisory explanations separated from source truth.

Interaction model:

- The current shell has tabs and panel additions.
- Layout movement/resizing is present in state helpers and earlier code paths, but the current `WorkspaceCanvas` and `PanelFrame` are simpler wrappers. Do not assume mature docking here.
- The app uses a high-density command surface with many guarded actions and live refresh.

Reusable ideas:

- Truth-first panels with domain state summarized before controls.
- Preflight panels for irreversible or history-changing actions.
- Time Machine as a reusable temporal inspection primitive, not just a Git feature.
- Risk grouping and plain-language/pro-language toggles.
- Local LLM output as advisory log entries, never primary truth.
- Explicit remote/divergence state in the shell.

## Jarri Workspace Findings

Jarri Workspace is the strongest source for the reusable shell and panel substrate.

Core model:

- `WorkspaceState`: versioned state with `tabs`, `activeTabId`, and `editorDefaults`.
- `WorkspaceTab`: `{ id, title, panels }`.
- `WorkspacePanel`: `{ id, moduleId, panelType, title, x, y, width, height, zIndex, editor?, audit?, browser?, observatoryIndices? }`.
- Panel-specific state is attached under typed optional keys instead of being hidden inside component-local state.

Layout and interaction:

- `WorkspacePanelFrame` uses `react-rnd` for drag and resize.
- `bringPanelToFront` manages focus through z-index.
- `panelSnap.ts` snaps panel edges to sibling edges and canvas edges within a threshold.
- Minimum panel sizes and container edge snapping reduce layout drift.
- `WorkspaceShell` persists workspace scale and supports keyboard zoom.
- Editor panels use an offset-slot strategy to avoid stacking every opened document in the same place.

Persistence:

- `useWorkspace.ts` persists to `localStorage` under `jarri-workspace-state`.
- State has explicit versioning and migration/repair behavior.
- Editor, audit, browser, and observatory state each have normalization.
- Invalid/outdated audit results are reset rather than trusted.

Component boundaries:

- Shell owns global actions, tabs, scale, file opening, and modal orchestration.
- Canvas owns panel rendering and panel picker visibility.
- Panel frame owns windowing, panel chrome, save/close protection, and dispatch to concrete panel bodies.
- Panel registry owns available templates and default geometry.
- Concrete panels own domain rendering and async data loading.

Notable panels:

- Browser panel: filesystem/docs modes, expandable directory/doc groups, path normalization, error translation, scroll preservation.
- Editor panel: text editor plus markdown TOC/links inspector, adjustable split ratio, collapsed panes, dirty state, save modal.
- Audit panel: docs/scripts audit modes and persisted expanded groups.
- Observatory Indices: compact/wide profile selection, scaled canonical rendering, sparkline, metadata toggle, domain/index selectors.
- Chrono-Field: early 3D workspace concept; useful as an optional panel type, not core layout doctrine.

Reusable ideas:

- Module/panel type registry.
- Versioned layout serialization with defensive normalization.
- Panel-specific persisted state slots.
- Focus/z-index as a first-class workspace behavior.
- Save-aware close flow for dirty panels.
- Browser and editor as core workspace panels.
- Snap-to-sibling and snap-to-canvas behavior.
- Workspace scale as a user preference.

## Jarri Spooty Findings

Spooty is a focused product UI with a lighter workspace implementation.

Core model:

- `SpootyWorkspaceTabsState`: active tab plus tab-specific workspace states.
- Fixed tabs: `intake`, `archive`, `diagnostics`.
- Panel instances: `{ id, type, title, x, y, w, h }`.
- Panel types: `source-intake`, `queue-observatory`, `playlist-history`, `single-songs`, `archive-browser`, `candidate-inspector`.
- LocalStorage keys separate workspace layout, tab state, and archive destination.

Layout and interaction:

- Absolute-positioned panels inside a wide fixed canvas.
- Manual pointer drag/resize with a 12 px grid.
- Bring-to-front is implemented by reordering panels.
- Reset current tab and reset all layouts are explicit controls.
- Preset layouts per tab are domain-useful and immediately productive.

Information design:

- Sticky titlebar, sticky tabs, sticky controls, then a wide work canvas.
- Truth pill for Spotify connection state.
- Queue observatory as compact metric cards.
- Playlist cards show status, progress, error count, Spotify link, retry/delete/subscription controls, and expandable track lists.
- Archive browser groups files by folder and exposes count/size/read-only summary.
- Candidate inspector makes hidden scoring/retry state inspectable.

Reusable ideas:

- Preset workspaces for common modes.
- Compact progress cards and grouped history rows.
- Investigation tabs by intent: intake, archive, diagnostics.
- Reset layout controls.
- Operational cards with progress, status, direct actions, and drill-down.

Do not copy:

- The large `app.component.*` concentration of state, layout, data fetching, rendering, and interaction.
- Fixed 1848 px canvas as a general workspace default.
- One-off Angular-specific implementation details for a React/Tauri core.
- Palette/theme as-is; it is too product-specific and green-dominant for a neutral core.

## Reusable Primitives

- `WorkspaceState`: versioned tabs, active tab, panel instances, user preferences.
- `WorkspaceTab`: named collection of panels.
- `PanelInstance`: stable ID, module ID, panel type, title, geometry, z/focus order, panel-specific state.
- `PanelRegistry`: panel definitions, default geometry, constraints, title, icon, factory/default state, renderer.
- `WorkspaceShell`: titlebar/status strip, global actions, tabs, workspace preferences.
- `TabBar`: create, select, rename, close, last-tab protection.
- `WorkspaceCanvas`: bounded surface, panel rendering, add-panel entrypoint, empty state.
- `PanelFrame`: chrome, focus, drag, resize, close, dirty guards, per-panel toolbar slots.
- `LayoutEngine`: grid snap, sibling edge snap, canvas edge snap, min/max constraints, z-index.
- `LayoutPersistence`: versioned serialization, migration, repair, unknown panel handling.
- `WorkspaceBrowser`: filesystem/docs navigation with expandable groups and safe path handling.
- `WorkspaceEditor`: dirty text panel, save flow, TOC/links inspector, split/collapse state.
- `TruthStrip`: compact domain state summary.
- `PreflightPanel`: guarded action review before irreversible/domain-critical operations.
- `Timeline/TimeMachine`: temporal list, selection, diff/comparison, restore/backup hooks.
- `OperationalCard`: dense row/card with status, progress, counters, actions, and drill-down.
- `AuditPanel`: inspection results grouped by mode/type, with persisted expansion.
- `AdvisoryLog`: LLM/system notes separated from canonical runtime state.

## Anti-Patterns / Things Not To Copy

- Monolithic top-level components that own layout, persistence, data fetching, and domain rendering at once.
- Product-specific panels hard-coded directly into core shell logic.
- Layout state with no version and no repair path.
- Persisting arbitrary API payloads without schema/version checks.
- Treating local LLM output as truth instead of advisory context.
- Destructive or history-changing actions without preflight/preview.
- Fixed-width canvases as the only responsive strategy.
- Heavy product-specific color palettes in core components.
- Hidden hover-only controls without accessible labels or keyboard alternatives.
- Emoji/symbol-only tab controls where icon components and tooltips would be clearer.
- Copying ChronoGit's current monolithic `App.tsx` orchestration into Workspace Core.
- Copying Spooty's Angular/Bulma structure into a React/Tauri core.
- Copying placeholder panels as permanent abstractions.

## Proposed Workspace Core Concepts

Jarri Workspace Core should be a reusable, domain-neutral React/Tauri workspace substrate with doctrine-aware primitives.

Core doctrine:

- Truth before action: every workflow exposes current state before controls.
- Preflight before mutation: destructive, historical, sync, publish, and repair actions need preview/confirmation.
- Panels are projections: runtime truth belongs to backend/domain services; panel layout is user preference.
- State is repairable: persisted layout must be versioned, normalized, and recoverable.
- Local intelligence is advisory: LLM explanations live in logs/panels and do not overwrite canonical state.
- Temporal context is first-class: history, replay, comparison, lineage, and restore are reusable workspace concepts.
- Dense but legible: prioritize compact summaries, grouped risk/status sections, and drill-down over large marketing-style UI.

Initial core surfaces:

- Shell with status strip and workspace actions.
- Tabs with create/rename/close and serialized panel sets.
- Canvas with draggable/resizable panels.
- Panel frame with focus, z-index, close, resize, toolbar slots, dirty-close hooks.
- Panel registry and panel factory.
- Browser panel.
- Editor panel.
- Audit/log panel.
- Truth strip primitive.
- Time/Replay primitive.
- Preflight primitive.

## Proposed Initial Repository Structure

```text
workspace-core/
  app/
    src/
      main.tsx
      App.tsx
      shell/
        WorkspaceShell.tsx
        WorkspaceShell.css
      tabs/
        TabBar.tsx
        TabBar.css
      workspace/
        WorkspaceCanvas.tsx
        WorkspaceCanvas.css
      panels/
        PanelFrame.tsx
        PanelFrame.css
        PanelPicker.tsx
        panelRegistry.ts
        panelTypes.ts
      layout/
        layoutTypes.ts
        layoutEngine.ts
        snap.ts
        geometry.ts
        persistence.ts
        migrations.ts
      primitives/
        TruthStrip.tsx
        PreflightPanel.tsx
        Timeline.tsx
        OperationalCard.tsx
        AdvisoryLog.tsx
        StatusPill.tsx
      core-panels/
        BrowserPanel.tsx
        EditorPanel.tsx
        AuditPanel.tsx
        LogPanel.tsx
      hooks/
        useWorkspaceState.ts
        usePanelFocus.ts
        usePersistentPreference.ts
      theme/
        tokens.css
        base.css
      tauri/
        commands.ts
  docs/
    investigations/
```

Keep domain modules outside core:

```text
domain-git/
domain-observatory/
domain-spooty/
domain-gti/
```

Each domain should register panels and commands through core interfaces instead of editing shell/canvas internals.

## Open Questions

- Should Workspace Core be a standalone package consumed by apps, or the root app shell that domain modules plug into?
- Should layout persistence remain `localStorage` initially, or move immediately to a Tauri-backed file for portability and backup?
- What is the minimum docking model for v1: freeform panels only, snap zones, or full dock/split trees?
- Should keyboard movement/resizing and command palette behavior be required in v1?
- What are the canonical dirty-state contracts for panels that edit files, generated docs, or domain records?
- Should core own the Browser/Editor panels, or should those be a bundled standard module?
- How much of ChronoGit's Time Machine should become generic timeline/replay infrastructure versus Git-specific domain UI?
- What accessibility baseline should be enforced for panel chrome, icon buttons, focus order, and resize handles?

## Recommended Next Codex Task

Create the initial Jarri Workspace Core skeleton using the Jarri Workspace app as the implementation reference, but extract only the domain-neutral shell, tabs, canvas, panel frame, layout persistence, panel registry, snap engine, Browser/Editor standard panels, and doctrine primitives.

Do not start with GitHub Traffic Intelligence. First build and verify the reusable substrate with two simple demo panels:

- `truth-demo`: compact truth strip plus metrics.
- `timeline-demo`: temporal list with selectable entries.

Then add a migration path for domain modules to register real GTI panels.

## Verification Notes

- `git -C /home/dretski/projects/spooty-hardened status --short` printed no changes.
- `git -C /opt/jarri/ui/workspace status --short` printed no changes.
- `git -C /home/dretski/projects/ChronoGit status --short` showed pre-existing local changes:
  - `chronogit-app/src-tauri/src/lib.rs`
  - `chronogit-app/src/App.css`
  - `chronogit-app/src/App.tsx`
  - `chronogit-app/src/core/chronogitRuntimeTypes.ts`
  - `chronogit-app/src/panels/BranchPanel.tsx`
  - `chronogit-app/src/core/branchTopology.ts`
- `/home/dretski/projects/workspace-core/.git` exists as an empty/nonstandard directory, and `git -C /home/dretski/projects/workspace-core status --short` fails with `fatal: not a git repository (or any of the parent directories): .git`.
- Intended workspace-core write set for this investigation:
  - `docs/investigations/000001-workspace-core-source-audit.md`

