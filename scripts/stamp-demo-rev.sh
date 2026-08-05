#!/usr/bin/env bash
#
# Stamp the kitchen_sink component's `demo_rev` label with a fresh value so the
# component's config checksum changes, forcing a branch run to redeploy it (and
# re-exercise the custom health check).
#
# Why: a branch run only deploys components whose resolved config checksum
# differs from the install's current config. That checksum hashes labels but NOT
# chart/values.yaml contents, and templates like {{ now }} are hashed as literal
# strings (they render later on the runner), so neither auto-changes. A changing
# literal label value is the only thing that flips the checksum.
#
# Run manually before a commit, or let the pre-commit hook run it automatically.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
nuon_toml="$repo_root/components/chart/nuon.toml"

rev="$(date +%s)"

# Portable in-place edit (BSD/GNU sed differ on -i). Write the temp file next to
# the target so it stays on the same filesystem and needs no global temp dir.
tmp="$nuon_toml.stamp.$$"
sed -E "s/^demo_rev = \".*\"/demo_rev = \"$rev\"/" "$nuon_toml" > "$tmp"
mv "$tmp" "$nuon_toml"

echo >&2 "stamped demo_rev = \"$rev\" in components/chart/nuon.toml"
