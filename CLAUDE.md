# Kitchen Sink — agent & contributor guide

Kitchen Sink is Nuon's demo app config: a real web app (UI + API + worker) plus
the full surface of the Nuon platform (components, actions, runbooks, an app
branch, triggers, policies, permissions, break-glass, component health). It is
installed into AWS accounts via Nuon; `control-plane.md` is the install page's
programmable readme, and `components/ui` is a guided tour of the platform that
deploys as the app itself.

## Layout

- `components/*.toml` — component definitions; sources under `components/{api,ui,chart,pulumi}` and `src/components/{alb,certificate}`
- `actions/` — scripts run on the install's runner (cron / manual / lifecycle triggers)
- `runbooks/` — multi-step operational procedures (`.toml` + rendered `.md`)
- `branch.toml`, `triggers.toml`, `installs.toml` — app branch with staged install groups, event trigger rules, install configs
- `inputs/`, `input_groups/`, `secrets.toml` — per-install parameters
- `policies/` (OPA), `permissions/` (per-operation IAM roles + boundaries), `break_glass.toml`
- `sandbox.toml`, `stack.toml`, `runner.toml` — infrastructure foundation

## Hard-won rules (violations fail at sync time, not validate time)

1. **`docker_build` components are deprecated** — the control plane rejects them
   on sync even though `nuon apps validate` passes. Images are pre-built and
   pushed to ECR with `scripts/build-and-push-all.sh` (needs docker + AWS creds
   for the ECR account), which also stamps the `tag =` lines in
   `components/images/*.toml`. A source change under `components/ui` or
   `components/api` ships ONLY via that script + a config sync.
2. **Component health probes run on the RUNNER, outside the cluster.**
   `*.svc.cluster.local` URLs fail with "no such host". Probe only
   runner-resolvable endpoints (e.g. the public ALB URL). In-cluster serving is
   covered by pod readiness via the automatic assessment.
3. **`branch.toml` must declare the repo the same way components do** — this
   repo resolves as public, so use `[public_repo]`. PR previews depend on the
   org's GitHub App covering the repo owner, not on this block.
4. **Branch pinning:** `components/chart/nuon.toml`, `components/images/*.toml`
   comments, and `branch.toml` currently track `ms/onboarding-edit`. When that
   branch merges, flip each marked `branch =` back to `"main"` (grep for
   "flip back").
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
  client-side (see `components/ui/README.md`).
- Control-plane operations: agents explicitly granted Nuon API access by a
  maintainer may validate and sync this app config and read app/install state.
  Use the public API (https://api.nuon.co/docs) — e.g. config sync is
  `POST /v1/apps/{app_id}/configs/{config_id}/sync`; requests need the API
  token and an `X-Nuon-Org-ID` header. Heavier operations — deploys, branch-run
  approvals, install create/deprovision/delete — still need an explicit
  human go-ahead in the task at hand, per operation. Never commit tokens or
  org/app IDs-with-credentials to this (public) repo; credentials live only
  in the agent's provisioned connector.
