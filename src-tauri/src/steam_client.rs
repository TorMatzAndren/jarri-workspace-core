#[cfg(target_os = "linux")]
mod linux {
    use serde::Serialize;
    use std::process::Command;
    use std::thread;
    use std::time::{Duration, Instant};
    use x11rb::connection::Connection;
    use x11rb::protocol::xproto::{Atom, AtomEnum, ConnectionExt, Window};
    use x11rb::rust_connection::RustConnection;

    #[derive(Clone, Debug, Serialize)]
    #[serde(rename_all = "camelCase")]
    pub(crate) struct SteamClientWindow {
        window_id: String,
        pid: Option<u32>,
        title: String,
        launched: bool,
    }

    struct SteamAtoms {
        net_client_list: Atom,
        net_wm_name: Atom,
        utf8_string: Atom,
        net_wm_pid: Atom,
        net_wm_window_type: Atom,
        net_wm_window_type_normal: Atom,
    }

    fn intern(connection: &RustConnection, name: &[u8]) -> Result<Atom, String> {
        connection
            .intern_atom(false, name)
            .map_err(|error| {
                format!(
                    "failed to request X11 atom {}: {error}",
                    String::from_utf8_lossy(name),
                )
            })?
            .reply()
            .map_err(|error| {
                format!(
                    "failed to resolve X11 atom {}: {error}",
                    String::from_utf8_lossy(name),
                )
            })
            .map(|reply| reply.atom)
    }

    fn atoms(connection: &RustConnection) -> Result<SteamAtoms, String> {
        Ok(SteamAtoms {
            net_client_list: intern(connection, b"_NET_CLIENT_LIST")?,
            net_wm_name: intern(connection, b"_NET_WM_NAME")?,
            utf8_string: intern(connection, b"UTF8_STRING")?,
            net_wm_pid: intern(connection, b"_NET_WM_PID")?,
            net_wm_window_type: intern(connection, b"_NET_WM_WINDOW_TYPE")?,
            net_wm_window_type_normal: intern(connection, b"_NET_WM_WINDOW_TYPE_NORMAL")?,
        })
    }

    fn property_u32(
        connection: &RustConnection,
        window: Window,
        property: Atom,
        property_type: Atom,
    ) -> Result<Vec<u32>, String> {
        let reply = connection
            .get_property(false, window, property, property_type, 0, u32::MAX)
            .map_err(|error| format!("failed to request X11 property {property}: {error}"))?
            .reply()
            .map_err(|error| format!("failed to read X11 property {property}: {error}"))?;

        Ok(reply
            .value32()
            .map(|values| values.collect())
            .unwrap_or_default())
    }

    fn property_bytes(
        connection: &RustConnection,
        window: Window,
        property: Atom,
        property_type: Atom,
    ) -> Result<Vec<u8>, String> {
        connection
            .get_property(false, window, property, property_type, 0, u32::MAX)
            .map_err(|error| format!("failed to request X11 property {property}: {error}"))?
            .reply()
            .map_err(|error| format!("failed to read X11 property {property}: {error}"))
            .map(|reply| reply.value)
    }

    fn steam_class_matches(connection: &RustConnection, window: Window) -> Result<bool, String> {
        let value = property_bytes(
            connection,
            window,
            AtomEnum::WM_CLASS.into(),
            AtomEnum::STRING.into(),
        )?;

        let fields = value
            .split(|byte| *byte == 0)
            .filter(|field| !field.is_empty())
            .map(|field| String::from_utf8_lossy(field).trim().to_ascii_lowercase())
            .collect::<Vec<_>>();

        Ok(fields.iter().any(|field| field == "steamwebhelper")
            && fields.iter().any(|field| field == "steam"))
    }

    fn title(
        connection: &RustConnection,
        atoms: &SteamAtoms,
        window: Window,
    ) -> Result<String, String> {
        let value = property_bytes(connection, window, atoms.net_wm_name, atoms.utf8_string)?;

        Ok(String::from_utf8_lossy(&value)
            .trim_matches(char::from(0))
            .trim()
            .to_string())
    }

    fn is_normal_window(
        connection: &RustConnection,
        atoms: &SteamAtoms,
        window: Window,
    ) -> Result<bool, String> {
        let types = property_u32(
            connection,
            window,
            atoms.net_wm_window_type,
            AtomEnum::ATOM.into(),
        )?;

        Ok(types
            .iter()
            .any(|atom| *atom == atoms.net_wm_window_type_normal))
    }

    fn pid(
        connection: &RustConnection,
        atoms: &SteamAtoms,
        window: Window,
    ) -> Result<Option<u32>, String> {
        Ok(property_u32(
            connection,
            window,
            atoms.net_wm_pid,
            AtomEnum::CARDINAL.into(),
        )?
        .into_iter()
        .next())
    }

    fn find_main_window(
        connection: &RustConnection,
        screen_index: usize,
        launched: bool,
    ) -> Result<Option<SteamClientWindow>, String> {
        let screen = connection
            .setup()
            .roots
            .get(screen_index)
            .ok_or_else(|| format!("X11 screen {screen_index} is unavailable"))?;

        let atoms = atoms(connection)?;

        let clients = property_u32(
            connection,
            screen.root,
            atoms.net_client_list,
            AtomEnum::WINDOW.into(),
        )?;

        for window in clients {
            if !steam_class_matches(connection, window)? {
                continue;
            }

            if !is_normal_window(connection, &atoms, window)? {
                continue;
            }

            let window_title = title(connection, &atoms, window)?;

            if window_title != "Steam" {
                continue;
            }

            return Ok(Some(SteamClientWindow {
                window_id: format!("0x{window:x}"),
                pid: pid(connection, &atoms, window)?,
                title: window_title,
                launched,
            }));
        }

        Ok(None)
    }

    fn launch_steam() -> Result<(), String> {
        match Command::new("steam").spawn() {
            Ok(_) => Ok(()),
            Err(steam_error) => Command::new("flatpak")
                .args(["run", "com.valvesoftware.Steam"])
                .spawn()
                .map(|_| ())
                .map_err(|flatpak_error| {
                    format!(
                        "failed to launch Steam: steam: {steam_error}; flatpak: {flatpak_error}"
                    )
                }),
        }
    }

    pub(crate) fn find_or_launch() -> Result<SteamClientWindow, String> {
        let (connection, screen_index) = x11rb::connect(None)
            .map_err(|error| format!("failed to connect to X11 for Steam discovery: {error}"))?;

        if let Some(window) = find_main_window(&connection, screen_index, false)? {
            return Ok(window);
        }

        launch_steam()?;

        let deadline = Instant::now() + Duration::from_secs(20);

        loop {
            if let Some(window) = find_main_window(&connection, screen_index, true)? {
                return Ok(window);
            }

            if Instant::now() >= deadline {
                return Err(
                    "Steam launched but its main X11 window did not appear within 20 seconds"
                        .to_string(),
                );
            }

            thread::sleep(Duration::from_millis(200));
        }
    }
}

#[cfg(target_os = "linux")]
pub(crate) use linux::SteamClientWindow;

#[cfg(not(target_os = "linux"))]
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SteamClientWindow {
    window_id: String,
    pid: Option<u32>,
    title: String,
    launched: bool,
}

#[tauri::command]
pub(crate) fn steam_client_find_or_launch() -> Result<SteamClientWindow, String> {
    #[cfg(target_os = "linux")]
    {
        linux::find_or_launch()
    }

    #[cfg(not(target_os = "linux"))]
    {
        Err("Steam native client hosting currently requires Linux/X11".to_string())
    }
}
