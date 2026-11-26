# Lumora front-end source

The app is one HTML file in production (`lumora/public/index.html`) but is built from these parts:

- `fresh.html` is the base page, `new.css` the main styles.
- Each feature is a pair of files (`home.js` + `home.css`, `auto6.js`, `security.js`, `watch.js`, `voice.js`, `offline.js` and so on) that `build.py` injects.
- `p41.py` holds the small patches applied to the base page; `notes6.py` the What's new text.

Build with `python3 build.py` (edit the paths at the top of `build.py` if you move this folder). The release output replaces `lumora/public/index.html`.
