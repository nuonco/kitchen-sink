# Kitchen Sink

{{ $accountId := dig "account_id" "000000000000" .nuon.install_stack.outputs }}
{{ $region := .nuon.cloud_account.aws.region }}
{{ $vpcId := dig "vpc_id" "vpc-000000" .nuon.install_stack.outputs }}
{{- $comps := default dict .nuon.components -}}
{{- $cR := 0 -}}{{- range $n, $c := $comps }}{{ if eq (dig "status" "" $c) "active" }}{{ $cR = add $cR 1 }}{{ end }}{{ end -}}
{{- $cT := len $comps -}}

{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}
<div style="border:1px solid rgba(127,127,127,0.3);border-radius:12px;padding:30px 24px;margin:4px 0 6px;text-align:center;background:rgba(127,127,127,0.06);">
<div style="font-size:0.78em;font-weight:700;letter-spacing:0.09em;opacity:0.55;margin-bottom:12px;">PUBLIC URL</div>
<div style="font-size:1.75em;font-weight:800;line-height:1.2;"><a href="https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/">Open the app ↗</a></div>
<div style="font-family:monospace;font-size:0.85em;opacity:0.6;margin-top:10px;">app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}</div>
<div style="font-size:0.9em;opacity:0.75;margin-top:14px;max-width:34em;margin-left:auto;margin-right:auto;line-height:1.5;">The app explains each part of the platform against this install's live state.</div>
</div>
{{ else }}
<div style="border:1px solid rgba(127,127,127,0.3);border-radius:12px;padding:26px 24px;margin:4px 0 6px;text-align:center;background:rgba(127,127,127,0.06);">
<div style="font-size:1.15em;font-weight:700;">The app's public URL appears here once the sandbox finishes provisioning.</div>
</div>
{{ end }}

Deployed into AWS account `{{ $accountId }}` ({{ $region }}) by Nuon, from [nuonco/kitchen-sink](https://github.com/nuonco/kitchen-sink).

<nuon-tabs>

<nuon-tab name="status">

<div style="padding-top:1rem;"></div>

## Five health checks

{{ $acts := default dict .nuon.actions -}}
{{ if dig "populated" false $acts -}}
{{- $wf := default dict (dig "workflows" dict $acts) -}}
{{- $nodes := default dict (index $wf "health_nodes") -}}
{{- $nodesOut := default dict (dig "outputs" dict $nodes) -}}
{{- $roll := default dict (index $wf "health_rollout") -}}
{{- $rollOut := default dict (dig "outputs" dict $roll) -}}
{{- $ing := default dict (index $wf "health_ingress") -}}
{{- $ingOut := default dict (dig "outputs" dict $ing) -}}
{{- $end := default dict (index $wf "health_endpoint") -}}
{{- $endOut := default dict (dig "outputs" dict $end) -}}
{{- $pods := default dict (index $wf "cron_status") -}}
{{- $podsOut := default dict (dig "outputs" dict $pods) -}}

| Check | State | Detail |
|---|---|---|
| Nodes | {{ if eq (dig "status" "" $nodes) "error" }}failed{{ else if ne (dig "status" "" $nodes) "finished" }}not yet run{{ else if eq (len $nodesOut) 0 }}no data{{ else if and (ne (toString (dig "node_count" "0" $nodesOut)) "0") (eq (toString (dig "nodes_ready" "?" $nodesOut)) (toString (dig "node_count" "!" $nodesOut))) }}healthy{{ else }}degraded{{ end }} | {{ dig "nodes_ready" "n/a" $nodesOut }} of {{ dig "node_count" "n/a" $nodesOut }} ready |
| Workloads | {{ if eq (dig "status" "" $pods) "error" }}failed{{ else if ne (dig "status" "" $pods) "finished" }}not yet run{{ else if eq (len $podsOut) 0 }}no data{{ else if eq (toString (dig "status" "?" $podsOut)) "ok" }}healthy{{ else }}degraded{{ end }} | {{ dig "pods_ready" "n/a" $podsOut }} of {{ dig "pods_total" "n/a" $podsOut }} pods ready |
| Rollouts | {{ if eq (dig "status" "" $roll) "error" }}failed{{ else if ne (dig "status" "" $roll) "finished" }}not yet run{{ else if eq (len $rollOut) 0 }}no data{{ else if and (eq (toString (dig "api_rollout" "?" $rollOut)) "complete") (eq (toString (dig "ui_rollout" "?" $rollOut)) "complete") (eq (toString (dig "worker_rollout" "?" $rollOut)) "complete") }}healthy{{ else }}degraded{{ end }} | api {{ dig "api_rollout" "n/a" $rollOut }} · ui {{ dig "ui_rollout" "n/a" $rollOut }} · worker {{ dig "worker_rollout" "n/a" $rollOut }} |
| Ingress | {{ if eq (dig "status" "" $ing) "error" }}failed{{ else if ne (dig "status" "" $ing) "finished" }}not yet run{{ else if eq (len $ingOut) 0 }}no data{{ else if and (ne (toString (dig "targets_total" "0" $ingOut)) "0") (eq (toString (dig "targets_healthy" "?" $ingOut)) (toString (dig "targets_total" "!" $ingOut))) }}healthy{{ else }}degraded{{ end }} | {{ dig "targets_healthy" "n/a" $ingOut }} of {{ dig "targets_total" "n/a" $ingOut }} endpoints backed |
| Public endpoint | {{ if eq (dig "status" "" $end) "error" }}failed{{ else if ne (dig "status" "" $end) "finished" }}not yet run{{ else if eq (len $endOut) 0 }}no data{{ else if eq (toString (dig "http_status" "?" $endOut)) "200" }}healthy{{ else }}degraded{{ end }} | HTTP {{ dig "http_status" "n/a" $endOut }} in {{ dig "latency_ms" "n/a" $endOut }}ms |

{{ with dig "checked_at" "" $endOut }}Last checked <nuon-time time="{{ . }}" format="relative"></nuon-time>. {{ end }}Run the `full-health-check` runbook to refresh every row.
{{ else -}}
No health check has run yet; the `full-health-check` runbook populates this table.
{{ end }}
Provisioned cluster, VPC `{{ $vpcId }}`, DNS zones, a TLS certificate, and the runner in `{{ $accountId }}` ({{ $region }}), then built and deployed {{ $cT }} components ({{ $cR }} active) in dependency order behind a public HTTPS endpoint.


</nuon-tab>

<nuon-tab name="how it works">

<div style="padding-top:1rem;"></div>

## Three parts of a Nuon app

**A sandbox: where it runs.** One Terraform-provisioned foundation, created in each customer's account: here an EKS cluster and VPC `{{ $vpcId }}` in `{{ $accountId }}`. You pick a sandbox; you don't write one.

**At least one component: the thing you ship.** A piece of your software in a format you build: container image, Helm chart, Kubernetes manifests, Terraform module, Pulumi program. Declare what it needs, and Nuon works out build and deploy order. This install has {{ $cT }}{{ if gt $cT 0 }} ({{ $cR }} active){{ end }}.

**The runner: what does the work.** An EKS managed node group inside the customer's account performs every build, deploy, and action itself. It authenticates outbound and polls for work, so **Nuon never needs inbound access to their account**.

</nuon-tab>

<nuon-tab name="going further">

<div style="padding-top:1rem;"></div>

## Customer requests

**"Can we try the new version first?"** Yes. This install ships through the `main` [app branch](https://github.com/nuonco/kitchen-sink/blob/main/branch.toml): `nuon sync --branch main` from a clone starts a branch run that rolls the config out group by group (staging, then customers, then enterprise), with a person approving each group's plan before it deploys. A push does the same once the rules in `triggers.toml.example` are enabled.{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }} [The groups and the commands that ship to them](https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/#/customize/branches), inside the app.{{ end }}

**"Can my coding agent do this?"** Yes. `nuon agents mcp setup --platform claude-code` connects Nuon's MCP server to Claude Code (or Cursor, or Amp) through the CLI; `nuon agents context` verifies it.{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }} [Prompts to ask it about this install](https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/#/customize/agent), with the ids filled in.{{ end }}

<!-- Dashboard deep links below take the org id from the render state (nuon.org.id), so they work under whichever org this config is installed in. -->

**"Our platform team needs bigger nodes and our own domain."** [Inputs](https://github.com/nuonco/kitchen-sink/tree/main/inputs): parameters declared once with defaults, set per install, templated into infrastructure and components. This install's values are under **Current inputs**, top right.

**"Where does the database password come from?"** [Secrets](https://github.com/nuonco/kitchen-sink/blob/main/secrets.toml): declared in config, generated or supplied per install, synced into the cluster. `secrets.toml` holds names and Kubernetes sync targets, not values.

**"Something's acting weird. Can you look?"** [Actions](https://app.nuon.co/{{ .nuon.org.id }}/installs/{{ .nuon.install.id }}/actions): scripts that run on the runner, inside the customer's boundary, and stream results back here. No credentials handed out, no VPN.

**"What exactly can you touch in our account?"** An IAM role per operation with [permissions boundaries](https://github.com/nuonco/kitchen-sink/tree/main/permissions), [policies](https://github.com/nuonco/kitchen-sink/tree/main/policies) that block a deploy before it applies, and a pre-declared [break-glass role](https://github.com/nuonco/kitchen-sink/blob/main/break_glass.toml) with an audit trail.

**"Our support team needs to do that themselves."** [Runbooks](https://app.nuon.co/{{ .nuon.org.id }}/installs/{{ .nuon.install.id }}/runbooks): an operational procedure as a parameterized workflow anyone on the team can run against an install. 4 in this config: `break-glass`, `debug-bundle`, `full-health-check`, `re-apply-config`.

**"Do we have to click a button every time?"** No. Triggers run actions and runbooks on a schedule or off lifecycle events (post-provision, before and after a deploy). This install's hourly health check runs from one.

---

[`control-plane.md`](https://github.com/nuonco/kitchen-sink/blob/main/control-plane.md) in [nuonco/kitchen-sink](https://github.com/nuonco/kitchen-sink) is the template behind this page, rendered against this install's live state. Building your own starts at the [Nuon documentation](https://docs.nuon.co/get-started/introduction).

</nuon-tab>

</nuon-tabs>
