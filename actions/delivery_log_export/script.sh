#!/usr/bin/env sh
# Diagnostics go to STDOUT (captured as the action's logs). Do NOT write
# free-form text to $NUON_ACTIONS_OUTPUT_FILEPATH — Nuon parses that file as
# structured outputs (a JSON object or k=v lines).
#
# Exports the recent delivery record to the install's private S3 bucket
# (created by pulumi_infra). Runs on the runner: the fetch goes through the
# public ALB, the write uses the runner's actions role — its s3:PutObject is
# scoped to this one bucket's delivery-logs/ prefix (permissions/actions.toml).
set -uo pipefail

echo "=== Caller identity (the runner's actions role; pods carry no IAM) ==="
if command -v aws >/dev/null 2>&1; then
  aws sts get-caller-identity 2>&1 || true
else
  echo "aws CLI not on PATH"
fi

fail() {
  echo "$1"
  {
    printf 'status=failed\n'
    printf 'reason=%s\n' "$2"
    printf 'exported_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
  exit 1
}

echo "=== Fetching the delivery record via the public console API ==="
stats=$(curl -fsS --max-time 15 "$APP_URL/api/delivery/stats") || fail "stats unreachable" stats_unreachable
events=$(curl -fsS --max-time 30 "$APP_URL/api/delivery/events?limit=200") || fail "events unreachable" events_unreachable
dlq=$(curl -fsS --max-time 15 "$APP_URL/api/delivery/dlq") || fail "dlq unreachable" dlq_unreachable
echo "$stats"

now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
snapshot=/tmp/relay-delivery-log.json
printf '{"exported_at":"%s","install_id":"%s","stats":%s,"events":%s,"dlq":%s}\n' \
  "$now" "${NUON_INSTALL_ID:-unknown}" "$stats" "$events" "$dlq" > "$snapshot"

key="delivery-logs/$(date -u +%Y/%m/%d)/relay-$(date -u +%Y%m%dT%H%M%SZ).json"
echo "=== Writing s3://$ARCHIVE_BUCKET/$key ==="
aws s3 cp "$snapshot" "s3://$ARCHIVE_BUCKET/$key" 2>&1 || fail "s3 write failed" s3_write_failed

events_exported=$(grep -o '"id":"evt_' "$snapshot" | wc -l | tr -d ' ')
echo "archived $events_exported event(s)"

# Structured outputs for Nuon (valid k=v).
{
  printf 'status=ok\n'
  printf 's3_uri=s3://%s/%s\n' "$ARCHIVE_BUCKET" "$key"
  printf 'events_exported=%s\n' "$events_exported"
  printf 'exported_at=%s\n' "$now"
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
