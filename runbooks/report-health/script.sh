#!/usr/bin/env bash
# Re-report a component custom health check via the Nuon API, using values
# mapped from the trigger event payload into runbook inputs.
#
# Requires NUON_API_URL, NUON_API_TOKEN, and NUON_ORG_ID to be available to the
# action step (e.g. via a secret), plus jq and curl on the runner.
set -euo pipefail

: "${NUON_API_URL:?NUON_API_URL required}"
: "${NUON_API_TOKEN:?NUON_API_TOKEN required}"
: "${NUON_ORG_ID:?NUON_ORG_ID required}"

# The install to report for comes from the event payload (mapped to a runbook
# input), NOT {{.nuon.install.id}} — the runbook runs on a fixed "reporter"
# install but writes health for whichever install the event names.
install='{{.runbook_inputs.install}}'
component='{{.runbook_inputs.component}}'
check='{{.runbook_inputs.check}}'
status='{{.runbook_inputs.status}}'
message='{{.runbook_inputs.message}}'
details='{{.runbook_inputs.details}}'

body="$(jq -n \
  --arg status "$status" \
  --arg message "$message" \
  --argjson details "$([ -n "$details" ] && printf '%s' "$details" || printf 'null')" \
  '{status: $status}
    + (if $message != "" then {message: $message} else {} end)
    + (if $details  != null then {details: $details} else {} end)')"

curl -fsS -X PUT \
  "${NUON_API_URL%/}/v1/installs/${install}/components/${component}/health/checks/${check}" \
  -H "Authorization: Bearer ${NUON_API_TOKEN}" \
  -H "X-Nuon-Org-ID: ${NUON_ORG_ID}" \
  -H "Content-Type: application/json" \
  -d "$body"

echo "reported ${check}=${status} for component ${component}"
