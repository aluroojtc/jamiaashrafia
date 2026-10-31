#!/usr/bin/env bash
#
# JAMIA ASHRAFIA LAHORE - JITSI BRANDING
#   sudo bash tools/jitsi-branding.sh https://lms.example.org
#
# Brands the self-hosted Jitsi (Debian packages) with the Jamia crest and colours:
# - the crest replaces the Jitsi logo in meetings and the browser tab, and links back to the LMS;
# - "Jitsi Meet" becomes "Jamia Ashrafia Virtual Dars"; mobile-app and Jitsi promotions are hidden;
# - the public start page (meet.<domain>/) redirects to the LMS, since classes are joined from the portal.
# Everything lives in /etc (config files and nginx), so Jitsi package upgrades keep it. Safe to run again.

set -euo pipefail

LMS_URL="${1:-}"
DOMAIN="${JITSI_DOMAIN:-meet.jamiaashrafia.asia}"
LMS_DIR="${LMS_DIR:-/var/www/jamiaashrafia}"
APP_NAME="Jamia Ashrafia Virtual Dars"
PROVIDER="Jamia Ashrafia Lahore"
BG="#0a333d"   # --primary-900 in css/main.css

[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }
[[ "$LMS_URL" =~ ^https?:// ]] || { echo "Usage: sudo bash $0 https://your-lms-address"; exit 1; }

CONFIG="/etc/jitsi/meet/$DOMAIN-config.js"
IFACE="/etc/jitsi/meet/$DOMAIN-interface_config.js"
NGINX="/etc/nginx/sites-available/$DOMAIN.conf"
BRAND_DIR="/etc/jitsi/meet/branding"
SNIPPET="/etc/nginx/snippets/jitsi-branding.conf"
STAMP="$(date +%Y%m%d-%H%M%S)"

for f in "$CONFIG" "$NGINX" "$LMS_DIR/assets/images/crest.png"; do
    [[ -f "$f" ]] || { echo "Not found: $f"; exit 1; }
done

cp "$CONFIG" "$CONFIG.bak-$STAMP"
cp "$NGINX" "$NGINX.bak-$STAMP"

# Images, copied from the LMS
mkdir -p "$BRAND_DIR"
cp "$LMS_DIR/assets/images/crest.png" "$BRAND_DIR/logo.png"
cp "$LMS_DIR/assets/images/favicon.png" "$BRAND_DIR/favicon.png"

# config.js: overrides appended between markers, replaced on every run
sed -i '/\/\/ BEGIN JAMIA BRANDING/,/\/\/ END JAMIA BRANDING/d' "$CONFIG"
cat >> "$CONFIG" <<EOF
// BEGIN JAMIA BRANDING
config.defaultLogoUrl = '/branding/logo.png';
config.disableDeepLinking = true;
config.deeplinking = { disabled: true };
// Invite links cannot be used: joining needs a token issued by the LMS
config.disableInviteFunctions = true;
// END JAMIA BRANDING
EOF

# interface_config.js: own copy in /etc, served instead of the packaged one
if [[ -f "$IFACE" ]]; then
    cp "$IFACE" "$IFACE.bak-$STAMP"
else
    cp /usr/share/jitsi-meet/interface_config.js "$IFACE"
fi
sed -i '/\/\/ BEGIN JAMIA BRANDING/,/\/\/ END JAMIA BRANDING/d' "$IFACE"
cat >> "$IFACE" <<EOF
// BEGIN JAMIA BRANDING
Object.assign(interfaceConfig, {
    APP_NAME: '$APP_NAME',
    NATIVE_APP_NAME: '$APP_NAME',
    PROVIDER_NAME: '$PROVIDER',
    DEFAULT_LOGO_URL: '/branding/logo.png',
    DEFAULT_WELCOME_PAGE_LOGO_URL: '/branding/logo.png',
    JITSI_WATERMARK_LINK: '$LMS_URL',
    SHOW_JITSI_WATERMARK: true,
    SHOW_WATERMARK_FOR_GUESTS: true,
    SHOW_BRAND_WATERMARK: false,
    SHOW_POWERED_BY: false,
    DEFAULT_BACKGROUND: '$BG',
    MOBILE_APP_PROMO: false,
    HIDE_DEEP_LINKING_LOGO: true,
    DISPLAY_WELCOME_FOOTER: false,
    SHOW_PROMOTIONAL_CLOSE_PAGE: false
});
// END JAMIA BRANDING
EOF

# nginx: branding files, favicon, own interface_config.js and the start-page redirect
mkdir -p /etc/nginx/snippets
{
    echo "# Jamia Ashrafia branding for $DOMAIN (tools/jitsi-branding.sh)"
    echo "location = / { return 302 $LMS_URL; }"
    # ^~ so Jitsi's /<tenant>/<room> regex location does not take these requests
    echo "location ^~ /branding/ { alias $BRAND_DIR/; }"
    echo "location = /images/favicon.svg { types { } default_type image/png; alias $BRAND_DIR/favicon.png; }"
    echo "location = /favicon.ico { types { } default_type image/png; alias $BRAND_DIR/favicon.png; }"
    grep -q 'location = /interface_config.js' "$NGINX" || echo "location = /interface_config.js { alias $IFACE; }"
} > "$SNIPPET"
# Where the site already serves interface_config.js, point it at the copy in /etc
sed -i "/location = \/interface_config.js/,+3 s|alias [^;]*interface_config[^;]*;|alias $IFACE;|" "$NGINX"

# Include the snippet once, in the HTTPS server block (the one that serves config.js)
if ! grep -q "$SNIPPET" "$NGINX"; then
    grep -q 'location = /config.js' "$NGINX" || { echo "Could not find 'location = /config.js' in $NGINX; add 'include $SNIPPET;' to its HTTPS server block by hand."; exit 1; }
    sed -i "0,/location = \/config.js/s||include $SNIPPET;\n\n    &|" "$NGINX"
fi

if nginx -t; then
    systemctl reload nginx
    echo "Done. Open https://$DOMAIN/ (should go to the LMS) and start a class from the LMS to see the crest."
else
    echo "nginx test failed; restoring the previous nginx config."
    cp "$NGINX.bak-$STAMP" "$NGINX"
    exit 1
fi
