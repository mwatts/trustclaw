#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# Setup Telegram webhook for production
#
# Usage:
#   ./scripts/setup-telegram-webhook-prod.sh <domain>
#
# Example:
#   ./scripts/setup-telegram-webhook-prod.sh https://trustclaw.app
#   ./scripts/setup-telegram-webhook-prod.sh trustclaw.app
#
# Reads TELEGRAM_BOT_TOKEN from .env (or prompts if missing).
# Generates a new TELEGRAM_WEBHOOK_SECRET, registers the
# webhook with Telegram, and prints the env vars to paste
# into your production environment.
# ─────────────────────────────────────────────────────────

DOMAIN="${1:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain>"
  echo "  e.g. $0 https://trustclaw.app"
  exit 1
fi

# Normalize: strip trailing slash, ensure https://
DOMAIN="${DOMAIN%/}"
if [[ "$DOMAIN" != https://* ]]; then
  DOMAIN="https://${DOMAIN}"
fi

WEBHOOK_URL="${DOMAIN}/api/telegram-webhook"

# ── Load bot token from .env or prompt ────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

TELEGRAM_BOT_TOKEN=""
if [ -f "$ENV_FILE" ]; then
  TELEGRAM_BOT_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | cut -d= -f2- || true)
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  read -rp "TELEGRAM_BOT_TOKEN (from @BotFather): " TELEGRAM_BOT_TOKEN
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "Error: TELEGRAM_BOT_TOKEN is required"
  exit 1
fi

# ── Get bot username from Telegram API ────────────────────
echo "Fetching bot info..."
BOT_INFO=$(curl -sf "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe")
BOT_OK=$(echo "$BOT_INFO" | jq -r '.ok')

if [ "$BOT_OK" != "true" ]; then
  echo "Error: Invalid TELEGRAM_BOT_TOKEN — getMe failed:"
  echo "$BOT_INFO" | jq .
  exit 1
fi

TELEGRAM_BOT_USERNAME=$(echo "$BOT_INFO" | jq -r '.result.username')
echo "Bot: @${TELEGRAM_BOT_USERNAME}"

# ── Generate a webhook secret ─────────────────────────────
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)

# ── Register webhook with Telegram ────────────────────────
echo ""
echo "Registering webhook..."
echo "  URL: ${WEBHOOK_URL}"
echo ""

RESULT=$(curl -sf "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\"]
  }")

echo "$RESULT" | jq .

OK=$(echo "$RESULT" | jq -r '.ok')
if [ "$OK" != "true" ]; then
  echo "Error: Failed to register webhook"
  exit 1
fi

# ── Print env vars to copy ────────────────────────────────
echo ""
echo "=========================================="
echo "  Webhook registered successfully!"
echo "=========================================="
echo ""
echo "Add these to your production environment:"
echo ""
echo "TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}"
echo "TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME}"
echo "TELEGRAM_WEBHOOK_SECRET=${TELEGRAM_WEBHOOK_SECRET}"
echo ""
echo "=========================================="
