# Relay — agent & contributor guide

Relay is Nuon's demo app config: a self-hosted webhook delivery platform
(ingest API, Postgres-backed queue, delivery worker with retries/backoff and a
DLQ, echo receiver as the seeded destination, console UI) built on the full
surface of the Nuon platform (components, actions, runbooks, an app branch,
triggers, policies, permissions, break-glass, component health). It is
installed into AWS accounts via Nuon; `control-plane.md` is the install page's
programmable readme, and `components/ui` is the Relay console — it doubles as
a guided tour of the platform. The repo keeps its historical name
`nuonco/kitchen-sink` (ECR repos and CI trigger filters depend on it); the
product, Kubernetes namespace, and workload names are `relay`.

## Layout

- `components/*.toml` — component definitions; sources under `components/{api,ui,chart,pulumi}` and `src/components/{alb,audit-log-exporter,certificate,tictactoe}`
- `components/api` — one Go binary dispatching on env `RELAY_MODE`: `api` (ingest + delivery read endpoints, :8080), `worker` (delivery engine), `echo` (receiver, :8081), `generate` (one-shot event poster)
- `components/chart` — runs `relay-api`, `relay-ui`, `relay-worker`, plus `relay-db` (Postgres 16, emptyDir — data resets on pod restart; migrations + seed are idempotent), `relay-echo`, and the `relay-event-generator` CronJob (every 2 min)
- `actions/` — scripts run on the install's runner (cron / manual / lifecycle triggers); `cron_status` is the hourly heartbeat (structured outputs read by `control-plane.md`), `delivery_log_export` archives stats/events/DLQ to S3 every 6h
- `runbooks/` — multi-step operational procedures (`.toml` + rendered `.md`)
- `branch.toml`, `triggers.toml`, `installs.toml` — app branch with staged install groups, event trigger rules, install configs
- `inputs/`, `input_groups/`, `secrets.toml` — per-install parameters
- `policies/` (OPA), `permissions/` (per-operation IAM roles + boundaries), `break_glass.toml`
- `sandbox.toml`, `stack.toml`, `runner.toml` — infrastructure foundation

## Hard-won rules (violations fail at sync time, not validate time)

1. **`docker_build` components are deprecated** — the control plane rejects them
   on sync even though `nuon apps validate` passes. Images are pre-built:
   pushes touching `components/ui` or `components/api` are built and published
   to Nuon's public ECR gallery by `.github/workflows/build-images.yaml`
   (shared org OIDC role — no secrets), which then stamps the `tag =` lines in
   `components/images/*.toml`; that stamp commit starts the staged rollout.
   `scripts/build-and-push*.sh` remain as the manual fallback (need docker +
   AWS creds).
2. **Component health probes run on the RUNNER, outside the cluster.**
   `*.svc.cluster.local` URLs fail with "no such host". Probe only
   runner-resolvable endpoints (e.g. the public ALB URL). In-cluster serving is
   covered by pod readiness via the automatic assessment. (Action and runbook
   scripts follow the same rule: they read delivery state through the public
   ALB, never via in-cluster service names.)
3. **`branch.toml` must declare the repo the same way components do** — this
   repo resolves as public, so use `[public_repo]`. PR previews depend on the
   org's GitHub App covering the repo owner, not on this block.
4. **Branch pinning:** `branch.toml`, `triggers.toml`, `installs.toml`, and the
   component pins in `components/chart/nuon.toml`, `components/alb.toml`,
   `components/pulumi/nuon.toml`, `components/tictactoe.toml`, and
   `components/audit_log_exporter.toml` currently track `ms/theme-relay`. When
   that branch merges, flip each marked `branch =` back to `"main"` (grep for
   "flip back"). `components/certificate.toml` stays pinned to `main` — its
   source is untouched on the theme branch. Never rename a component without
   updating every dependency/`component_name`/trigger reference in the same
   commit.
5. `nuon apps validate` requires an authenticated Nuon CLI and the app to exist.
   Without it, check TOML syntax and chart rendering only — note plain
   `helm template` on `components/chart` fails without `--set` overrides
   because image values are Nuon templates (interpolated before Helm runs).

## Conventions

- Branches: `ms/<name>` style; never merge to `main` without maintainer review.
- No AI attribution trailers or generated-with footers in commits or PRs.
- Prefer pushing a branch and sharing the compare link over opening PRs
  directly; a maintainer opens and merges PRs.
- The UI's `/api/` proxy (`components/ui/apifilter.go`) is a security boundary
  on a public load balancer — never widen its allowlist or move redaction
  client-side (see `components/ui/README.md`). In particular, `POST /ingest`
  is in-cluster only and must never be allowlisted.
- Shipping config changes: **push to the tracked branch — that's the whole
  interface.** The repo's webhook + the `github-push-tracked-branch` rule in
  `triggers.toml` turn every push to the tracked branch into a staged branch
  run (Nuon fetches the config at that commit, builds, and rolls out with an
  approval hold per install group). Agents and CI never need a Nuon API token
  to ship. Router lag between webhook delivery and the run appearing is
  ~1–2 minutes — don't retry or replay before then.
- Nuon API access (optional, read-oriented): agents with a provisioned token
  may read app/install state via https://api.nuon.co/docs (requests need an
  `X-Nuon-Org-ID` header). Deploys, branch-run approvals, and install
  create/deprovision/delete always need an explicit human go-ahead per task.
  Never commit tokens to this (public) repo.
- Published CLI commands must not depend on the reader's CLI state:
  `nuon sync` inherits its target app from `~/.nuon` selected-app state, so
  always pin `--app-id <id>` (plus `--force` for the clone-dir/app-name
  check).
