# Core Geometry Migration

## Baseline findings (before this pass)

- Core already establishes a projection-scoped Frame Font boundary: `PanelFrame` publishes a scale and `.panel-frame__body` applies it. Workspace Font remains inherited by shell and frame chrome. `WorkspaceSelect` explicitly forwards its owning panel scale into its portal.
- Frame Font preferences were keyed by `moduleId:panelType`, so same-type instances shared mutable state. Preferences were not pruned when instances disappeared.
- The Settings and Color Picker panels are Core's current horizontal range consumers. Their CSS lets the range input occupy the allocated grid column (`min-width: 0`, Color Picker `width: 100%`). Track thickness is a physical invariant.
- Color Picker's saturation/value interaction plane occupied the available width but imposed `min-height: 210px`; this was designer-oriented geometry without a demonstrated minimum gesture requirement or aspect constraint.
- Core has no actual meter, fader, rotary, channel-strip, or control-matrix consumer. No current justification was found for semantic-column preferences or measured virtual row geometry.
- Screenshot rendering/composition has explicit Core-specific contracts and is outside the geometry changes in this pass.

## Geometry ownership doctrine

- Workspace Font owns shell, workspace controls, panel frame chrome, and resize interaction.
- Frame Font is semantic scale intent owned by one panel instance and applies to projection/body typography and panel-owned portals.
- Containers allocate physical control surfaces. Their long axis follows available space; physical thickness/handles may remain invariant when their interaction or rendering role justifies it.
- Content owns intrinsic geometry. User-selected panel geometry is authoritative; internal layout adapts even when cramped.
- Fixed values remain appropriate for true invariants, explicit initial/default geometry, and justified operability constraints. Persist semantic choices, never resolved pixels or DOM measurements.
- Responsive dimensions are a Core primitive. Responsive topology is an explicit panel capability, never an automatic consequence of available width.

## Audit classification

| Finding | Classification | Owner / decision |
| --- | --- | --- |
| Shell/frame font and frame controls | typography-derived | Workspace Font; preserve boundary |
| Projection labels, readouts, buttons, form text | typography-derived | Inherit Frame Font; relative spacing where text-bound |
| Settings/Color Picker range long axis | container-derived | Parent grid allocation; never a preferred fixed width |
| Range track thickness and thumb geometry | genuinely invariant | Keep as small interaction/rendering geometry |
| Color Picker saturation/value plane width | container-derived | Fill allocated width |
| Color Picker saturation/value plane 210px minimum height | uncertain at baseline; judged hidden designer geometry | Remove minimum; use allocated square aspect-ratio region |
| Color preview swatch, SV marker, borders, resize handles | genuinely invariant | Preserve physical meaning and operability |
| Default panel/canvas dimensions and minimum resize bounds | explicit initial/default geometry / interaction constraint | Preserve; these do not constrain internal layout |
| Image-derived preferred panel sizing | content-derived | Preserve runtime content-derived sizing; do not persist DOM measurements |
| Other complex calendar/file-browser grids and row layouts | uncertain / local semantic layout | Retain current semantics; no broad conversion in this pass |

## Implemented state

- `PanelFrame` and the workspace controller address Frame Font state by panel instance ID. A new or duplicated panel receives a new identity and therefore the default `fontScale: 1`; same-type instances can change independently. Closing a panel or tab removes its preference immediately, and layout normalization discards orphaned IDs and old `moduleId:panelType` keys. Persistence retains only the semantic scale value.
- The existing font boundary and portal forwarding remain intact. No projection component was taught to read the scale directly; body typography still inherits it through `.panel-frame__body`. Workspace Font and screenshot presentation were not changed.
- Both live horizontal range controls use the shared `.workspace-range` contract (`width: 100%`, `min-width: 0`, `min-height: 34px`), so their long axis is the allocated parent track while the interaction region stays font-independent. The Color Picker hue track remains 12px thick; those are operability/rendering details independent of long-axis allocation and Frame Font scale.
- Color Picker's saturation/value plane now fills its available width and uses `aspect-ratio: 1`; its 210px minimum was removed. The square preserves the two independent saturation/value axes and has no fixed long or cross axis. The marker, preview swatch, border, and hue track retain their justified small invariant dimensions.
- Added shared `text-flow-ellipsis` and `text-flow-scroll` contracts. File names that have a title tooltip use intentional single-line ellipsis; search-result paths retain their complete canonical text and can scroll horizontally.
- The migration guard now checks instance identity/default/pruning, the Frame Font boundary and portal contract, allocated range width, Color Picker aspect behavior, and the explicit text-flow contracts. Persistence tests cover independent same-type values plus stale and type-scoped preference pruning.
- Settings now uses an explicit ordered one-column top-level grid (`Interface`, `Appearance`, `Panel Menu Arrangement`) and an authored three-column Interface card map (`Display` and `System Surfaces` span two rows; `Layout` and `Clock` share the middle column). Narrow geometry retains that map and can scroll the Interface region horizontally when its intrinsic tracks cannot fit; cards and controls can look cramped while remaining in place. Wide geometry expands the three tracks proportionally and keeps the top-level regions together.
- Core's former topology came from a two-column root that pinned Panel Menu Arrangement on the right, plus container queries that moved it into document flow below 780px. Interface cards used `auto-fit` and `minmax` tracks, then changed to a single column below 560px (with an earlier 700px rule also changing layout). Those width-dependent rules explain the observed card reshuffling and separated islands.
- Lab's Settings CSS has more explicit Interface card placement (the Display/Surfaces span and Layout/Clock middle stack), but also resets those placements and changes columns under 780px and 560px container queries. Core adopts the useful authored card map, removes its own implicit breakpoints, and does not copy Lab's alternate responsive layouts.

## Verification and architectural challenge

- `npm run test:core`, `npm run test:workspace-screenshot-contract`, `npm run build`, and `git diff --check` pass.
- Same-type preference independence is covered by normalization round-trip assertions and the Frame Font guard; new instances resolve to the default by absence of their instance-keyed preference. Close-panel and close-tab paths prune preference state.
- Frame Font still affects only projection/body typography through inheritance and panel-owned portal content through explicit forwarding. Workspace Font remains shell/frame chrome authority.
- Range long-axis sizing comes from `width: 100%` within each parent allocation. Frame Font affects neither the range rule nor the Color Picker surface rule. Changing container width changes range width; panel geometry does not receive internal control measurements.
- The Color Picker no longer has the arbitrary 210px surface floor. Its square surface follows width-derived aspect geometry. Tiny panels can therefore have tiny physical controls, while the range interaction target keeps its separate font-relative minimum height.
- Fixed values remain for actual interaction/rendering needs and initial/default panel geometry. Existing minimum panel dimensions remain resize constraints, not hidden internal layout canvases.
- No measured render geometry is persisted. The persisted Frame Font field is a bounded unitless scale; Workspace Font's existing user preference remains unchanged.
- Semantic columns, measured virtual rows, and unused fader/knob/meter abstractions remain absent. Existing screenshot tests pass, screenshot files and implementation are unchanged, and this pass adds no platform-specific behavior.
- Future vertical faders can derive travel from allocated height; rotary controls can use an allocated 1:1 cell with only operability bounds; meters can fill their semantic region; channel strips and matrices can derive from parent allocation. A Resonance-style synth can follow these contracts without a designer canvas, but no synth or future control component was fabricated here.

## Deliberate omissions and Lab concepts

- Do not port Lab semantic-column preferences: Core has no table/grid consumer showing incorrect column ownership that needs this machinery.
- Do not port Lab measured virtual rows: Core has no virtualized text/list consumer whose row pitch depends on rendered typography/content.
- Do not add fake fader, knob, meter, channel-strip, or control-matrix components. Future faders derive travel from allocated height; rotary diameter from an allocated 1:1 cell with only operability bounds; meters fill their semantic region; channel strips and matrices derive geometry from parent allocation. Text remains Frame-Font-derived.
- Do not import Lab-only modules, telemetry, observability, runtime-cost machinery, screenshot presentation, or diagnostics.

## Remaining debt and extension points

The wider Core stylesheet contains many panel-specific grids, intrinsic text layouts, and invariant interaction dimensions. Some are intentionally content- or module-specific; a full runtime visual audit across every third-party projection remains future work. Reconsider those values when a real consumer exhibits a geometry ownership defect rather than globally rewriting them. Future panels may author alternate topologies when that is part of their behavior; Core does not provide a generic topology API. Future external modules, including a Resonance-style synth UI, can use the ownership rules without a hidden designer canvas: parent allocations determine physical dimensions; Frame Font affects text only; persisted preferences remain semantic.
