use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn toggle_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Tray menu — left-click opens calendar, right-click shows menu
            let show = MenuItem::with_id(app, "show", "Open Calendar", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide Calendar", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit DayDock", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("DayDock — Your Daily Command Center")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main(tray.app_handle());
                    }
                })
                .build(app)?;

            // Global hotkey: Cmd+Shift+D (macOS) / Ctrl+Shift+D (Windows/Linux)
            #[cfg(target_os = "macos")]
            let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyD);
            #[cfg(not(target_os = "macos"))]
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyD);

            app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    toggle_main(app);
                }
            })?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
