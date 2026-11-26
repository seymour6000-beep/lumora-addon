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
