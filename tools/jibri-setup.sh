#!/usr/bin/env bash
#
# JAMIA ASHRAFIA LAHORE - CLASS RECORDING (JIBRI) SETUP
#   sudo bash tools/jibri-setup.sh
#
# Installs Jibri, Jitsi's recorder, next to the self-hosted Jitsi (Debian packages) so the LMS's
# Start / Stop Recording buttons record live classes on this server:
# - the ALSA loopback sound module (snd-aloop) that Jibri records the class audio from;
# - Google Chrome and the matching ChromeDriver (Jibri joins the class as a hidden browser);
# - the jibri package, its two XMPP accounts and its configuration (recordings in /srv/recordings);
# - Jicofo learns where Jibri waits, and the Jitsi web app gets file recording turned on;
# - Jibri's finalize script tells the LMS when a file is complete; the LMS moves it into its own
#   private folder (/var/www/jamiaashrafia/recordings) and the portal never serves it publicly.
# One recording runs at a time (one Jibri = one Chrome). Safe to run again (new account passwords).

set -euo pipefail

DOMAIN="${JITSI_DOMAIN:-meet.jamiaashrafia.asia}"
LMS_DIR="${LMS_DIR:-/var/www/jamiaashrafia}"
LMS_PORT="${LMS_PORT:-3000}"
REC_DIR="/srv/recordings"
STAMP="$(date +%Y%m%d-%H%M%S)"

[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }

CONFIG="/etc/jitsi/meet/$DOMAIN-config.js"
PROSODY_HOST="/etc/prosody/conf.d/$DOMAIN.cfg.lua"
JICOFO="/etc/jitsi/jicofo/jicofo.conf"
for f in "$CONFIG" "$PROSODY_HOST" "$JICOFO" "$LMS_DIR/tools/jibri-finalize.sh"; do
    [[ -f "$f" ]] || { echo "Not found: $f"; exit 1; }
done
grep -q "VirtualHost \"recorder.$DOMAIN\"" "$PROSODY_HOST" || { echo "Prosody has no recorder.$DOMAIN host; this script expects the standard jitsi-meet-prosody config."; exit 1; }

echo "== 1/7 Sound loopback (snd-aloop)"
if ! modinfo snd-aloop >/dev/null 2>&1; then
    apt-get update -q
    apt-get install -y -q "linux-modules-extra-$(uname -r)"
fi
modprobe snd-aloop
grep -qx "snd-aloop" /etc/modules || echo "snd-aloop" >> /etc/modules
lsmod | grep -q snd_aloop && echo "   snd-aloop loaded"

echo "== 2/7 Google Chrome and ChromeDriver"
if ! command -v google-chrome >/dev/null 2>&1; then
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor --yes -o /etc/apt/keyrings/google-chrome.gpg
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update -q
    apt-get install -y -q google-chrome-stable
fi
# No "Chrome is being controlled by automated software" bar in the recordings
install -d /etc/opt/chrome/policies/managed
echo '{ "CommandLineFlagSecurityWarningsEnabled": false }' > /etc/opt/chrome/policies/managed/managed_policies.json
CHROME_VERSION="$(google-chrome --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+')"
if ! chromedriver --version 2>/dev/null | grep -q "$CHROME_VERSION"; then
    apt-get install -y -q unzip
    TMP="$(mktemp -d)"
    curl -fsSL -o "$TMP/chromedriver.zip" "https://storage.googleapis.com/chrome-for-testing-public/$CHROME_VERSION/linux64/chromedriver-linux64.zip"
    unzip -q -o "$TMP/chromedriver.zip" -d "$TMP"
    install -m 0755 "$TMP/chromedriver-linux64/chromedriver" /usr/local/bin/chromedriver
    rm -rf "$TMP"
fi
echo "   $(google-chrome --version) / $(chromedriver --version | cut -d' ' -f1-2)"

echo "== 3/7 Jibri package"
apt-get install -y -q jibri curl
usermod -aG adm,audio,video,plugdev jibri

echo "== 4/7 XMPP accounts for Jibri"
JIBRI_PASS="$(openssl rand -hex 16)"
RECORDER_PASS="$(openssl rand -hex 16)"
prosodyctl register jibri "auth.$DOMAIN" "$JIBRI_PASS"
prosodyctl register recorder "recorder.$DOMAIN" "$RECORDER_PASS"
# With token sign-in, the hidden recorder joins classes without a token
cp "$PROSODY_HOST" "$PROSODY_HOST.bak-$STAMP"
if ! grep -q "token_verification_allowlist" "$PROSODY_HOST"; then
    sed -i "/^Component \"conference.$DOMAIN\" \"muc\"/a\\    token_verification_allowlist = { \"recorder.$DOMAIN\" }" "$PROSODY_HOST"
    grep -q "token_verification_allowlist" "$PROSODY_HOST" || echo "   WARNING: could not add token_verification_allowlist to the conference component; add it by hand."
fi
# Classes locked with a passcode: the recorder may enter without it (as Jicofo does)
if grep -q "muc_password_whitelist" "$PROSODY_HOST" && ! grep -q "recorder@recorder.$DOMAIN" "$PROSODY_HOST"; then
    sed -i "/muc_password_whitelist = {/a\\        \"recorder@recorder.$DOMAIN\";" "$PROSODY_HOST"
fi

echo "== 5/7 Jibri configuration and recordings folder"
install -d -m 0755 /opt/jamia
install -m 0755 "$LMS_DIR/tools/jibri-finalize.sh" /opt/jamia/jibri-finalize.sh
install -d -o jibri -g jibri -m 0775 "$REC_DIR"
[[ -f /etc/jitsi/jibri/jibri.conf ]] && cp /etc/jitsi/jibri/jibri.conf "/etc/jitsi/jibri/jibri.conf.bak-$STAMP"
cat > /etc/jitsi/jibri/jibri.conf <<EOF
// Written by tools/jibri-setup.sh (Jamia Ashrafia LMS)
jibri {
  id = "jamia-jibri"
  single-use-mode = false
  recording {
    recordings-directory = "$REC_DIR"
    finalize-script = "/opt/jamia/jibri-finalize.sh"
  }
  api {
    xmpp {
      environments = [
        {
          name = "jamia"
          xmpp-server-hosts = ["127.0.0.1"]
          xmpp-domain = "$DOMAIN"
          control-muc {
            domain = "internal.auth.$DOMAIN"
            room-name = "JibriBrewery"
            nickname = "jamia-jibri"
          }
          control-login {
            domain = "auth.$DOMAIN"
            username = "jibri"
            password = "$JIBRI_PASS"
          }
          call-login {
            domain = "recorder.$DOMAIN"
            username = "recorder"
            password = "$RECORDER_PASS"
          }
          strip-from-room-domain = "conference."
          usage-timeout = 0
          trust-all-xmpp-certs = true
        }
      ]
    }
  }
  call-status-checks {
    // The recording ends on its own when everyone has left
    default-call-empty-timeout = 30 seconds
    no-media-timeout = 30 seconds
    all-muted-timeout = 10 minutes
  }
}
EOF
chmod 0640 /etc/jitsi/jibri/jibri.conf
chown root:jibri /etc/jitsi/jibri/jibri.conf
# The LMS collects finished files: if it does not run as root, it needs the jibri group
LMS_USER="$(ps -o user= -p "$(pgrep -f "$LMS_DIR/server.js" | head -n 1)" 2>/dev/null | tr -d ' ' || true)"
if [[ -n "$LMS_USER" && "$LMS_USER" != "root" ]]; then usermod -aG jibri "$LMS_USER"; fi
[[ "$LMS_PORT" != "3000" ]] && sed -i "s/\${LMS_PORT:-3000}/\${LMS_PORT:-$LMS_PORT}/" /opt/jamia/jibri-finalize.sh

echo "== 6/7 Jicofo and the Jitsi web app"
if ! grep -q "JibriBrewery@internal.auth.$DOMAIN" "$JICOFO"; then
    cp "$JICOFO" "$JICOFO.bak-$STAMP"
    cat >> "$JICOFO" <<EOF

// Jibri recorder (tools/jibri-setup.sh)
jicofo.jibri.brewery-jid = "JibriBrewery@internal.auth.$DOMAIN"
jicofo.jibri.pending-timeout = 90 seconds
EOF
fi
cp "$CONFIG" "$CONFIG.bak-$STAMP"
sed -i '/\/\/ BEGIN JAMIA RECORDING/,/\/\/ END JAMIA RECORDING/d' "$CONFIG"
cat >> "$CONFIG" <<EOF
// BEGIN JAMIA RECORDING (tools/jibri-setup.sh)
config.recordingService = { enabled: true, sharingEnabled: false, hideStorageWarning: true };
config.fileRecordingsEnabled = true;
config.hiddenDomain = 'recorder.$DOMAIN';
// END JAMIA RECORDING
EOF

echo "== 7/7 Restarting services"
systemctl restart prosody
sleep 2
systemctl restart jicofo
systemctl enable jibri >/dev/null 2>&1
systemctl restart jibri
sleep 8
systemctl is-active prosody jicofo jitsi-videobridge2 jibri | paste -sd' ' | sed 's/^/   prosody jicofo jvb jibri: /'
if journalctl -u jibri --since "-1 min" --no-pager | grep -qi "joined.*JibriBrewery\|Jibri.*idle\|status.*IDLE"; then
    echo "   Jibri is connected and idle (ready to record)."
else
    echo "   Check Jibri's log if recording does not start: tail -n 50 /var/log/jitsi/jibri/log.0.txt"
fi
echo
echo "Done. Restart the LMS (pm2 restart jamia-lms), then press Start Recording in a live class."
