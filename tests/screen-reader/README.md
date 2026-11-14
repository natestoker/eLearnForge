# Real screen-reader pass (Linux)

Drives the course with real keystrokes while **Orca**, a real screen reader, reads it in
**Epiphany** (WebKitGTK). Orca's own speech log is the transcript, so this records what a
screen-reader user actually hears. It is not part of `npm test` or CI: it needs a Linux desktop stack.

1. `apt install orca epiphany-browser xvfb openbox xdotool dbus-x11 at-spi2-core speech-dispatcher python3-gi`
2. Build a course page: take `dist/player.html`, insert before `</head>`
   `<script>window.FORGE_PUBLISH={target:"web"};</script><script id="forge-project" type="application/json">{...project...}</script>`
   and serve it as `course.html` on port 4174.
3. `tests/screen-reader/run.sh`

Two things the setup depends on, found the hard way:
- Orca freezes after a few phrases if speech-dispatcher has no sound card. `run.sh` points it at the silent `dummy` module.
- Run Orca with Python 3.12 where `/usr/bin/python3` is a newer Python (the GObject bindings are built for 3.12).

Findings from the first full pass are in `AUDIT.md` (item 5).
