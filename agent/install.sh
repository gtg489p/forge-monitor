#!/usr/bin/env bash
# Forge Monitor Agent — Linux systemd installer
# Usage: sudo bash agent/install.sh
set -e

AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="forge-agent"
SERVICE_USER="${SERVICE_USER:-$(logname 2>/dev/null || echo "$SUDO_USER" || whoami)}"

echo "[install] Forge Monitor Agent installer"
echo "[install] Agent dir: $AGENT_DIR"
echo "[install] Service user: $SERVICE_USER"

# Ensure .env exists
if [ ! -f "$AGENT_DIR/.env" ]; then
  cp "$AGENT_DIR/.env.example" "$AGENT_DIR/.env"
  echo ""
  echo "[install] Created $AGENT_DIR/.env from template."
  echo "[install] Edit it with your hub URL, node ID, and secret, then re-run:"
  echo "          sudo bash $AGENT_DIR/install.sh"
  exit 0
fi

# Locate bun
BUN_PATH=$(su - "$SERVICE_USER" -c 'which bun 2>/dev/null || echo ""' || true)
if [ -z "$BUN_PATH" ]; then
  BUN_PATH="/home/$SERVICE_USER/.bun/bin/bun"
fi
if [ ! -x "$BUN_PATH" ]; then
  echo "[error] bun not found at $BUN_PATH"
  echo "        Install bun as $SERVICE_USER: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

echo "[install] Using bun at: $BUN_PATH"

# Write systemd unit
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Forge Monitor Push Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$AGENT_DIR
EnvironmentFile=$AGENT_DIR/.env
ExecStart=$BUN_PATH run $AGENT_DIR/agent.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo ""
echo "[install] Done! Service '$SERVICE_NAME' is running."
echo "  Status:  systemctl status $SERVICE_NAME"
echo "  Logs:    journalctl -u $SERVICE_NAME -f"
echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
