#!/usr/bin/env bash
set -euo pipefail

# Load .env from dashboard root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env not found at $ENV_FILE"
  exit 1
fi

TELEGRAM_BOT_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
TELEGRAM_WEBHOOK_SECRET=$(grep '^TELEGRAM_WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2-)

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_WEBHOOK_SECRET" ]; then
  echo "Error: TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be set in .env"
  exit 1
fi

PORT="${1:-3000}"

# Check ngrok is installed
if ! command -v ngrok &>/dev/null; then
  echo "Error: ngrok is not installed. Install it from https://ngrok.com"
  exit 1
fi

# Start ngrok in the background
echo "Starting ngrok on port $PORT..."
ngrok http "$PORT" --log=stdout --log-level=warn &>/dev/null &
NGROK_PID=$!

cleanup() {
  echo ""
  echo "Shutting down ngrok (pid $NGROK_PID)..."
  kill "$NGROK_PID" 2>/dev/null || true

  echo "Removing Telegram webhook..."
  curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook" | jq .
  echo "Done."
}
trap cleanup EXIT

# Wait for ngrok to be ready
echo "Waiting for ngrok tunnel..."
for i in $(seq 1 20); do
  NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[] | select(.proto=="https") | .public_url' 2>/dev/null || true)
  if [ -n "$NGROK_URL" ]; then
    break
  fi
  sleep 0.5
done

if [ -z "$NGROK_URL" ]; then
  echo "Error: Failed to get ngrok URL. Is ngrok running already?"
  exit 1
fi

WEBHOOK_URL="${NGROK_URL}/api/telegram-webhook"
echo ""
echo "ngrok URL:   $NGROK_URL"
echo "Webhook URL: $WEBHOOK_URL"
echo ""

# Register webhook with Telegram
echo "Registering webhook with Telegram..."
RESULT=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
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

echo ""
echo "Webhook is live. Press Ctrl+C to stop."
echo ""

# Keep running until interrupted
wait "$NGROK_PID"
