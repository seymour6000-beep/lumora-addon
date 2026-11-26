# Lumora for Windows

A desktop window for Lumora, built with Electron. GitHub builds it automatically (`.github/workflows/desktop.yml`) and publishes
`Lumora-Setup.exe` (installer, updates itself) and `Lumora-Portable.exe` on the `desktop-latest` release.

What it does: finds your Lumora server on the home network, remembers it and your sign-in, lives in the system tray, shows
Windows notifications for new warnings (a light offline, power cut, weather warning), opens an always-on-top pop-out window,
remembers its size and position, can start with Windows, and updates itself.

Keys: `Ctrl+Alt+L` shows or hides the window from anywhere. `Ctrl+Shift+P` pop-out. `Ctrl +/-/0` zoom. `F11` full screen.

Run it while developing: `npm install`, then `npm start`. `npm test` checks the server-finding and settings code.

## Removing the Windows "protected your PC" warning

That blue SmartScreen box appears for any app that is not signed with a code-signing certificate. It is not something the app code can switch off. Signing needs a certificate issued to you after an identity check, so it cannot be done without your account. The build here signs automatically once you add one of these to the repository (Settings, Secrets and variables, Actions):

**Option A, Azure Artifact Signing (about US$10 a month, individuals in Canada and the US can apply).** Create an Artifact Signing account and an identity-validated certificate profile in the Azure portal, and an app registration with the *Artifact Signing Certificate Profile Signer* role. Add secrets `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` and variables `AZ_ENDPOINT` (for example `https://eus.codesigning.azure.net`), `AZ_ACCOUNT`, `AZ_PROFILE`, `AZ_PUBLISHER` (the exact name on the certificate).

**Option B, a certificate file from a certificate authority** (a few hundred dollars a year). Add secrets `CSC_LINK` (the .pfx file, base64 encoded) and `CSC_KEY_PASSWORD`.

**Option C, the Microsoft Store** (one-time fee of about US$19 for an individual). The Store signs the app and installs it with no warning, but it needs a Store build of the app.

Note: since 2024 even a signed standard certificate builds SmartScreen trust slowly. Azure Artifact Signing and Store apps are trusted straight away.
