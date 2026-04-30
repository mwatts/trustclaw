#!/usr/bin/env bash
set -euo pipefail

# Load env vars from .env file
ENV_FILE="$(dirname "$0")/../.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

# Source env vars (handle quotes and exports)
set -a
# shellcheck disable=SC1090
source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
set +a

APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:?CRON_SECRET not set in .env}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL not set in .env}"

usage() {
  cat <<EOF
Usage: $(basename "$0") <command> [options]

Commands:
  list                          List all cron jobs with their status
  trigger [--now <datetime>]    Hit the cron endpoint (claims and dispatches due jobs)
                                --now: Override the current time (dev only)
                                Examples: --now "2025-06-15T09:00:00Z"
                                          --now "2025-06-15 14:30:00"
  make-due <job-id> [time]      Set a job's nextRunAt to make it due
                                Optional: specify a past time (default: 1 minute ago)
                                Examples: "2024-01-15 09:00:00", "5 minutes ago"
  unlock <job-id>               Force-clear a job's lock (for stuck jobs)
  status <job-id>               Show detailed status of a specific job

Examples:
  $(basename "$0") list
  $(basename "$0") make-due clxyz123abc
  $(basename "$0") make-due clxyz123abc "10 minutes ago"
  $(basename "$0") trigger
  $(basename "$0") trigger --now "2025-06-15T09:00:00Z"
  $(basename "$0") status clxyz123abc
EOF
  exit 1
}

run_sql() {
  psql "$DATABASE_URL" -t -A -c "$1" 2>/dev/null
}

cmd_list() {
  echo "=== Cron Jobs ==="
  echo ""
  psql "$DATABASE_URL" -c "
    SELECT
      id,
      enabled,
      expression,
      CASE
        WHEN \"lockedAt\" IS NOT NULL THEN 'RUNNING'
        WHEN \"lastError\" IS NOT NULL THEN 'ERRORED'
        WHEN \"nextRunAt\" IS NULL THEN 'IDLE'
        WHEN \"nextRunAt\" <= NOW() THEN 'DUE'
        ELSE 'SCHEDULED'
      END AS status,
      \"nextRunAt\" AS next_run,
      \"lastRunAt\" AS last_run,
      \"lockedAt\" AS locked_at,
      LEFT(\"lastError\", 50) AS last_error,
      LEFT(prompt, 40) AS prompt
    FROM composio_claw_cron_job
    ORDER BY \"nextRunAt\" ASC NULLS LAST;
  " 2>/dev/null
}

cmd_trigger() {
  local now_override=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --now)
        now_override="$2"
        shift 2
        ;;
      *)
        echo "Unknown option: $1"
        usage
        ;;
    esac
  done

  local url="$APP_URL/api/cron/composioclaw"
  if [ -n "$now_override" ]; then
    # URL-encode the datetime
    local encoded
    encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$now_override'))")
    url="${url}?now=${encoded}"
  fi

  echo "=== Triggering cron endpoint ==="
  echo "GET $url"
  if [ -n "$now_override" ]; then
    echo "Time override: $now_override"
  fi
  echo ""

  response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$url")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)

  echo "HTTP $http_code"
  echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
}

cmd_make_due() {
  local job_id="${1:?Job ID required}"
  local time_expr="${2:-1 minute ago}"

  # Convert human-readable time to timestamp using date command
  if [[ "$time_expr" == *"ago"* ]]; then
    # Parse "N units ago" format
    local amount unit
    amount=$(echo "$time_expr" | awk '{print $1}')
    unit=$(echo "$time_expr" | awk '{print $2}')
    target_time=$(date -u -v-"${amount}${unit:0:1}" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || \
                  date -u -d "$time_expr" +"%Y-%m-%d %H:%M:%S" 2>/dev/null)
  else
    target_time="$time_expr"
  fi

  echo "Setting job $job_id nextRunAt to: $target_time (UTC)"
  echo ""

  run_sql "
    UPDATE composio_claw_cron_job
    SET \"nextRunAt\" = '$target_time'::timestamptz,
        \"lockedAt\" = NULL,
        \"lockedBy\" = NULL
    WHERE id = '$job_id'
    RETURNING id, \"nextRunAt\", enabled;
  "

  if [ $? -eq 0 ]; then
    echo "Done. Run '$(basename "$0") trigger' to execute it."
  else
    echo "Failed to update job. Check the job ID."
  fi
}

cmd_unlock() {
  local job_id="${1:?Job ID required}"

  echo "Force-clearing lock on job $job_id"

  run_sql "
    UPDATE composio_claw_cron_job
    SET \"lockedAt\" = NULL,
        \"lockedBy\" = NULL
    WHERE id = '$job_id'
    RETURNING id, enabled, \"nextRunAt\";
  "
}

cmd_status() {
  local job_id="${1:?Job ID required}"

  psql "$DATABASE_URL" -c "
    SELECT
      cj.id,
      cj.enabled,
      cj.expression,
      cj.timezone,
      cj.\"nextRunAt\",
      cj.\"lastRunAt\",
      cj.\"lockedAt\",
      cj.\"lockedBy\",
      cj.\"lastError\",
      cj.prompt,
      ci.\"telegramChatId\"
    FROM composio_claw_cron_job cj
    JOIN composio_claw_instance ci ON cj.\"instanceId\" = ci.id
    WHERE cj.id = '$job_id';
  " 2>/dev/null
}

# --- Main ---
command="${1:-}"
shift || true

case "$command" in
  list)      cmd_list ;;
  trigger)   cmd_trigger "$@" ;;
  make-due)  cmd_make_due "$@" ;;
  unlock)    cmd_unlock "$@" ;;
  status)    cmd_status "$@" ;;
  *)         usage ;;
esac
