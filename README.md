# Lumora add-on repository

Home Assistant watches this repository. When the `version` in `lumora/config.yaml` goes up, Home Assistant shows an update for Lumora
and, if Automatic updates is on for the app, installs it by itself and restarts it. Your accounts and settings are kept.

## One-time setup
1. Make a free GitHub account, then a new repository named `lumora-addon` (public is simplest).
2. Upload everything in this folder (`repository.yaml` and the `lumora` folder) to it.
3. In Home Assistant: Settings > Apps > App store > three dots > Repositories, paste `https://github.com/seymour6000-beep/lumora-addon`, Add.
4. Install Lumora from the new repository (remove the old Local apps copy first: delete the `lumora` folder in `\\homeassistant\addons`).
5. Open Lumora in Apps and turn on **Automatic update**.

## Sending an update
Replace the files and raise `version` in `lumora/config.yaml` (1.1.0 to 1.1.1). Within a few hours Home Assistant offers or installs it.

## What Lumora 5 does
Lights and cameras in one place, on your Home Assistant. Server-side automations (with a Christmas set in December), Light watch for
offline lights, a quick command box (Ctrl+K), energy estimates, accounts with roles and two-step sign-in, a pop-out window,
Google Home and Alexa through Home Assistant, a Windows desktop app (`desktop/`) and an Android TV app (`tv-android/`).
Details are in `lumora/DOCS.md`.
