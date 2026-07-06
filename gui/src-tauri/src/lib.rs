//! Desktop shell for Random AI Prompt.
//!
//! This crate is deliberately thin: it does **not** re-implement any app logic. All
//! generation, the gallery, Manage, and the local providers live in the JS engine
//! (`src/`) and the Node server (`gui/server/serve.js`), exactly as in the
//! build-from-source and `npm start` editions. The shell only:
//!
//!   1. Copies the bundled, read-only app payload to a **writable working copy**
//!      (per-user app-data for an installed build; beside the executable for a
//!      portable build), refreshing code/content on a version change while
//!      preserving the user's own files (`output/`, `user-settings.json`,
//!      `results.json`).
//!   2. Launches the bundled Node runtime against `serve.js` as a child process,
//!      with the working copy as its CWD (so the engine's cwd-relative `./data/…`
//!      paths resolve and user data is written somewhere writable), on a free port
//!      and with `NO_OPEN=1` so Node never tries to open a browser.
//!   3. Waits for the server to listen, then points the WebView at it.
//!
//! If the Node backend ever fails to start, the window shows the bundled splash
//! rather than a broken app — and the source / `npm start` / online editions are
//! unaffected, because this shell is a convenience layer over them, not a fork.

use std::fs;
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::{Manager, RunEvent};

/// Holds the Node child process so it can be killed when the app exits.
struct Sidecar(Mutex<Option<Child>>);

/// Ask the OS for a free localhost TCP port by binding to :0 and reading it back.
fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(4123)
}

/// Recursively copy `from` into `to` (creating `to`). Overwrites files.
fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let dst = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_tree(&entry.path(), &dst)?;
        } else {
            fs::copy(entry.path(), &dst)?;
        }
    }
    Ok(())
}

/// A build is "portable" when a `.portable` marker sits next to the executable
/// (the Windows portable zip ships one). Portable builds keep their data beside
/// themselves; installed builds use the per-user app-data dir.
fn is_portable(exe_dir: &Path) -> bool {
    exe_dir.join(".portable").exists() || exe_dir.join("portable").exists()
}

/// Refresh the writable working copy from the bundled payload when the version
/// changed (or on first run), preserving the user's own files.
fn ensure_working_copy(res_app: &Path, work_app: &Path) -> std::io::Result<()> {
    let bundled_ver = fs::read_to_string(res_app.join("VERSION"))
        .unwrap_or_default()
        .trim()
        .to_string();
    let marker = work_app.join(".staged-version");
    let current = fs::read_to_string(&marker).unwrap_or_default().trim().to_string();

    // Up to date — nothing to do.
    if work_app.exists() && !bundled_ver.is_empty() && current == bundled_ver {
        return Ok(());
    }

    fs::create_dir_all(work_app)?;

    // Code + bundled content: refreshed on every version change. User data
    // (output/, user-settings.json, results.json) is intentionally NOT listed,
    // so it is left untouched across upgrades.
    for name in [
        "src",
        "data",
        "gui",
        "runtime",
        "node_modules",
        "package.json",
        "VERSION",
    ] {
        let from = res_app.join(name);
        let to = work_app.join(name);
        if !from.exists() {
            continue;
        }
        if to.exists() {
            if to.is_dir() {
                fs::remove_dir_all(&to)?;
            } else {
                fs::remove_file(&to)?;
            }
        }
        if from.is_dir() {
            copy_tree(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let node = work_app.join("runtime").join("node");
        if node.exists() {
            let _ = fs::set_permissions(&node, fs::Permissions::from_mode(0o755));
        }
    }

    fs::write(&marker, &bundled_ver)?;
    Ok(())
}

/// Launch the Node backend and wire the WebView to it.
fn launch(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let exe = std::env::current_exe()?;
    let exe_dir = exe.parent().map(Path::to_path_buf).unwrap_or_default();

    // The bundled payload: normally under the Tauri resource dir (installed builds),
    // but a portable build lays it out beside the raw executable — fall back to that.
    let res_app = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| d.join("app"))
        .filter(|p| p.exists())
        .unwrap_or_else(|| exe_dir.join("app"));

    let portable = is_portable(&exe_dir);
    let work_root = if portable {
        exe_dir.join("data")
    } else {
        app.path().app_data_dir()?
    };
    let work_app = work_root.join("app");

    ensure_working_copy(&res_app, &work_app)?;

    let node = work_app
        .join("runtime")
        .join(if cfg!(windows) { "node.exe" } else { "node" });
    let serve = work_app.join("gui").join("server").join("serve.js");
    let port = free_port();

    let mut cmd = Command::new(&node);
    cmd.arg(&serve)
        .current_dir(&work_app)
        .env("PORT", port.to_string())
        .env("NO_OPEN", "1")
        // Stamp the edition so the backend's /api/update handler reports the right update path to the
        // check-and-notify banner (portable zip vs installed build). See notes/plans/updates-upgrades.md.
        .env("RAP_EDITION", if portable { "portable" } else { "installer" });
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW — no console flash
    }
    let child = cmd.spawn()?;
    app.manage(Sidecar(Mutex::new(Some(child))));

    // Poll until the server accepts connections, then navigate the WebView to it.
    let handle = app.handle().clone();
    let url = format!("http://127.0.0.1:{port}/");
    thread::spawn(move || {
        for _ in 0..600 {
            if TcpStream::connect(("127.0.0.1", port)).is_ok() {
                break;
            }
            thread::sleep(Duration::from_millis(100));
        }
        let h = handle.clone();
        let _ = handle.run_on_main_thread(move || {
            if let Some(win) = h.get_webview_window("main") {
                if let Ok(u) = url.parse() {
                    let _ = win.navigate(u);
                }
            }
        });
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // In-app auto-updater (Phase 2). Compiled in ONLY when the crate's `updater` feature is
            // enabled AND the `plugins.updater` config (endpoints + signing pubkey) is present; a
            // normal build omits both, so this is inert. See notes/reference/desktop-updater.md.
            #[cfg(feature = "updater")]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            if let Err(e) = launch(app) {
                log::error!("failed to start the Node backend: {e}");
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            if let Some(sc) = app_handle.try_state::<Sidecar>() {
                if let Ok(mut guard) = sc.0.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}
