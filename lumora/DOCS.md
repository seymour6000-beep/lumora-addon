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
