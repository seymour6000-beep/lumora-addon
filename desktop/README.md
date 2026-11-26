# Lumora for Windows

A desktop window for Lumora, built with Electron. GitHub builds it automatically (`.github/workflows/desktop.yml`) and publishes
`Lumora-Setup.exe` (installer, updates itself) and `Lumora-Portable.exe` on the `desktop-latest` release.

What it does: finds your Lumora server on the home network, remembers it and your sign-in, lives in the system tray, shows
Windows notifications for new warnings (a light offline, power cut, weather warning), opens an always-on-top pop-out window,
remembers its size and position, can start with Windows, and updates itself.

Keys: `Ctrl+Alt+L` shows or hides the window from anywhere. `Ctrl+Shift+P` pop-out. `Ctrl +/-/0` zoom. `F11` full screen.

Run it while developing: `npm install`, then `npm start`. `npm test` checks the server-finding and settings code.
