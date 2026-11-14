#!/bin/bash
# Starts a virtual X display, a session bus, the accessibility bus and Orca (logging what it speaks).
export DISPLAY=:99
pkill -f "Xvfb :99" 2>/dev/null; pkill -f "orca_[u]nbuf" 2>/dev/null; pkill -x openbox 2>/dev/null; pkill -f "speech-[d]ispatcher" 2>/dev/null; sleep 1
Xvfb :99 -screen 0 1280x900x24 >$SR/xvfb.log 2>&1 &
sleep 2
eval "$(dbus-launch --sh-syntax)"
echo "export DBUS_SESSION_BUS_ADDRESS='$DBUS_SESSION_BUS_ADDRESS'" > $SR/env.sh
echo "export DISPLAY=:99" >> $SR/env.sh
openbox >$SR/openbox.log 2>&1 &
sleep 1
/usr/libexec/at-spi-bus-launcher --launch-immediately >$SR/atspi.log 2>&1 &
sleep 2
speech-dispatcher --spawn >$SR/spd.log 2>&1
sleep 1
rm -f $SR/orca.log
/usr/bin/python3.12 $SR/orca_unbuf.py --replace --debug-file=$SR/orca.log >$SR/orca.out 2>&1 &
sleep 5
echo started; tail -3 $SR/orca.out; ls -la $SR/orca.log 2>&1; grep -c "SPEECH OUTPUT" $SR/orca.log 2>/dev/null
