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
- `branch.toml`, `triggers.toml.example`, `installs.toml` — app branch with staged install groups, event trigger rules (shipped disabled — see the file header), install configs
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
   The stamp arrives as an auto-merge PR from a `ci/stamp-*` branch, not a
   direct push — `main` requires signed commits and a pull request, and neither
   is bypassable by `GITHUB_TOKEN` (see `scripts/stamp-image-tags.sh`). **A
   merged source change does not roll out until its stamp PR is approved**;
   until then the config stays pinned to the previous tag.
   `scripts/build-and-push*.sh` remain as the manual fallback (need docker +
   AWS creds).
2. **Component health probes run on the RUNNER, outside the cluster.**
   `*.svc.cluster.local` URLs fail with "no such host". Probe only
   runner-resolvable endpoints (e.g. the public ALB URL). In-cluster serving is
   covered by pod readiness via the automatic assessment.
3. **`branch.toml` must declare the repo the same way components do** — this
   repo resolves as public, so use `[public_repo]`. PR previews depend on the
   org's GitHub App covering the repo owner, not on this block.
4. **Branch pinning:** `components/chart/nuon.toml`, the component tomls, and
   `branch.toml` track `main`. If work moves to a feature branch, pin each
   `branch =` to it and flip them all back to `"main"` when the branch merges.
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
- Shipping config changes: **push to the tracked branch — that's the whole
  interface.** The repo's webhook + the `github-push-tracked-branch` rule
  turn every push to the tracked branch into a staged branch run (Nuon
  fetches the config at that commit, builds, and rolls out with an approval
  hold per install group). Agents and CI never need a Nuon API token to
  ship. Router lag between webhook delivery and the run appearing is
  ~1–2 minutes — don't retry or replay before then.
  CAVEAT: the rules ship disabled as `triggers.toml.example` (a fresh org's
  sync fails on rules referencing its missing `github-events` trigger).
  Trigger rules belong to the app config version that synced them and
  routing consults only the latest active config, so push-to-ship works only
  while the org's active config was synced from a tree with the file enabled
  — re-enable by renaming it back locally and running
  `nuon sync --app-id <id> --force`.
- Nuon access for agents: use the Nuon MCP server, not raw API calls. The
  repo ships a project `.mcp.json` that runs `nuon agents mcp` (the CLI's
  stdio proxy, which reuses the CLI's login); `nuon agents context` prints the
  current org, app, and install ids and the tool table. Prefer MCP tools for
  reads (`whoami`, `list_installs`, `get_install`, `list_app_branches`,
  `get_app_branch`, `list_workflows`, logs). Write tools are hidden unless the
  proxy runs with `--allow-writes`; even then, deploys, branch-run approvals,
  previews in `apply` mode, and install create/deprovision/delete need an
  explicit human go-ahead per task. Where no MCP tool exists (syncing local
  config, running a runbook, config versions), fall back to the CLI with
  `--output agent --read-only`. Never commit tokens to this (public) repo.
