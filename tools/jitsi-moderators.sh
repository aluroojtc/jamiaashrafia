#!/usr/bin/env bash
#
# JAMIA ASHRAFIA LAHORE - LIVE CLASS MODERATORS
#   sudo bash tools/jitsi-moderators.sh
#
# Out of the box Jitsi makes the first person who joins a meeting its moderator. This script changes that so
# only the class's host (its teacher or an administrator, as the LMS meeting token says) is a moderator, plus
# anyone a moderator promotes with "Grant moderator" in the meeting. Students never become moderators on their
# own, also when the host is not in the meeting.
# - Prosody: tools/prosody/mod_jamia_moderator.lua on the conference component (moderator from the token);
# - Jicofo: enable-auto-owner = false (no automatic moderator for the first person in).
# Safe to run again.

set -euo pipefail

DOMAIN="${JITSI_DOMAIN:-meet.jamiaashrafia.asia}"
LMS_DIR="${LMS_DIR:-/var/www/jamiaashrafia}"
PLUGINS="/usr/share/jitsi-meet/prosody-plugins"
STAMP="$(date +%Y%m%d-%H%M%S)"

[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }

PROSODY_HOST="/etc/prosody/conf.d/$DOMAIN.cfg.lua"
JICOFO="/etc/jitsi/jicofo/jicofo.conf"
MODULE="$LMS_DIR/tools/prosody/mod_jamia_moderator.lua"
for f in "$PROSODY_HOST" "$JICOFO" "$MODULE"; do
    [[ -f "$f" ]] || { echo "Not found: $f"; exit 1; }
done
[[ -d "$PLUGINS" ]] || { echo "Not found: $PLUGINS (Jitsi's Prosody plugins)"; exit 1; }
grep -q "^Component \"conference.$DOMAIN\" \"muc\"" "$PROSODY_HOST" || { echo "No conference.$DOMAIN component in $PROSODY_HOST."; exit 1; }

echo "== 1/3 Prosody: moderator from the LMS token"
install -m 0644 "$MODULE" "$PLUGINS/mod_jamia_moderator.lua"
if ! grep -q '"jamia_moderator"' "$PROSODY_HOST"; then
    cp "$PROSODY_HOST" "$PROSODY_HOST.bak-$STAMP"
    # Add it to modules_enabled of the conference component only (the first list after its Component line)
    awk -v comp="Component \"conference.$DOMAIN\" \"muc\"" '
        index($0, comp) == 1 { inside = 1 }
        inside && /^(Component|VirtualHost) / && index($0, comp) != 1 { inside = 0 }
        { print }
        inside && !done && /modules_enabled[[:space:]]*=[[:space:]]*\{[[:space:]]*$/ { print "        \"jamia_moderator\";"; done = 1 }
    ' "$PROSODY_HOST.bak-$STAMP" > "$PROSODY_HOST"
    grep -q '"jamia_moderator"' "$PROSODY_HOST" || {
        cp "$PROSODY_HOST.bak-$STAMP" "$PROSODY_HOST"
        echo "Could not find modules_enabled in the conference.$DOMAIN component; add \"jamia_moderator\"; to it by hand."
        exit 1
    }
fi
if command -v luac5.4 >/dev/null 2>&1; then luac5.4 -p "$PLUGINS/mod_jamia_moderator.lua"; fi

echo "== 2/3 Jicofo: no automatic moderator for the first person in"
if ! grep -q "enable-auto-owner" "$JICOFO"; then
    cp "$JICOFO" "$JICOFO.bak-$STAMP"
    cat >> "$JICOFO" <<EOF

// Live class moderators come from the LMS token only (tools/jitsi-moderators.sh)
jicofo.conference.enable-auto-owner = false
EOF
else
    sed -i 's/enable-auto-owner[[:space:]]*[=:][[:space:]]*true/enable-auto-owner = false/' "$JICOFO"
fi
grep -q "enable-auto-owner = false" "$JICOFO" || echo "   WARNING: check enable-auto-owner in $JICOFO; it should be false."

echo "== 3/3 Restarting services"
systemctl restart prosody
sleep 2
systemctl restart jicofo
systemctl restart jitsi-videobridge2
systemctl list-unit-files jibri.service >/dev/null 2>&1 && systemctl restart jibri || true
sleep 3
systemctl is-active prosody jicofo jitsi-videobridge2 | paste -sd' ' | sed 's/^/   prosody jicofo jvb: /'
echo "   Prosody's lines about the module (should say: only LMS hosts and people they grant):"
grep -i "jamia" /var/log/prosody/prosody.log 2>/dev/null | tail -n 3 | sed 's/^/   /' || true
echo "Done. Start a class from the LMS: the teacher is moderator; students who join first are not."
