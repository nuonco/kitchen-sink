#!/usr/bin/env sh
# Diagnostics go to STDOUT (captured as the action's logs). Do NOT write
# free-form text to $NUON_ACTIONS_OUTPUT_FILEPATH — Nuon parses that file as
# structured outputs (a JSON object or k=v lines), so a raw dump fails with
# "unsupported outputs format".
#
# Runs under the break-glass role — the only principal the bucket policy
# allows to read objects. If break glass is disabled, the role can't be
# assumed and this run never gets this far.
set -uo pipefail

echo "=== Caller identity (should be the break-glass role) ==="
aws sts get-caller-identity 2>&1 || true

echo "=== Pulling s3://$BUCKET/$KEY ==="
if aws s3 cp "s3://$BUCKET/$KEY" - 2>&1; then
  status=ok
else
  status=denied
fi

# Structured outputs for Nuon (valid k=v).
{
  printf 'status=%s\n' "$status"
  printf 'object=s3://%s/%s\n' "$BUCKET" "$KEY"
  printf 'pulled_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"

[ "$status" = "ok" ]
