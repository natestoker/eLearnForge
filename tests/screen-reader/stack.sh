#!/bin/bash
# clean restart of Xvfb, dbus, at-spi, openbox, speech-dispatcher and Orca
pkill -9 -f "orca_[u]nbuf"; pkill -9 -f "speech-[d]ispatcher"; pkill -9 -x sd_espeak-ng; pkill -9 -x dbus-daemon; pkill -9 -f at-spi; pkill -9 -x openbox; pkill -9 -f "Xvfb :99"; pkill -9 -f "chrome-linux64"; pkill -9 -x epiphany; pkill -9 -x zenity; sleep 2
rm -rf /root/.cache/at-spi /tmp/.X99-lock /tmp/.X11-unix/X99
$SR/start.sh >/dev/null 2>&1
