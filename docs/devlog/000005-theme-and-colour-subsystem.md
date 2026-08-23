# Devlog 000005 — Theme And Colour Subsystem

Date: 2026-08-23

## Purpose

Workspace Core now owns a complete generic appearance-editing subsystem rather
than treating theme selection as a small collection of native form controls
inside Settings.

This pass establishes:

- semantic theme presets;
- semantic colour tokens;
- a dedicated Themes / Colours Core panel;
- a Workspace-native colour picker;
- a Workspace-owned single-choice control;
- generic panel-to-panel opening with normalized initial panel state.

The work remains generic Workspace Core presentation infrastructure.

It does not promote private Lab modules, domain providers, Jarri-specific runtime
truth, or local integrations.

## Settings Ownership

Settings remains the Workspace preference hub.

Theme and colour editing no longer live directly inside the Settings panel.

Settings now opens the registered Core panel:

    core/theme-colors

This keeps Settings compact while allowing appearance editing to grow as an
independent Workspace surface with ordinary panel lifecycle, geometry, focus,
presentation memory, and frame ownership.

The actual appearance values remain Workspace preferences.

The Themes / Colours panel is an editor of those preferences, not a second
source of truth.

## Theme Presets

Workspace Core supports the following generic presets:

- Neutral
- Graphite
- Contrast
- Blueprint
- Pink Sparkle

Pink Sparkle is a normal theme preset and participates in the same persistence,
normalization, light/dark/system mode composition, semantic colour resolution,
and custom override behavior as every other preset.

It is not implemented as a special-case shell mode.

## Semantic Colour Tokens

Workspace appearance is expressed through semantic colour roles.

The current token set is:

- page
- canvas
- panel
- panelHeader
- text
- muted
- border
- button
- control
- menu

`control` is now distinct from `button`.

This allows fields, selectors, editors, and other interactive input surfaces to
have theme-specific presentation without borrowing button emphasis or collapsing
into panel background colour.

Preset composition produces effective colours.

`WorkspacePreferences.colorOverrides` may override individual semantic tokens.

An absent override always means the active preset remains authoritative.

## Themes / Colours Panel

`core/theme-colors` owns appearance editing presentation.

It exposes:

- theme mode;
- theme preset;
- semantic colour swatches;
- per-token override clearing;
- clear-all override behavior.

The semantic colour metadata is centralized in `src/core/colorTokens.ts`.

Theme editors and colour picker code therefore share one canonical token list
rather than duplicating token identity, labels, and CSS-variable mapping.

## Workspace-Native Colour Picker

Clicking a semantic colour swatch opens:

    core/color-picker

The picker is an ordinary registered Core panel.

Its panel state identifies the semantic colour token being edited.

The panel state does not duplicate the selected colour value.

The selected colour remains Workspace preference truth in
`WorkspacePreferences.colorOverrides`.

Picker state normalization validates the requested semantic token and repairs
invalid state deterministically.

The picker uses a continuous HSV model:

- two-dimensional saturation/value field;
- hue control;
- live preview;
- hexadecimal entry;
- clear override action.

No native operating-system colour picker is used.

## Panel-To-Panel Opening

Panel bodies now receive the narrow generic capability:

    openPanel(moduleId, panelType, panelState?)

This capability is implemented through the existing Workspace controller panel
creation path.

The caller panel identity is injected by Workspace projection plumbing and is
used as `sourcePanelId`.

Panel bodies therefore do not receive the Workspace controller itself and do
not manage source-panel identity manually.

Initial panel state supplied through `openPanel` is normalized through the
target `PanelDefinition` before becoming live panel state.

This creates a reusable Core capability for panel composition without exposing
controller ownership to panel implementations.

## Workspace-Owned Select Control

Native HTML `<select>` elements presented an unavoidable host-rendering boundary
when their opened option popup was drawn by WebKitGTK / native platform chrome.

Styling the collapsed select element and `<option>` declarations did not make
the opened popup reliably Workspace-owned.

Core therefore introduces `WorkspaceSelect`.

`WorkspaceSelect` provides the current generic single-choice behavior using
Workspace-rendered controls and a Workspace-rendered listbox.

The popup is rendered into the Workspace shell rather than delegated to native
select chrome.

It uses Workspace semantic colours and supports keyboard interaction including:

- Arrow Up / Arrow Down
- Enter
- Space
- Home
- End
- Escape

The current Settings and Themes / Colours single-choice controls have been
migrated to `WorkspaceSelect`.

No native `<select>` remains in those surfaces.

## Persistence

Theme mode, theme preset, semantic colour overrides, font selection, density,
and related appearance preferences remain part of persistent
`WorkspacePreferences`.

Legacy or malformed theme preset values are normalized deterministically.

Pink Sparkle persistence has explicit normalization coverage.

The Themes / Colours and Colour Picker panels do not introduce a parallel
appearance persistence layer.

## Ownership Boundaries

The resulting ownership model is:

    WorkspacePreferences
      -> canonical persisted appearance intent

    theme preset CSS composition
      -> effective semantic appearance

    ThemeColorsPanel
      -> appearance editor presentation

    ColorPickerPanel
      -> semantic colour editing interaction

    WorkspaceSelect
      -> Workspace-owned single-choice presentation

    WorkspaceController
      -> panel creation and normalization authority

No canonical runtime or domain truth is introduced into appearance state.

## Verification

At this checkpoint:

- TypeScript typecheck passes;
- production frontend build passes;
- `git diff --check` passes;
- Pink Sparkle survives persistence normalization;
- invalid theme presets repair to Neutral;
- native colour-input markup is absent;
- native select markup is absent from Settings and Themes / Colours;
- Themes / Colours opens as a normal Core panel;
- Colour Picker opens as a normal Core panel;
- semantic colour overrides update Workspace presentation live;
- clearing an override returns control to the active theme preset.

## Lab Relationship

Workspace Lab has related appearance infrastructure but has diverged through
continued development.

Core is the source implementation for this bounded subsystem.

Promotion to Lab is intentionally separate work and should proceed by
reconciling Lab's existing contracts with Core rather than blindly replacing
Lab files.

## Bounded Stopping Point

This checkpoint establishes generic Workspace-owned appearance editing and
single-choice control presentation in Core.

Further work such as additional presets, saved palettes, recent colours,
eyedropper support, or Lab parity is outside this commit.
