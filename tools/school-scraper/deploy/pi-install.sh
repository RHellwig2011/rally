#!/usr/bin/env bash
# Install schoolscraper on a Raspberry Pi (Debian/Raspberry Pi OS).
# Run as root: sudo bash pi-install.sh
set -euo pipefail

INSTALL_DIR=/opt/schoolscraper
DATA_DIR=/var/lib/schoolscraper
ETC_DIR=/etc/schoolscraper
SERVICE_USER=schoolscraper

if [[ $EUID -ne 0 ]]; then
    echo "Please run as root: sudo bash $0"
    exit 1
fi

echo "==> Installing system packages"
apt-get update
apt-get install -y python3 python3-venv python3-pip git \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2

echo "==> Creating service user and directories"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$INSTALL_DIR" "$DATA_DIR"
install -d -m 0750 "$ETC_DIR"

echo "==> Copying source"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
rsync -a --delete --exclude='.venv' --exclude='__pycache__' --exclude='*.db' \
    "$SRC_DIR/" "$INSTALL_DIR/"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

echo "==> Creating virtualenv and installing"
sudo -u "$SERVICE_USER" python3 -m venv "$INSTALL_DIR/.venv"
sudo -u "$SERVICE_USER" "$INSTALL_DIR/.venv/bin/pip" install --upgrade pip
sudo -u "$SERVICE_USER" "$INSTALL_DIR/.venv/bin/pip" install -e "$INSTALL_DIR"

echo "==> Installing Playwright browsers (this can take a few minutes on a Pi)"
sudo -u "$SERVICE_USER" "$INSTALL_DIR/.venv/bin/playwright" install chromium

if [[ ! -f "$ETC_DIR/schoolscraper.env" ]]; then
    echo "==> Writing initial config to $ETC_DIR/schoolscraper.env (edit before starting!)"
    cp "$INSTALL_DIR/.env.example" "$ETC_DIR/schoolscraper.env"
    MASTER_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
    API_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
    sed -i "s|^SCHOOLSCRAPER_MASTER_KEY=.*|SCHOOLSCRAPER_MASTER_KEY=$MASTER_KEY|" "$ETC_DIR/schoolscraper.env"
    sed -i "s|^SCHOOLSCRAPER_API_TOKEN=.*|SCHOOLSCRAPER_API_TOKEN=$API_TOKEN|" "$ETC_DIR/schoolscraper.env"
    sed -i "s|^SCHOOLSCRAPER_CACHE_PATH=.*|SCHOOLSCRAPER_CACHE_PATH=$DATA_DIR/schoolscraper.db|" "$ETC_DIR/schoolscraper.env"
    chmod 0640 "$ETC_DIR/schoolscraper.env"
    chown root:"$SERVICE_USER" "$ETC_DIR/schoolscraper.env"
fi

echo "==> Installing systemd unit"
install -m 0644 "$INSTALL_DIR/deploy/schoolscraper.service" /etc/systemd/system/schoolscraper.service
systemctl daemon-reload
systemctl enable schoolscraper.service

cat <<EOF

Done. Next steps:

  1. Edit $ETC_DIR/schoolscraper.env and add ANTHROPIC_API_KEY (and ALEXA_SKILL_ID
     once you've created the skill).
  2. Add at least one student profile:
        sudo -u $SERVICE_USER $INSTALL_DIR/.venv/bin/schoolscraper users add bob
  3. Start the service:
        sudo systemctl start schoolscraper
  4. Verify it's healthy:
        curl http://localhost:8765/health
  5. Set up Cloudflare Tunnel (see deploy/CLOUDFLARE_TUNNEL.md) so Alexa can
     reach the Pi over HTTPS.

EOF
