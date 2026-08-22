# Relay

{{ $accountId := dig "account_id" "000000000000" .nuon.install_stack.outputs }}
{{ $region := .nuon.cloud_account.aws.region }}
{{ $vpcId := dig "vpc_id" "vpc-000000" .nuon.install_stack.outputs }}
{{- $comps := default dict .nuon.components -}}
{{- $workflows := dict -}}{{- if .nuon.actions }}{{ $workflows = default dict .nuon.actions.workflows }}{{ end -}}
{{- $sSandbox := dig "status" "" (default dict .nuon.sandbox) -}}
{{- $sStack := dig "status" "" .nuon.install_stack -}}
{{- $sAlb := dig "status" "" (default dict (index $comps "application_load_balancer")) -}}
{{- $sandboxOk := or (eq $sSandbox "active") (eq $sSandbox "healthy") (eq $sSandbox "finished") -}}
{{- $stackOk := or (eq $sStack "active") (eq $sStack "healthy") (eq $sStack "finished") -}}
{{- $cR := 0 -}}{{- range $n, $c := $comps }}{{ if eq (dig "status" "" $c) "active" }}{{ $cR = add $cR 1 }}{{ end }}{{ end -}}
{{- $cT := len $comps -}}
{{- $allCompsOk := and (gt $cT 0) (ge $cR $cT) -}}
{{- $hc := default dict (index $workflows "cron_status") -}}
{{- $hcOut := default dict (dig "outputs" dict $hc) -}}
{{- $pr := int (dig "pods_ready" 0 $hcOut) -}}{{- $pt := int (dig "pods_total" 0 $hcOut) -}}
{{- $checkedAt := dig "checked_at" "" $hcOut -}}
{{- $healthOk := and (gt $pt 0) (ge $pr $pt) -}}
{{- $dStatus := dig "delivery_status" "" $hcOut -}}
{{- $dEvents := dig "delivery_events_24h" "" $hcOut -}}
{{- $dDelivered := dig "delivery_delivered_24h" "" $hcOut -}}
{{- $dDlq := dig "delivery_dlq_depth" "" $hcOut -}}

{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}
<div style="border:1px solid rgba(127,127,127,0.3);border-radius:12px;padding:30px 24px;margin:4px 0 6px;text-align:center;background:rgba(127,127,127,0.06);">
<div style="font-size:0.78em;font-weight:700;letter-spacing:0.09em;opacity:0.55;margin-bottom:12px;">RELAY IS DELIVERING</div>
<div style="font-size:1.75em;font-weight:800;line-height:1.2;"><a href="https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/">Open the console ↗</a></div>
<div style="font-family:monospace;font-size:0.85em;opacity:0.6;margin-top:10px;">app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}</div>
<div style="font-size:0.9em;opacity:0.75;margin-top:14px;max-width:34em;margin-left:auto;margin-right:auto;line-height:1.5;">Live deliveries, the dead-letter queue, and a guided tour of the platform are inside the console.</div>
</div>
{{ else }}
<div style="border:1px solid rgba(127,127,127,0.3);border-radius:12px;padding:26px 24px;margin:4px 0 6px;text-align:center;background:rgba(127,127,127,0.06);">
<div style="font-size:1.15em;font-weight:700;">The console's public URL appears here once the sandbox finishes provisioning.</div>
</div>
{{ end }}

Webhook delivery — ingest, Postgres queue, worker with retries and a DLQ — running in AWS account `{{ $accountId }}` ({{ $region }}), deployed by Nuon from [one config repo](https://github.com/nuonco/kitchen-sink).

<nuon-tabs>

<nuon-tab name="status">

<div style="padding-top:1rem;"></div>

Creating this install ran these steps, in order. The checkmarks are live.

<div style="display:flex;flex-direction:column;gap:10px;margin:18px 0 8px;">
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">1</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Provisioned the infrastructure in <code>{{ $accountId }}</code> ({{ $region }}) — cluster, VPC <code>{{ $vpcId }}</code>, DNS zones, and the runner.</div>
<span style="font-weight:800;flex:none;color:{{ if and $sandboxOk $stackOk }}#16a34a{{ else }}#64748b{{ end }};">{{ if and $sandboxOk $stackOk }}✓{{ else }}…{{ end }}</span>
</div>
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">2</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Built Relay's components — ingest API, delivery worker, Postgres store, echo receiver, console — and deployed them in dependency order: {{ $cR }}/{{ $cT }} active.</div>
<span style="font-weight:800;flex:none;color:{{ if $allCompsOk }}#16a34a{{ else }}#64748b{{ end }};">{{ if $allCompsOk }}✓{{ else }}…{{ end }}</span>
</div>
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">3</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Issued a TLS certificate and put the console behind a public HTTPS endpoint.{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }} That's the link at the top of this page.{{ end }}</div>
<span style="font-weight:800;flex:none;color:{{ if eq $sAlb "active" }}#16a34a{{ else }}#64748b{{ end }};">{{ if eq $sAlb "active" }}✓{{ else }}…{{ end }}</span>
</div>
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">4</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Started the hourly heartbeat inside the install: pod readiness plus the live delivery rollup{{ if gt $pt 0 }} — currently <strong>{{ $pr }}/{{ $pt }} pods ready</strong>{{ if eq $dStatus "ok" }}, <strong>{{ $dDelivered }}/{{ $dEvents }} events delivered</strong> in the last 24h, DLQ depth <strong>{{ $dDlq }}</strong>{{ end }}{{ if ne $checkedAt "" }}, last run <nuon-time time="{{ $checkedAt }}" format="relative"></nuon-time>{{ end }}{{ end }}.</div>
<span style="font-weight:800;flex:none;color:{{ if $healthOk }}#16a34a{{ else }}#64748b{{ end }};">{{ if $healthOk }}✓{{ else }}…{{ end }}</span>
</div>
</div>

Nobody logged into a server, and the same sequence repeats identically for the next customer account.

</nuon-tab>

<nuon-tab name="how it works">

<div style="padding-top:1rem;"></div>

## A shippable Nuon app is three parts

Relay uses a lot of the platform because it doubles as the demo. You don't need any of that to ship — you need three things:

**A sandbox — where it runs.** One Terraform-provisioned foundation, created fresh in each customer's account: here an EKS cluster and a dedicated VPC (`{{ $vpcId }}`) in `{{ $accountId }}`. You pick a sandbox; you don't write one.

**At least one component — the thing you ship.** A piece of your software in a format you already build: container image, Helm chart, Kubernetes manifests, Terraform module. Declare what it needs, and Nuon works out build and deploy order. This install has {{ $cT }}{{ if gt $cT 0 }} ({{ $cR }} active){{ end }}. One is a legitimate app.

**The runner — what does the work.** A small compute group inside the customer's account performs every build, deploy, and action itself. It authenticates outbound and polls for work, so **Nuon never needs inbound access to their account**. That asymmetry is the whole security story, and you get it by default.

Everything on the next tab is optional until a customer makes it necessary.

</nuon-tab>

<nuon-tab name="going further">

<div style="padding-top:1rem;"></div>

## When a customer asks for more

Reach for these when a real request makes them necessary — not before. Each is a few lines of config in the same repo.

<!-- Dashboard deep links below take the org id from the render state (nuon.org.id), so they work under whichever org this config is installed in. -->

**"Our platform team needs bigger nodes and our own domain."** [Inputs](https://github.com/nuonco/kitchen-sink/tree/main/inputs): knobs declared once with defaults, set per install, templated into infrastructure and components. This install's values are under **Current inputs**, top right.

**"Where does the database password come from?"** [Secrets](https://github.com/nuonco/kitchen-sink/blob/main/secrets.toml): declared in config, generated per install, synced into the cluster. Relay's Postgres and its clients consume the same synced Secret; nothing sensitive lives in git.

**"Something's stuck — can you look?"** [Actions](https://app.nuon.co/{{ .nuon.org.id }}/installs/{{ .nuon.install.id }}/actions): scripts that run on the runner, inside the customer's boundary, and stream results back here. The hourly `cron_status` heartbeat and the six-hourly `delivery_log_export` — the full delivery record archived to the install's private S3 bucket — run this way. No credentials handed out, no VPN, no screenshare.

**"Our support team needs to do that themselves."** [Runbooks](https://app.nuon.co/{{ .nuon.org.id }}/installs/{{ .nuon.install.id }}/runbooks): an operational procedure as a reviewable, repeatable, parameterized workflow. `full-health-check` sweeps nodes to public endpoint to delivery stats; `break-glass` force-rolls a stuck pipeline and replays the dead-letter queue under a pre-declared emergency role.

**"What exactly can you touch in our account?"** Answer with files: a scoped IAM role per operation with [permissions boundaries](https://github.com/nuonco/kitchen-sink/tree/main/permissions), [policies](https://github.com/nuonco/kitchen-sink/tree/main/policies) that block a deploy before it applies, and a pre-declared [break-glass role](https://github.com/nuonco/kitchen-sink/blob/main/break_glass.toml) with an audit trail — agreed to before the emergency.

**"Only Enterprise gets the export SKU."** Toggleable components ship per install; the console detects `audit_log_exporter` at runtime and unlocks the delivery-log export view for that install only.

**"Do we have to click a button every time?"** Triggers run actions and runbooks on a schedule or off lifecycle events — post-provision, before and after a deploy — so routine operations just happen.

**"Can we try the new version first?"** [App branches](https://github.com/nuonco/kitchen-sink) let one install track a different branch of the config repo, so a pilot customer gets the change before the fleet does.

---

This page is itself part of the config: [`control-plane.md`](https://github.com/nuonco/kitchen-sink/blob/main/control-plane.md) in [nuonco/kitchen-sink](https://github.com/nuonco/kitchen-sink), a template rendered against this install's live state. To build your own, start with the [Nuon documentation](https://docs.nuon.co/get-started/introduction).

</nuon-tab>

</nuon-tabs>
