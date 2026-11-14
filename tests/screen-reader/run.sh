#!/bin/bash
# Real screen-reader pass: Orca reading the course in Epiphany (WebKitGTK), driven by real keystrokes.
# Linux only. Needs: orca epiphany-browser xvfb openbox xdotool dbus-x11 at-spi2-core speech-dispatcher python3-gi
# (apt install them), and the course served at http://localhost:4174/course.html (see README.md).
# usage: tests/screen-reader/run.sh [walkthrough.py]
export SR="${SR:-/tmp/sr}"; mkdir -p "$SR" "$HOME/.config/speech-dispatcher/modules"
HERE="$(cd "$(dirname "$0")" && pwd)"
# A silent speech output so Orca never waits on a missing sound card (it otherwise freezes after a few phrases).
printf 'AddModule "dummy" "sd_dummy" "dummy.conf"\nDefaultModule dummy\n' > "$HOME/.config/speech-dispatcher/speechd.conf"
: > "$HOME/.config/speech-dispatcher/modules/dummy.conf"
cp "$HERE"/keys.py "$HERE"/orca_unbuf.py "$HERE"/start.sh "$SR"/ && chmod +x "$SR"/start.sh
bash "$HERE/stack.sh"
source "$SR/env.sh"
export GTK_A11Y=atspi WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1
(epiphany --private-instance --new-window http://localhost:4174/course.html >"$SR/epi.out" 2>&1 &)
sleep 12; xdotool key Return; sleep 4          # dismiss the "default browser" dialog
python3 "${1:-$HERE/walkthrough.py}"
