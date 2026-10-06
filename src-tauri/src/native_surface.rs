use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceNativeSurfaceClip {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: u32,
    pub(crate) height: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceNativeSurfaceGeometry {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: u32,
    pub(crate) height: u32,
    #[serde(default)]
    pub(crate) visible_clip: Option<WorkspaceNativeSurfaceClip>,
    #[serde(default)]
    pub(crate) visible_clips: Option<Vec<WorkspaceNativeSurfaceClip>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceNativeWindowIdentity {
    backend: String,
    window_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceNativeSurfaceResult {
    surface_id: String,
    width: u32,
    height: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceNativeSurfaceAdoptionResult {
    surface_id: String,
    window_id: String,
}

#[cfg(target_os = "linux")]
mod linux {
    use super::*;
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use std::collections::{HashMap, HashSet};
    use std::sync::Mutex;
    use x11rb::connection::Connection;
    use x11rb::protocol::shape::{ConnectionExt as ShapeConnectionExt, SK, SO};
    use x11rb::protocol::xproto::{
        ClipOrdering, ConfigureWindowAux, ConnectionExt, CreateWindowAux, Rectangle, SetMode,
        WindowClass,
    };

    #[derive(Clone, Debug)]
    struct AdoptedWindow {
        window_id: u32,
        original_parent: u32,
        root_x: i32,
        root_y: i32,
        width: u32,
        height: u32,
    }

    #[derive(Clone, Debug, Default)]
    enum NativeSurfaceContent {
        #[default]
        Empty,
        Adopted(AdoptedWindow),
    }

    struct NativeSurfaceEntry {
        owner_panel_id: Option<String>,
        container_window_id: u32,
        visible_clip: Option<WorkspaceNativeSurfaceClip>,
        visible_clips: Option<Vec<WorkspaceNativeSurfaceClip>>,
        content: NativeSurfaceContent,
    }

    struct NativeSurfaceRegistry {
        connection: x11rb::rust_connection::RustConnection,
        root_window_id: u32,
        surfaces: HashMap<String, NativeSurfaceEntry>,
        next_id: u64,
    }

    impl NativeSurfaceRegistry {
        fn connect() -> Result<Self, String> {
            let (connection, screen_index) = x11rb::connect(None).map_err(|error| {
                format!("failed to connect to X11 for native surfaces: {error}")
            })?;

            let root_window_id = connection
                .setup()
                .roots
                .get(screen_index)
                .ok_or_else(|| format!("X11 screen {screen_index} is unavailable"))?
                .root;

            Ok(Self {
                connection,
                root_window_id,
                surfaces: HashMap::new(),
                next_id: 1,
            })
        }

        fn allocate_id(&mut self) -> String {
            let id = format!("native-surface-{}", self.next_id);
            self.next_id += 1;
            id
        }
    }

    pub(crate) struct WorkspaceNativeSurfaceState {
        registry: Mutex<Option<NativeSurfaceRegistry>>,
    }

    impl Default for WorkspaceNativeSurfaceState {
        fn default() -> Self {
            Self {
                registry: Mutex::new(None),
            }
        }
    }

    fn with_registry<T>(
        state: &WorkspaceNativeSurfaceState,
        operation: impl FnOnce(&mut NativeSurfaceRegistry) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut slot = state
            .registry
            .lock()
            .map_err(|_| "native surface registry lock poisoned".to_string())?;

        if slot.is_none() {
            *slot = Some(NativeSurfaceRegistry::connect()?);
        }

        operation(
            slot.as_mut()
                .ok_or_else(|| "native surface registry unavailable".to_string())?,
        )
    }

    fn workspace_x11_window_id(window: &tauri::WebviewWindow) -> Result<u32, String> {
        let handle = window
            .window_handle()
            .map_err(|error| format!("failed to obtain Workspace native window handle: {error}"))?;

        match handle.as_raw() {
            RawWindowHandle::Xlib(handle) => u32::try_from(handle.window).map_err(|_| {
                format!(
                    "Workspace Xlib window id does not fit u32: {}",
                    handle.window
                )
            }),
            RawWindowHandle::Xcb(handle) => Ok(handle.window.get()),
            other => Err(format!(
                "Workspace native surface backend is not X11: {other:?}"
            )),
        }
    }

    fn validate_geometry(geometry: &WorkspaceNativeSurfaceGeometry) -> Result<(), String> {
        if geometry.width == 0 || geometry.height == 0 {
            return Err("native surface dimensions must be positive".to_string());
        }

        Ok(())
    }

    fn clip_rectangle(
        geometry: &WorkspaceNativeSurfaceGeometry,
        clip: &WorkspaceNativeSurfaceClip,
    ) -> Option<Rectangle> {
        let left = i64::from(clip.x).max(i64::from(geometry.x));
        let top = i64::from(clip.y).max(i64::from(geometry.y));
        let right = (i64::from(clip.x) + i64::from(clip.width))
            .min(i64::from(geometry.x) + i64::from(geometry.width));
        let bottom = (i64::from(clip.y) + i64::from(clip.height))
            .min(i64::from(geometry.y) + i64::from(geometry.height));

        if right <= left || bottom <= top {
            return None;
        }

        Some(Rectangle {
            x: (left - i64::from(geometry.x)) as i16,
            y: (top - i64::from(geometry.y)) as i16,
            width: (right - left).min(i64::from(u16::MAX)) as u16,
            height: (bottom - top).min(i64::from(u16::MAX)) as u16,
        })
    }

    fn clip_rectangles(geometry: &WorkspaceNativeSurfaceGeometry) -> Vec<Rectangle> {
        if let Some(clips) = geometry.visible_clips.as_ref() {
            return clips
                .iter()
                .filter_map(|clip| clip_rectangle(geometry, clip))
                .collect();
        }

        if let Some(clip) = geometry.visible_clip.as_ref() {
            return clip_rectangle(geometry, clip).into_iter().collect();
        }

        vec![Rectangle {
            x: 0,
            y: 0,
            width: geometry.width.min(u32::from(u16::MAX)) as u16,
            height: geometry.height.min(u32::from(u16::MAX)) as u16,
        }]
    }

    fn apply_clip(
        registry: &NativeSurfaceRegistry,
        window_id: u32,
        geometry: &WorkspaceNativeSurfaceGeometry,
    ) -> Result<(), String> {
        let rectangles = clip_rectangles(geometry);

        for kind in [SK::BOUNDING, SK::INPUT] {
            registry
                .connection
                .shape_rectangles(
                    SO::SET,
                    kind,
                    ClipOrdering::UNSORTED,
                    window_id,
                    0,
                    0,
                    &rectangles,
                )
                .map_err(|error| format!("failed to set native surface {kind:?} shape: {error}"))?
                .check()
                .map_err(|error| format!("native surface {kind:?} shape rejected: {error}"))?;
        }

        Ok(())
    }

    fn x11_window_exists(registry: &NativeSurfaceRegistry, window_id: u32) -> bool {
        match registry.connection.get_geometry(window_id) {
            Ok(cookie) => cookie.reply().is_ok(),
            Err(_) => false,
        }
    }

    fn configure_adopted_child(
        registry: &NativeSurfaceRegistry,
        window_id: u32,
        geometry: &WorkspaceNativeSurfaceGeometry,
    ) -> Result<(), String> {
        registry
            .connection
            .configure_window(
                window_id,
                &ConfigureWindowAux::new()
                    .x(0)
                    .y(0)
                    .width(geometry.width)
                    .height(geometry.height),
            )
            .map_err(|error| format!("failed to resize adopted X11 window: {error}"))?
            .check()
            .map_err(|error| format!("adopted X11 window resize rejected: {error}"))?;

        Ok(())
    }

    fn configure_surface(
        registry: &mut NativeSurfaceRegistry,
        surface_id: &str,
        geometry: &WorkspaceNativeSurfaceGeometry,
    ) -> Result<(), String> {
        validate_geometry(geometry)?;

        let (container_window_id, previous_clip, previous_clips, adopted_window_id) = {
            let entry = registry
                .surfaces
                .get(surface_id)
                .ok_or_else(|| format!("unknown native surface: {surface_id}"))?;

            let adopted_window_id = match &entry.content {
                NativeSurfaceContent::Empty => None,
                NativeSurfaceContent::Adopted(adopted) => Some(adopted.window_id),
            };

            (
                entry.container_window_id,
                entry.visible_clip.clone(),
                entry.visible_clips.clone(),
                adopted_window_id,
            )
        };

        registry
            .connection
            .configure_window(
                container_window_id,
                &ConfigureWindowAux::new()
                    .x(geometry.x)
                    .y(geometry.y)
                    .width(geometry.width)
                    .height(geometry.height),
            )
            .map_err(|error| format!("failed to update native surface {surface_id}: {error}"))?
            .check()
            .map_err(|error| format!("native surface update rejected for {surface_id}: {error}"))?;

        if previous_clip.is_some()
            || previous_clips.is_some()
            || geometry.visible_clip.is_some()
            || geometry.visible_clips.is_some()
        {
            apply_clip(registry, container_window_id, geometry)?;
        }

        if let Some(window_id) = adopted_window_id {
            if x11_window_exists(registry, window_id) {
                configure_adopted_child(registry, window_id, geometry)?;
            } else if let Some(entry) = registry.surfaces.get_mut(surface_id) {
                /*
                 * Foreign applications are allowed to destroy and
                 * recreate their own top-level windows. A stale XID
                 * must not poison the Workspace-owned container.
                 */
                entry.content = NativeSurfaceContent::Empty;
            }
        }

        if let Some(entry) = registry.surfaces.get_mut(surface_id) {
            entry.visible_clip = geometry.visible_clip.clone();
            entry.visible_clips = geometry.visible_clips.clone();
        }

        registry
            .connection
            .map_window(container_window_id)
            .map_err(|error| format!("failed to map native surface {surface_id}: {error}"))?
            .check()
            .map_err(|error| format!("native surface map rejected for {surface_id}: {error}"))?;

        registry
            .connection
            .flush()
            .map_err(|error| format!("failed to flush native surface update: {error}"))?;

        Ok(())
    }

    fn create_surface(
        registry: &mut NativeSurfaceRegistry,
        parent: u32,
        owner_panel_id: Option<String>,
        geometry: &WorkspaceNativeSurfaceGeometry,
    ) -> Result<WorkspaceNativeSurfaceResult, String> {
        validate_geometry(geometry)?;

        let window_id = registry
            .connection
            .generate_id()
            .map_err(|error| format!("failed to allocate X11 surface id: {error}"))?;

        registry
            .connection
            .create_window(
                0,
                window_id,
                parent,
                geometry.x as i16,
                geometry.y as i16,
                geometry.width.min(u32::from(u16::MAX)) as u16,
                geometry.height.min(u32::from(u16::MAX)) as u16,
                0,
                WindowClass::INPUT_OUTPUT,
                0,
                &CreateWindowAux::new().background_pixel(0),
            )
            .map_err(|error| format!("failed to create Workspace X11 child: {error}"))?
            .check()
            .map_err(|error| format!("Workspace X11 child creation rejected: {error}"))?;

        apply_clip(registry, window_id, geometry)?;

        registry
            .connection
            .map_window(window_id)
            .map_err(|error| format!("failed to map Workspace X11 child: {error}"))?
            .check()
            .map_err(|error| format!("Workspace X11 child map rejected: {error}"))?;

        registry
            .connection
            .flush()
            .map_err(|error| format!("failed to flush native surface creation: {error}"))?;

        let surface_id = registry.allocate_id();

        registry.surfaces.insert(
            surface_id.clone(),
            NativeSurfaceEntry {
                owner_panel_id,
                container_window_id: window_id,
                visible_clip: geometry.visible_clip.clone(),
                visible_clips: geometry.visible_clips.clone(),
                content: NativeSurfaceContent::Empty,
            },
        );

        Ok(WorkspaceNativeSurfaceResult {
            surface_id,
            width: geometry.width,
            height: geometry.height,
        })
    }

    fn release_adopted_window(
        registry: &mut NativeSurfaceRegistry,
        surface_id: &str,
    ) -> Result<Option<u32>, String> {
        let adopted = {
            let entry = registry
                .surfaces
                .get_mut(surface_id)
                .ok_or_else(|| format!("unknown native surface: {surface_id}"))?;

            match std::mem::take(&mut entry.content) {
                NativeSurfaceContent::Empty => return Ok(None),
                NativeSurfaceContent::Adopted(adopted) => adopted,
            }
        };

        let _original_parent = adopted.original_parent;

        registry
            .connection
            .unmap_window(adopted.window_id)
            .map_err(|error| format!("failed to unmap adopted X11 window: {error}"))?
            .check()
            .map_err(|error| format!("adopted X11 window unmap rejected: {error}"))?;

        registry
            .connection
            .reparent_window(
                adopted.window_id,
                registry.root_window_id,
                adopted.root_x as i16,
                adopted.root_y as i16,
            )
            .map_err(|error| format!("failed to release adopted X11 window to root: {error}"))?
            .check()
            .map_err(|error| format!("adopted X11 window release rejected: {error}"))?;

        /*
         * The foreign window is safely back under the X root.
         * Explicit release therefore ends this host's crash-
         * rescue responsibility for it.
         */
        registry
            .connection
            .change_save_set(SetMode::DELETE, adopted.window_id)
            .map_err(|error| {
                format!(
                    "failed to remove released X11 window 0x{:x} from save-set: {error}",
                    adopted.window_id
                )
            })?
            .check()
            .map_err(|error| {
                format!(
                    "released X11 window 0x{:x} save-set delete rejected: {error}",
                    adopted.window_id
                )
            })?;

        registry
            .connection
            .configure_window(
                adopted.window_id,
                &ConfigureWindowAux::new()
                    .width(adopted.width)
                    .height(adopted.height),
            )
            .map_err(|error| format!("failed to restore adopted X11 window geometry: {error}"))?
            .check()
            .map_err(|error| format!("adopted X11 window geometry restore rejected: {error}"))?;

        registry
            .connection
            .map_window(adopted.window_id)
            .map_err(|error| format!("failed to remap released X11 window: {error}"))?
            .check()
            .map_err(|error| format!("released X11 window map rejected: {error}"))?;

        registry
            .connection
            .flush()
            .map_err(|error| format!("failed to flush X11 window release: {error}"))?;

        Ok(Some(adopted.window_id))
    }

    fn destroy_surface(
        registry: &mut NativeSurfaceRegistry,
        surface_id: &str,
    ) -> Result<(), String> {
        release_adopted_window(registry, surface_id)?;

        let entry = registry
            .surfaces
            .remove(surface_id)
            .ok_or_else(|| format!("unknown native surface: {surface_id}"))?;

        registry
            .connection
            .destroy_window(entry.container_window_id)
            .map_err(|error| format!("failed to destroy native surface {surface_id}: {error}"))?
            .check()
            .map_err(|error| {
                format!("native surface destroy rejected for {surface_id}: {error}")
            })?;

        registry
            .connection
            .flush()
            .map_err(|error| format!("failed to flush native surface destruction: {error}"))?;

        Ok(())
    }

    pub(crate) fn window_identity(
        window: tauri::WebviewWindow,
    ) -> Result<WorkspaceNativeWindowIdentity, String> {
        let window_id = workspace_x11_window_id(&window)?;

        Ok(WorkspaceNativeWindowIdentity {
            backend: "x11".to_string(),
            window_id: format!("0x{window_id:x}"),
        })
    }

    pub(crate) fn create(
        window: tauri::WebviewWindow,
        state: tauri::State<'_, WorkspaceNativeSurfaceState>,
        geometry: WorkspaceNativeSurfaceGeometry,
    ) -> Result<WorkspaceNativeSurfaceResult, String> {
        let parent = workspace_x11_window_id(&window)?;

        with_registry(&state, |registry| {
            create_surface(registry, parent, None, &geometry)
        })
    }

    pub(crate) fn ensure_for_panel(
        window: tauri::WebviewWindow,
        state: tauri::State<'_, WorkspaceNativeSurfaceState>,
        panel_id: String,
        geometry: WorkspaceNativeSurfaceGeometry,
    ) -> Result<WorkspaceNativeSurfaceResult, String> {
        let panel_id = panel_id.trim().to_string();

        if panel_id.is_empty() {
            return Err("native surface panel owner must not be empty".to_string());
        }

        let parent = workspace_x11_window_id(&window)?;

        with_registry(&state, |registry| {
            let existing = registry.surfaces.iter().find_map(|(surface_id, entry)| {
                (entry.owner_panel_id.as_deref() == Some(panel_id.as_str()))
                    .then(|| surface_id.clone())
            });

            if let Some(surface_id) = existing {
                configure_surface(registry, &surface_id, &geometry)?;

                return Ok(WorkspaceNativeSurfaceResult {
                    surface_id,
                    width: geometry.width,
                    height: geometry.height,
                });
            }

            create_surface(registry, parent, Some(panel_id), &geometry)
        })
    }

    pub(crate) fn update(
        state: tauri::State<'_, WorkspaceNativeSurfaceState>,
        surface_id: String,
        geometry: WorkspaceNativeSurfaceGeometry,
    ) -> Result<(), String> {
        with_registry(&state, |registry| {
            configure_surface(registry, &surface_id, &geometry)
        })
    }

    pub(crate) fn set_visible(
        state: tauri::State<'_, WorkspaceNativeSurfaceState>,
        surface_id: String,
        visible: bool,
    ) -> Result<(), String> {
        with_registry(&state, |registry| {
            let entry = registry
                .surfaces
                .get(&surface_id)
                .ok_or_else(|| format!("unknown native surface: {surface_id}"))?;

            let request = if visible {
                registry.connection.map_window(entry.container_window_id)
            } else {
                registry.connection.unmap_window(entry.container_window_id)
            };

            request
                .map_err(|error| format!("failed to change native surface visibility: {error}"))?
                .check()
                .map_err(|error| format!("native surface visibility change rejected: {error}"))?;

            registry
                .connection
                .flush()
                .map_err(|error| format!("failed to flush native surface visibility: {error}"))?;

            Ok(())
        })
    }

    pub(crate) fn adopt_x11_window(
        state: tauri::State<'_, WorkspaceNativeSurfaceState>,
        surface_id: String,
        window_id: String,
    ) -> Result<WorkspaceNativeSurfaceAdoptionResult, String> {
        let trimmed = window_id.trim();
        let numeric = trimmed
            .strip_prefix("0x")
            .or_else(|| trimmed.strip_prefix("0X"))
            .map(|value| u32::from_str_radix(value, 16))
            .unwrap_or_else(|| trimmed.parse::<u32>())
            .map_err(|error| format!("invalid X11 window id {trimmed}: {error}"))?;

        with_registry(&state, |registry| {
            let (container_window_id, adopted_window_id) = {
                let entry = registry
                    .surfaces
                    .get(&surface_id)
                    .ok_or_else(|| format!("unknown native surface: {surface_id}"))?;

                let adopted_window_id = match &entry.content {
                    NativeSurfaceContent::Empty => None,
                    NativeSurfaceContent::Adopted(adopted) => Some(adopted.window_id),
                };

                (entry.container_window_id, adopted_window_id)
            };

            if let Some(adopted_window_id) = adopted_window_id {
                if adopted_window_id == numeric {
                    if x11_window_exists(registry, adopted_window_id) {
                        return Ok(WorkspaceNativeSurfaceAdoptionResult {
                            surface_id,
                            window_id: format!("0x{numeric:x}"),
                        });
                    }

                    if let Some(entry) = registry.surfaces.get_mut(&surface_id) {
                        entry.content = NativeSurfaceContent::Empty;
                    }
                } else if x11_window_exists(registry, adopted_window_id) {
                    return Err(format!(
                        "native surface already contains X11 window 0x{adopted_window_id:x}"
                    ));
                } else if let Some(entry) = registry.surfaces.get_mut(&surface_id) {
                    entry.content = NativeSurfaceContent::Empty;
                }
            }

            if numeric == container_window_id {
                return Err("cannot adopt a native surface into itself".to_string());
            }

            let tree = registry
                .connection
                .query_tree(numeric)
                .map_err(|error| format!("failed to query X11 window tree: {error}"))?
                .reply()
                .map_err(|error| format!("X11 window tree query rejected: {error}"))?;

            let original_geometry = registry
                .connection
                .get_geometry(numeric)
                .map_err(|error| format!("failed to query X11 window geometry: {error}"))?
                .reply()
                .map_err(|error| format!("X11 window geometry query rejected: {error}"))?;

            let translated = registry
                .connection
                .translate_coordinates(numeric, registry.root_window_id, 0, 0)
                .map_err(|error| format!("failed to translate X11 window coordinates: {error}"))?
                .reply()
                .map_err(|error| format!("X11 coordinate translation rejected: {error}"))?;

            let container_geometry = registry
                .connection
                .get_geometry(container_window_id)
                .map_err(|error| format!("failed to query native surface geometry: {error}"))?
                .reply()
                .map_err(|error| format!("native surface geometry query rejected: {error}"))?;

            registry
                .connection
                .unmap_window(numeric)
                .map_err(|error| format!("failed to unmap external X11 window: {error}"))?
                .check()
                .map_err(|error| format!("external X11 window unmap rejected: {error}"))?;

            /*
             * This window belongs to another X11 client.
             * Put it in this host connection's save-set before
             * reparenting it beneath a Workspace-owned window.
             *
             * If Workspace dies or hot-restarts unexpectedly,
             * the X server can rescue the foreign window from
             * our dying hierarchy.
             */
            registry
                .connection
                .change_save_set(SetMode::INSERT, numeric)
                .map_err(|error| {
                    format!("failed to add adopted X11 window 0x{numeric:x} to save-set: {error}")
                })?
                .check()
                .map_err(|error| {
                    format!("adopted X11 window 0x{numeric:x} save-set insert rejected: {error}")
                })?;

            registry
                .connection
                .reparent_window(numeric, container_window_id, 0, 0)
                .map_err(|error| format!("failed to adopt external X11 window: {error}"))?
                .check()
                .map_err(|error| format!("external X11 window adoption rejected: {error}"))?;

            registry
                .connection
                .configure_window(
                    numeric,
                    &ConfigureWindowAux::new()
                        .x(0)
                        .y(0)
                        .width(u32::from(container_geometry.width))
                        .height(u32::from(container_geometry.height)),
                )
                .map_err(|error| format!("failed to size adopted X11 window: {error}"))?
                .check()
                .map_err(|error| format!("adopted X11 window sizing rejected: {error}"))?;

            registry
                .connection
                .map_window(numeric)
                .map_err(|error| format!("failed to map adopted X11 window: {error}"))?
                .check()
                .map_err(|error| format!("adopted X11 window map rejected: {error}"))?;

            let entry = registry
                .surfaces
                .get_mut(&surface_id)
                .ok_or_else(|| format!("unknown native surface: {surface_id}"))?;

            entry.content = NativeSurfaceContent::Adopted(AdoptedWindow {
                window_id: numeric,
                original_parent: tree.parent,
                root_x: i32::from(translated.dst_x),
                root_y: i32::from(translated.dst_y),
                width: u32::from(original_geometry.width),
                height: u32::from(original_geometry.height),
            });

            registry
                .connection
                .flush()
                .map_err(|error| format!("failed to flush X11 window adoption: {error}"))?;

            Ok(WorkspaceNativeSurfaceAdoptionResult {
                surface_id,
                window_id: format!("0x{numeric:x}"),
            })
        })
    }

    pub(crate) fn release_x11_window(
        state: tauri::State<'_, WorkspaceNativeSurfaceState>,
        surface_id: String,
    ) -> Result<(), String> {
        with_registry(&state, |registry| {
            release_adopted_window(registry, &surface_id)?;
            Ok(())
        })
    }

    pub(crate) fn release_all_adopted(state: &WorkspaceNativeSurfaceState) -> Result<(), String> {
        /*
         * Orderly application shutdown must release borrowed foreign
         * windows before Tauri/X11 destroys Workspace-owned containers.
         *
         * Do not use with_registry() here: shutdown must not establish a
         * fresh X11 connection when the native-surface subsystem was never
         * used during this process lifetime.
         */
        let mut slot = state
            .registry
            .lock()
            .map_err(|_| "native surface registry lock poisoned".to_string())?;

        let Some(registry) = slot.as_mut() else {
            return Ok(());
        };

        let adopted_surface_ids = registry
            .surfaces
            .iter()
            .filter_map(|(surface_id, entry)| {
                matches!(entry.content, NativeSurfaceContent::Adopted(_))
                    .then(|| surface_id.clone())
            })
            .collect::<Vec<_>>();

        let mut failures = Vec::new();

        for surface_id in adopted_surface_ids {
            if let Err(error) = release_adopted_window(registry, &surface_id) {
                failures.push(format!("{surface_id}: {error}"));
            }
        }

        if failures.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "failed to release adopted native surfaces during shutdown: {}",
                failures.join("; ")
            ))
        }
    }

    pub(crate) fn destroy(
        state: tauri::State<'_, WorkspaceNativeSurfaceState>,
        surface_id: String,
    ) -> Result<(), String> {
        with_registry(&state, |registry| destroy_surface(registry, &surface_id))
    }

    pub(crate) fn reconcile_panels(
        state: tauri::State<'_, WorkspaceNativeSurfaceState>,
        panel_ids: Vec<String>,
    ) -> Result<(), String> {
        let existing = panel_ids
            .into_iter()
            .map(|panel_id| panel_id.trim().to_string())
            .filter(|panel_id| !panel_id.is_empty())
            .collect::<HashSet<_>>();

        with_registry(&state, |registry| {
            let stale = registry
                .surfaces
                .iter()
                .filter_map(|(surface_id, entry)| {
                    let owner = entry.owner_panel_id.as_ref()?;
                    (!existing.contains(owner)).then(|| surface_id.clone())
                })
                .collect::<Vec<_>>();

            for surface_id in stale {
                destroy_surface(registry, &surface_id)?;
            }

            Ok(())
        })
    }
}

#[cfg(target_os = "linux")]
pub(crate) use linux::WorkspaceNativeSurfaceState;

#[cfg(not(target_os = "linux"))]
#[derive(Default)]
pub(crate) struct WorkspaceNativeSurfaceState;

#[cfg(not(target_os = "linux"))]
fn unsupported<T>() -> Result<T, String> {
    Err("Workspace native surfaces are not available on this platform".to_string())
}

#[tauri::command]
pub(crate) fn workspace_native_window_identity(
    window: tauri::WebviewWindow,
) -> Result<WorkspaceNativeWindowIdentity, String> {
    #[cfg(target_os = "linux")]
    {
        linux::window_identity(window)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = window;
        unsupported()
    }
}

#[tauri::command]
pub(crate) fn workspace_native_surface_create(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, WorkspaceNativeSurfaceState>,
    geometry: WorkspaceNativeSurfaceGeometry,
) -> Result<WorkspaceNativeSurfaceResult, String> {
    #[cfg(target_os = "linux")]
    {
        linux::create(window, state, geometry)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (window, state, geometry);
        unsupported()
    }
}

#[tauri::command]
pub(crate) fn workspace_native_surface_ensure_for_panel(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, WorkspaceNativeSurfaceState>,
    panel_id: String,
    geometry: WorkspaceNativeSurfaceGeometry,
) -> Result<WorkspaceNativeSurfaceResult, String> {
    #[cfg(target_os = "linux")]
    {
        linux::ensure_for_panel(window, state, panel_id, geometry)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (window, state, panel_id, geometry);
        unsupported()
    }
}

#[tauri::command]
pub(crate) fn workspace_native_surface_update(
    state: tauri::State<'_, WorkspaceNativeSurfaceState>,
    surface_id: String,
    geometry: WorkspaceNativeSurfaceGeometry,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        linux::update(state, surface_id, geometry)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (state, surface_id, geometry);
        unsupported()
    }
}

#[tauri::command]
pub(crate) fn workspace_native_surface_set_visible(
    state: tauri::State<'_, WorkspaceNativeSurfaceState>,
    surface_id: String,
    visible: bool,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        linux::set_visible(state, surface_id, visible)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (state, surface_id, visible);
        unsupported()
    }
}

#[tauri::command]
pub(crate) fn workspace_native_surface_adopt_x11_window(
    state: tauri::State<'_, WorkspaceNativeSurfaceState>,
    surface_id: String,
    window_id: String,
) -> Result<WorkspaceNativeSurfaceAdoptionResult, String> {
    #[cfg(target_os = "linux")]
    {
        linux::adopt_x11_window(state, surface_id, window_id)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (state, surface_id, window_id);
        unsupported()
    }
}

pub(crate) fn workspace_native_surface_release_all_adopted(
    state: &WorkspaceNativeSurfaceState,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        linux::release_all_adopted(state)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = state;
        Ok(())
    }
}

#[tauri::command]
pub(crate) fn workspace_native_surface_release_x11_window(
    state: tauri::State<'_, WorkspaceNativeSurfaceState>,
    surface_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        linux::release_x11_window(state, surface_id)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (state, surface_id);
        unsupported()
    }
}

#[tauri::command]
pub(crate) fn workspace_native_surface_destroy(
    state: tauri::State<'_, WorkspaceNativeSurfaceState>,
    surface_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        linux::destroy(state, surface_id)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (state, surface_id);
        unsupported()
    }
}

#[tauri::command]
pub(crate) fn workspace_native_surface_reconcile_panels(
    state: tauri::State<'_, WorkspaceNativeSurfaceState>,
    panel_ids: Vec<String>,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        linux::reconcile_panels(state, panel_ids)
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (state, panel_ids);
        unsupported()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn geometry_serializes_with_camel_case_clip() {
        let geometry = WorkspaceNativeSurfaceGeometry {
            x: 10,
            y: 20,
            width: 300,
            height: 200,
            visible_clip: Some(WorkspaceNativeSurfaceClip {
                x: 15,
                y: 25,
                width: 100,
                height: 80,
            }),
            visible_clips: None,
        };

        let value = serde_json::to_value(geometry).expect("serialize geometry");

        assert_eq!(value["visibleClip"]["width"], 100);
        assert_eq!(value["visibleClip"]["height"], 80);
    }
}
