Open Lumora from port 8080 of your Home Assistant address, for example http://homeassistant.local:8080.
The first account you create is the admin and can add the rest of the household in Settings.
Lights come from Home Assistant automatically: Devices, Add, Scan.
Your accounts and settings are saved in the add-on's data and included in Home Assistant backups.

## Weather warnings and school status (1.6.0)
The top bar shows Environment Canada warnings for Cumberland County North and Cobequid Pass, and a school pill for Cumberland County (CCRCE). The school pill reads the CCRCE website for a notice dated today. "No school closure posted" means none was found, not a guarantee, so confirm with CCRCE on stormy mornings. Holidays and PD days are not detected.

## Sky and Money tabs (2.2.0)
Sky shows the Amherst forecast (Open-Meteo, fetched by the add-on) with a sunrise and sunset arc. Money is a budget, expense and bill tracker with amounts you type in; it is saved with your other Lumora data and is visible to anyone who can sign in. It does not connect to any bank.

## Lumora on your TV (2.3)

**Sign in with a code.** On the TV choose *Sign in with a code from my phone*. A six-digit code appears. On your phone, signed in to Lumora, open Settings → *Approve a TV* and enter it. The code lasts five minutes and works once.

**Google TV / Android TV, the easy way.** Install the free *Downloader* app from the Play Store on the TV. In its address box type your Lumora address followed by `/tv.apk` (for example `192.168.1.50:8099/tv.apk`), choose Go, then Install. Lumora redirects that address to the latest TV app (`Lumora-TV.apk`, tag `tv-latest`, built automatically from `tv-android/`). Settings, Use Lumora on a TV shows the exact address to type, and `/tv` on your server shows the same steps as a page. You can also `adb install Lumora-TV.apk`. Open Lumora, type your server address (for example `192.168.1.50:8080`) or choose *Find my server automatically*. Back goes back inside Lumora; press Menu to change the address.

**Samsung (Tizen).** Open `tv-samsung/` in Tizen Studio, create a Samsung certificate, turn on Developer mode on the TV (Apps, press 12345) with your PC's IP, then *Run as Tizen Web Application*. Samsung does not allow installing unsigned apps any other way.

Chrome's *Cast* only mirrors a screen; the TV remote can't control it. Use the apps above.

## Phone alerts, rooms and cameras (2.4)

**Phone alerts.** Settings, Phone alerts. Lumora asks Home Assistant to notify your phone through the Home Assistant app (or any notify service, such as SMS). Alerts: severe weather warnings, lights left on when everyone is out, and a light offline for a minute. "Everyone out" uses the people in Home Assistant; with none set up it uses the I'm away button.

**Cameras.** Cameras that Home Assistant exposes as `camera.*` appear on the Devices tab with a picture refreshed every 2 seconds.

**Screensaver.** On a TV the clock, weather and warnings show after 5 idle minutes (Settings to change).

## Accounts, two-step sign-in and password reset

- **Admin** sees everything. **Family** sees lights, devices and automations but not Money or phone numbers (an admin can allow Money per person). **Guest** sees lights and devices only.
- Add people and choose their access in Settings, under Household.
- Two-step sign-in uses any authenticator app. Turn it on under Settings, Account.
- Forgot a password? An admin makes a one-time reset code under Household, Reset password.
- Locked out as the only admin? Turn on the **admin_reset** option and restart the add-on. A reset code for the first admin is written to the add-on log (valid 15 minutes) and that admin's two-step sign-in is cleared. Turn the option off afterwards.

## Other devices and history

Smart plugs (switch), door/motion/smoke/leak sensors (binary_sensor with a device class), thermostats (climate) and locks that Home Assistant already has can be added on the Devices tab. Automations can lock a door but never unlock one. Automations run while a Lumora page is open in a browser. Usage history (light hours and offline events) is recorded by the add-on itself.

## Automations on the server

Automations run inside the add-on, so they keep working with every browser closed. Supported triggers: set times, sunrise and sunset, door/motion sensors, locks, temperature, light left on, light offline, and home or away. Camera motion and power-cut triggers still need a Lumora page open. Turn the behaviour off with **Run on the server** at the top of the Automations tab. Automations can lock a door but never unlock one.

## Quick commands, energy and pop-out (4.2–4.3)

- **Quick commands:** press Ctrl+K (or `/`, or the magnifier button) to search pages, scenes, lights, plugs and locks. Enter runs the top result. Alt+1–8 switches pages.
- **Energy:** the History tab estimates energy from light on-time. Set watts per light and your price per kWh there. It is an estimate, not a meter reading. Export the history as CSV from the same tab.
- **Pop-out (beta):** opens a small window with lights and notifications.
- **Status lamps:** the side tab on the screen edge shows the state of your home at a glance.

## Christmas season (4.5)

From December 1 to January 5 Lumora switches to a festive theme by itself: green and red colours, falling snow (off if your device asks for reduced motion) and a garland along the top. Once, when the season starts and you are signed in, it adds three automations: Christmas lights at sunset (or 4:30 pm if no location is set), green at 8 pm, and lights off at 11 pm. Change or delete them freely. A deleted one stays deleted that year. They switch themselves off after January 5. The Christmas, Christmas tree and Christmas gold scenes are always available. To turn the theme off or on, press Ctrl+K and type "Christmas".

## Splash, logos and version (4.6)

After the Lumora splash a short "Made by Claude AI" screen plays once per browser session. The logo and icons have a 3D look. The version number is in Settings under About Lumora; it only shows on the main screen when an update is waiting.

## Light watch (4.8)

Settings, Light watch controls how Lumora spots a light that has gone offline and how it tells you:

- **Send a phone alert after:** right away, or 1, 2, 5, 10 or 30 minutes. Short drop-outs that fix themselves never alert.
- **Remind me while it stays offline:** every hour, 3 hours, 6 hours or every day.
- **Tell me when it comes back:** says how long the light was away.
- **Keeps dropping out:** warns when a light goes offline 2 to 8 times in one hour (set the count). Usually weak Wi-Fi, a loose bulb or a switch that cuts power.
- **Several lights drop together:** warns when at least half your lights (but not all of them) go offline at once. Check the router or Wi-Fi extender first. All lights offline is treated as a power cut.
- **Quiet hours:** no phone alerts between the times you choose. If a light is still offline when quiet hours end, you get one alert then.
- **Lights to watch:** switch a light off here if you unplug it on purpose. It then never alerts or shows in notifications.
- **Health report:** per light, how much of the last 7 or 30 days it was online, how many drops, the longest outage and the last drop.

Phone alerts need the Phone alerts settings and keep working with the page closed.

## Pop-out window (4.9)

The pop-out is a small window with your notifications and lights. Open it from the Today panel, the Lights heading, or Ctrl+K. It shows the time and how many lights are on, has an All lights off button, and remembers its size and position. Automations keep running in the main window only, so nothing fires twice. Allow pop-ups for Lumora if your browser blocks it.

## Google Home and Alexa (4.10)

Settings, Google Home and Alexa. Your lights are already Home Assistant entities, so Google Home and Alexa can control them through Home Assistant. Lumora's part is to share your scenes: every few minutes (and whenever you change a scene) it creates a scene in Home Assistant for each Lumora scene, named `scene.lumora_evening`, `scene.lumora_movie`, `scene.lumora_all_off` and so on, including scenes you made yourself. Turn this off with *Share my scenes with Home Assistant*. These scenes are recreated after Home Assistant restarts.

You still do the one-time link between Home Assistant and Google or Amazon. The page lists the steps. The easy route is Home Assistant Cloud (Nabu Casa, paid). A free manual route exists but needs a Google developer project or an Alexa skill. In Home Assistant, Settings, Voice assistants, expose your lights and the Lumora scenes. Lumora does not talk to Google or Amazon itself and cannot check that the link works.

The server address is shown at the bottom of Settings.

## Lumora for Windows (4.11)

A desktop app for Windows. In Lumora, Settings, *Lumora for Windows* has the download button (or open `/desktop.exe` on your server). Run `Lumora-Setup.exe`; Windows may warn because the app is not signed (More info, Run anyway). `Lumora-Portable.exe` runs with no install.

Open the app and choose *Find my server automatically*, or type your server address (shown at the bottom of Settings). Sign in once; it remembers you. It stays in the system tray, shows Windows notifications for new warnings (light offline, power cut, weather warnings), has an always-on-top pop-out window (`Ctrl+Shift+P`), can start with Windows, and updates itself. `Ctrl+Alt+L` shows or hides it from anywhere. Right-click the tray icon for its options. GitHub builds the app from the `desktop/` folder of this repository.

## Lumora 6.0

- **Home screen**: room cards that toggle a whole room and show its colour, plus a strip with lights on, power use, cameras and mode.
- **Automations**: every rule shows trigger, conditions and actions as chips, a "Check now" dry run, a History button, and a plain-words preview while you build.
- **Security**: choose Off, Home or Away on the Security card. Doors and windows start an entry countdown (default 20 seconds, 0 to 120 in settings). When the alarm sounds, the add-on sends a phone alert (using Phone alerts settings) and flashes the lights red until you silence it, then restores them. Away also watches motion sensors and unlocked locks. The timeline lists motion, doors, locks and alarms. Camera motion reaches the alarm only while a Lumora page is open. Cameras with a live picture get a Save snapshot button (Aosu battery cameras have none).
- **Core**: the app opens instantly from a saved copy and refreshes in the background, shows an offline notice, and the front-end source lives in `src/`.

## Lumora 6.1

- **Sleep mode**: a Sleep button on the Bedroom card (change the room in Settings, Lights and rooms) fades that room to a dim warm light and then off. The fade is run by the add-on, so it carries on with the page closed and resumes if the add-on restarts. You can also set a bedtime and Lumora starts it by itself.
- **Music and Spotify**: the Music card shows any media player Home Assistant knows, with Spotify first. Add the Spotify integration in Home Assistant (Settings, Devices and services, Add integration, Spotify). Playing music needs Spotify Premium. Lumora never sees your Spotify password. You can paste a Spotify playlist, album or song link to play it.
- **Bluetooth**: Settings, Connections, Bluetooth finds and connects to nearby devices from Chrome, Edge or the Windows app (the page must be on HTTPS or this computer). A web page cannot announce itself over Bluetooth, so other devices will not see Lumora in their lists. Making Lumora discoverable would need Bluetooth access on the Home Assistant computer, which Lumora does not have.
- **Status lights**: green is good, yellow is a warning, red is an issue. A light turning red beeps for 5 seconds (browsers only allow sound after you have tapped the page once). Turn it off in Settings, Alerts and sound, Status lights.
- **Settings** are now in eight topics: Account and people, Home and look, Lights and rooms, Devices and cameras, Alerts and sound, Connections, Screens and apps, System and backup. Searching looks across all of them.

## Lumora 6.1.1

- **Colours stick**: the colour you pick is held while the bulb catches up, and a brief "no colour" report from Home Assistant is ignored.
- **New More page**: the main page is now just lights and cameras. The alarm, music, sleep mode and other devices (plugs, sensors, locks, thermostats) are on the More tab.
- **Layout fixes**: switches no longer stretch, Settings panels keep a readable width on wide screens, and the camera, sleep and Spotify cards fit on phones.

## Lumora 6.2: more automations

- **New triggers**: every so often (every N minutes), the alarm goes off, sleep mode starts, sleep mode finishes. These run on the add-on, so they work with every browser closed.
- **New steps**: start sleep mode, control the music (pause, play, next, previous, volume), arm the alarm. Automations can arm the alarm in Home or Away but never switch it off, the same way they can lock a door but never unlock one.
- **New conditions**: only on certain days, only if a light is on (or every light is off), only if the alarm is armed (or off).
- **Wait between runs**: set a number of minutes in the builder and the automation will not run again until that time has passed. Handy for motion triggers. Running it by hand always works.
- **Duplicate**: copies an automation, switched off, so you can change it.
- **Messages** can include {light} (the light that triggered it), {time} and {rule}.
- **Ideas**: seven new starting points in the Automations page.

## Lumora 6.2.1

- **Full screen**: a Full screen button sits next to Search (browsers that support it). While in full screen, an **Exit full screen** button stays at the top of the page. It dims after a few seconds and returns when you move the mouse or touch the screen. Esc and F11 still work too. A browser cannot leave an F11 full screen by itself, so there the button reminds you to press F11. The Windows app leaves full screen directly.

## Lumora 6.2.2

- **Left side bar removed**: pages now use the full width. The status lights are no longer shown. A red problem still beeps for 5 seconds if "beep for red" is on in Settings, Alerts and sound. Problems still appear in the notifications list on the main page.

## Lumora 7.0

A full visual rebuild. All styling was deleted and redrawn: a new top bar, six new looks (Nocturne, Daylight, Ember, Lagoon, Porcelain, Mono), new fonts (Familjen Grotesk and Atkinson Hyperlegible, loaded from the internet) and redesigned pages. Your lights, rooms, automations, security, music, sleep and settings are unchanged. The old left side bar and bottom dock are gone. The status lamps are hidden, but the alert beep still works.

## Lumora 8.0

A new midnight look: soft glass cards, a violet glow and the Poppins font. The top tabs are replaced by a floating dock, where glossy icons for each page stand on a glass shelf. The page you are on lifts up, shows its name and has a dot under it. On phones the icons shrink so all nine fit on one row. Your lights, automations, security, music, sleep and settings are unchanged.

## Lumora 8.0.1

Automation cards no longer squeeze their text on phones; the switch and buttons wrap onto their own line.

## Lumora 8.1

The page no longer scrolls: Lumora fills the screen and the dock sits in its own band, so it covers nothing. Devices, Automations, Apps, More and Money are laid out in side-by-side panels; a panel scrolls only if it has more than fits. The weather moved next to the logo. The Exit full screen button is styled again.

## Lumora 8.2

Cameras are removed from the app (the Cameras section, tile and camera warnings). The top-bar weather, warning and school chips fit on one line, and a few cut-off texts were fixed (Overview tiles, room cards, dock labels on phones). The Exit full screen button sits under the top-right buttons.

## Lumora 8.2.1

Alignment pass: buttons that went blank in the light looks are fixed, the school-closure icon is the right size, scene buttons wrap instead of being cut off, and the sunrise/sunset, ring and column positions line up.
