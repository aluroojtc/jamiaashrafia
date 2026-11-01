#!/usr/bin/env bash
#
# JAMIA ASHRAFIA LAHORE - JIBRI FINALIZE SCRIPT
# Jibri runs this when a recording file is complete: $1 is the recording's folder in /srv/recordings.
# It marks the folder as finished and asks the LMS to collect it (server/class-recordings.js); the LMS
# also checks every 30 seconds, so a missed call only delays the recording a little.
# Installed by tools/jibri-setup.sh as /opt/jamia/jibri-finalize.sh.

DIR="${1:-}"
[[ -n "$DIR" && -d "$DIR" ]] || exit 0
touch "$DIR/.finalized"
curl -s -m 10 -X POST "http://127.0.0.1:${LMS_PORT:-3000}/api/class-recordings/scan" >/dev/null 2>&1 || true
exit 0
