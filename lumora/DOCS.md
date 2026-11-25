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

**Google TV / Android TV.** Download `Lumora-TV.apk` from this repository's Releases page (tag `tv-latest`, built automatically from `tv-android/`). Install it with the Downloader app (enter the release link) or `adb install Lumora-TV.apk`. Open Lumora, type your server address (for example `192.168.1.50:8080`) or choose *Find my server automatically*. Back goes back inside Lumora; press Menu to change the address.

**Samsung (Tizen).** Open `tv-samsung/` in Tizen Studio, create a Samsung certificate, turn on Developer mode on the TV (Apps, press 12345) with your PC's IP, then *Run as Tizen Web Application*. Samsung does not allow installing unsigned apps any other way.

Chrome's *Cast* only mirrors a screen; the TV remote can't control it. Use the apps above.

## Phone alerts, rooms and cameras (2.4)

**Phone alerts.** Settings, Phone alerts. Lumora asks Home Assistant to notify your phone through the Home Assistant app (or any notify service, such as SMS). Alerts: severe weather warnings, lights left on when everyone is out, and a light offline for a minute. "Everyone out" uses the people in Home Assistant; with none set up it uses the I'm away button.

**Cameras.** Cameras that Home Assistant exposes as `camera.*` appear on the Devices tab with a picture refreshed every 2 seconds.

**Screensaver.** On a TV the clock, weather and warnings show after 5 idle minutes (Settings to change).
