N6=[
 "Lumora 6 is the biggest overhaul so far, built in four parts.",
 "Home screen: rooms are cards. Tap one to switch every light in it, see how many are on and how bright, and use Show lights to look at just that room. A strip under the clock shows lights on, power in use, cameras and home or away.",
 "Automations: every automation shows as a flow of trigger, conditions and steps. Check now tells you whether it would run right now and why, History lists its recent runs and skips, and the builder shows what you are making in plain words.",
 "Security: a new card on the home screen with an alarm that has Off, Home and Away modes. Doors and windows get an entry delay with a countdown, motion counts when you are away, and when it sounds the server sends a phone alert and flashes the lights red until you silence it. A timeline lists camera motion, doors, locks and alarms, and cameras with a picture can save snapshots.",
 "Faster and sturdier: Lumora opens instantly from a saved copy and refreshes it in the background, shows a notice when you are offline, and the source is now kept in the add-on repository as separate files with a build script.",
]
import json as _j
rep("'5.0.0':{t:'Welcome to Lumora 5'","'6.0.0':{t:'Welcome to Lumora 6',items:"+_j.dumps(N6)+"},\n  '5.0.0':{t:'Welcome to Lumora 5'")
N601=["Fixes: silencing the alarm while the lights are still flashing now always restores them, and they are restored even if the add-on restarted during an alarm.","The automation builder no longer scrolls sideways on a phone, small buttons are easier to tap, and the logo no longer repeats internal ids."]
rep("'6.0.0':{t:'Welcome to Lumora 6'","'6.0.1':{t:'Lumora 6.0.1',items:"+_j.dumps(N601)+"},\n  '6.0.0':{t:'Welcome to Lumora 6'")
rep("APP_VERSION='6.0.0'","APP_VERSION='6.0.1'")
N61=["Sleep mode: a Sleep button on the Bedroom card fades the room to a dim warm glow and then off. Choose the room, the fade time and an optional bedtime in Settings. On the add-on it carries on with the page closed.","Spotify and music: a Music card with play, skip, volume, shuffle, where to play, and a paste-a-link box. It uses Home Assistant's Spotify integration, and Settings has the steps.","Bluetooth: a Bluetooth light on the left, and a Settings page to find and connect nearby devices from Chrome, Edge or the Windows app. A browser cannot make Lumora discoverable to other devices.","The left lights now follow one rule: green is good, yellow is a warning, red is an issue. A red light beeps for 5 seconds, and you can turn that off.","A new dock with labels, a new look for the left lights, and Settings sorted into eight topics: account, home, lights, devices, alerts, connections, screens and system."]
rep("'6.0.1':{t:'Lumora 6.0.1'","'6.1.0':{t:'Lumora 6.1',items:"+_j.dumps(N61)+"},\n  '6.0.1':{t:'Lumora 6.0.1'")
rep("APP_VERSION='6.0.1'","APP_VERSION='6.1.0'")
N611=["Colour changes now stick: Lumora keeps the colour you picked while the bulb catches up, ignores a bulb that briefly reports no colour, and no longer drifts to a slightly rounded colour.","The main page is now just your lights and cameras. A new More page holds the alarm, music, sleep mode and your other devices (plugs, sensors, locks and thermostats).","Cleaner layout: switches keep their proper size everywhere, Settings panels no longer overlap or stretch on very wide screens, and the camera, sleep and Spotify cards fit on phones."]
rep("'6.1.0':{t:'Lumora 6.1'","'6.1.1':{t:'Lumora 6.1.1',items:"+_j.dumps(N611)+"},\n  '6.1.0':{t:'Lumora 6.1'")

rep("APP_VERSION='6.1.0'","APP_VERSION='6.2.0'")
N62=["Automations can now start every so often (every 15 minutes, every hour…), when the alarm goes off, and when sleep mode starts or finishes.","New steps: start sleep mode, pause, play or skip the music, and arm the alarm. Automations can arm the alarm but never switch it off.","New conditions: only on certain days, only if a light is on (or all are off), and only if the alarm is armed or off.","Wait between runs: set a rest period so a busy trigger, like motion, can’t run an automation again and again.","A Duplicate button on every automation makes a switched-off copy to tweak, and messages can include {light}, {time} and {rule}.","Seven new ideas in the Automations page, including Alarm sounds: tell me, Arm the alarm at bedtime and Stretch break."]
rep("'6.1.1':{t:'Lumora 6.1.1'","'6.2.0':{t:'Lumora 6.2',items:"+_j.dumps(N62)+"},\n  '6.1.1':{t:'Lumora 6.1.1'")
rep("APP_VERSION='6.2.0'","APP_VERSION='6.2.1'")
N621=["New Full screen button next to Search. While in full screen, an Exit full screen button stays at the top of the screen (it dims when you stop moving the mouse and comes back when you move it). It also works when you pressed F11 or are using the Windows app."]
rep("'6.2.0':{t:'Lumora 6.2'","'6.2.1':{t:'Lumora 6.2.1',items:"+_j.dumps(N621)+"},\n  '6.2.0':{t:'Lumora 6.2'")
rep("APP_VERSION='6.2.1'","APP_VERSION='6.2.2'")
N622=["The left side bar is gone, so the pages use the full width. A red problem still beeps for 5 seconds if you left that on in Settings, Alerts and sound."]
rep("'6.2.1':{t:'Lumora 6.2.1'","'6.2.2':{t:'Lumora 6.2.2',items:"+_j.dumps(N622)+"},\n  '6.2.1':{t:'Lumora 6.2.1'")
rep("APP_VERSION='6.2.2'","APP_VERSION='7.0.0'")
N700=["Lumora 7.0 is a full visual rebuild. Every colour, shape, font and layout was redrawn from scratch, so nothing looks like 6.x.","A new top bar replaces the old tab bar and side bar, with Search, Full screen, Notifications and Today on the right.","Six new looks: Nocturne, Daylight, Ember, Lagoon, Porcelain and Mono. Pick one in Settings.","New fonts: Familjen Grotesk and Atkinson Hyperlegible (they load from the internet; a system font shows if you are offline).","Every page was redrawn: Devices, More, Automations, Activity, Clock, Sky, Money, Apps and Settings.","All your lights, rooms, automations, security, music, sleep and settings carry over unchanged."]
rep("'6.2.2':{t:'Lumora 6.2.2'","'7.0.0':{t:'Lumora 7.0',items:"+_j.dumps(N700)+"},\n  '6.2.2':{t:'Lumora 6.2.2'")
rep("APP_VERSION='7.0.0'","APP_VERSION='8.0.0'")
N800=["Lumora 8.0: a new midnight look with soft glass cards and a glowing violet accent.","A floating dock replaces the top tabs. Glossy app icons stand on a glass shelf, the page you are on lifts up with a label, and a dot shows where you are.","On phones the dock shrinks to fit all nine pages on one row.","The top bar is now just the logo and your Search, Full screen, Notifications and Today buttons.","New font: Poppins (loads from the internet; a system font shows when you are offline).","The Now area at the top of Devices is a single glowing card. Your lights, automations, security, music and settings are unchanged."]
rep("'7.0.0':{t:'Lumora 7.0'","'8.0.0':{t:'Lumora 8.0',items:"+_j.dumps(N800)+"},\n  '7.0.0':{t:'Lumora 7.0'")
rep("APP_VERSION='8.0.0'","APP_VERSION='8.0.1'")
N801=["Automation cards no longer squeeze their text into a thin column on phones. The switch and buttons now wrap onto their own line."]
rep("'8.0.0':{t:'Lumora 8.0'","'8.0.1':{t:'Lumora 8.0.1',items:"+_j.dumps(N801)+"},\n  '8.0.0':{t:'Lumora 8.0'")
rep("APP_VERSION='8.0.1'","APP_VERSION='8.1.0'")
N810=["The page no longer scrolls. Lumora fills the screen, and the dock sits in its own band at the bottom, so it never covers anything.","Devices, Automations, Apps, More and Money are laid out side by side so they fit on one screen.","If a panel has more in it than fits (a long list of lights, say), only that panel scrolls.","The weather moved up next to the logo.","On phones the page still scrolls inside the frame, but the dock stays clear of it.","The Exit full screen button is styled again (it had lost its look since 7.0)."]
rep("'8.0.1':{t:'Lumora 8.0.1'","'8.1.0':{t:'Lumora 8.1',items:"+_j.dumps(N810)+"},\n  '8.0.1':{t:'Lumora 8.0.1'")
rep("APP_VERSION='8.1.0'","APP_VERSION='8.1.1'")
N811=["The weather, warnings and school-status chips in the top bar fit on one tidy line instead of being cut off, and the school icon draws properly.","The Exit full screen button now sits under the top-right buttons so it never covers the weather."]
rep("'8.1.0':{t:'Lumora 8.1'","'8.1.1':{t:'Lumora 8.1.1',items:"+_j.dumps(N811)+"},\n  '8.1.0':{t:'Lumora 8.1'")
rep("APP_VERSION='8.1.1'","APP_VERSION='8.2.0'")
N820=["Cameras are removed. The Cameras section, the Cameras tile and camera warnings are gone from Devices, and nothing in Lumora asks for a camera any more.","Top-bar chips (weather, warnings, school status) fit on one tidy line, and the school icon draws properly.","The Exit full screen button sits under the top-right buttons so it never covers the weather.","Fixed a few places where text was cut off: the Overview tiles, room cards and the last dock label on phones."]
rep("'8.1.0':{t:'Lumora 8.1'","'8.2.0':{t:'Lumora 8.2',items:"+_j.dumps(N820)+"},\n  '8.1.0':{t:'Lumora 8.1'")
rep("APP_VERSION='8.2.0'","APP_VERSION='8.2.1'")
N821=["Fixed buttons that went blank in the light looks (Start, Add expense, I'm home and others).","The school-closure chip shows a small icon instead of a big black shape.","The scene buttons wrap instead of being cut off on smaller screens.","The sunrise and sunset times, the lights ring and the Devices columns line up properly."]
rep("'8.2.0':{t:'Lumora 8.2'","'8.2.1':{t:'Lumora 8.2.1',items:"+_j.dumps(N821)+"},\n  '8.2.0':{t:'Lumora 8.2'")
