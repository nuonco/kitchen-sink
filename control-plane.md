# Kitchen Sink

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

{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}
<div style="border:1px solid rgba(127,127,127,0.3);border-radius:12px;padding:30px 24px;margin:4px 0 6px;text-align:center;background:rgba(127,127,127,0.06);">
<div style="font-size:0.78em;font-weight:700;letter-spacing:0.09em;opacity:0.55;margin-bottom:12px;">THE APP IS RUNNING</div>
<div style="font-size:1.75em;font-weight:800;line-height:1.2;"><a href="https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/">Open the app and explore ↗</a></div>
<div style="font-family:monospace;font-size:0.85em;opacity:0.6;margin-top:10px;">app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}</div>
<div style="font-size:0.9em;opacity:0.75;margin-top:14px;max-width:34em;margin-left:auto;margin-right:auto;line-height:1.5;">A guided tour of the platform lives inside the app itself. This page just gets you there.</div>
</div>
{{ else }}
<div style="border:1px solid rgba(127,127,127,0.3);border-radius:12px;padding:26px 24px;margin:4px 0 6px;text-align:center;background:rgba(127,127,127,0.06);">
<div style="font-size:1.15em;font-weight:700;">The app's public URL appears here once the sandbox finishes provisioning.</div>
</div>
{{ end }}

Deployed into AWS account `{{ $accountId }}` ({{ $region }}) by Nuon, from [one config repo](https://github.com/nuonco/kitchen-sink).

<nuon-tabs>

<nuon-tab name="status">

<div style="padding-top:1rem;"></div>

Creating this install ran these steps, in order.

<div style="display:flex;flex-direction:column;gap:10px;margin:18px 0 8px;">
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">1</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Provisioned the infrastructure in <code>{{ $accountId }}</code> ({{ $region }}) — cluster, VPC <code>{{ $vpcId }}</code>, DNS zones, and the runner.</div>
<span style="font-weight:800;flex:none;color:{{ if and $sandboxOk $stackOk }}#16a34a{{ else }}#64748b{{ end }};">{{ if and $sandboxOk $stackOk }}✓{{ else }}…{{ end }}</span>
</div>
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">2</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Built the application's components and deployed them in dependency order — {{ $cR }}/{{ $cT }} active.</div>
<span style="font-weight:800;flex:none;color:{{ if $allCompsOk }}#16a34a{{ else }}#64748b{{ end }};">{{ if $allCompsOk }}✓{{ else }}…{{ end }}</span>
</div>
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">3</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Issued a TLS certificate and put the app behind a public HTTPS endpoint.{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }} That's the link at the top of this page.{{ end }}</div>
<span style="font-weight:800;flex:none;color:{{ if eq $sAlb "active" }}#16a34a{{ else }}#64748b{{ end }};">{{ if eq $sAlb "active" }}✓{{ else }}…{{ end }}</span>
</div>
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">4</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Started scheduled health checks that run inside the install: every pod, every hour{{ if gt $pt 0 }} — currently <strong>{{ $pr }}/{{ $pt }} ready</strong>{{ if ne $checkedAt "" }}, last run <nuon-time time="{{ $checkedAt }}" format="relative"></nuon-time>{{ end }}{{ end }}.</div>
<span style="font-weight:800;flex:none;color:{{ if $healthOk }}#16a34a{{ else }}#64748b{{ end }};">{{ if $healthOk }}✓{{ else }}…{{ end }}</span>
</div>
</div>

Nobody logged into a server, and the same sequence repeats identically for the next customer account.

</nuon-tab>

<nuon-tab name="how it works">

<div style="padding-top:1rem;"></div>

## A shippable Nuon app is three parts

Kitchen Sink uses a lot of the platform because it exists to demo it. You don't need any of that to ship — you need three things:

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

**"Where does the database password come from?"** [Secrets](https://github.com/nuonco/kitchen-sink/blob/main/secrets.toml): declared in config, generated or supplied per install, synced into the cluster. Nothing sensitive lives in git.

**"Something's acting weird — can you look?"** [Actions](https://app.nuon.co/{{ .nuon.org.id }}/installs/{{ .nuon.install.id }}/actions): scripts that run on the runner, inside the customer's boundary, and stream results back here. No credentials handed out, no VPN, no screenshare.

**"What exactly can you touch in our account?"** Answer with files: a scoped IAM role per operation with [permissions boundaries](https://github.com/nuonco/kitchen-sink/tree/main/permissions), [policies](https://github.com/nuonco/kitchen-sink/tree/main/policies) that block a deploy before it applies, and a pre-declared [break-glass role](https://github.com/nuonco/kitchen-sink/blob/main/break_glass.toml) with an audit trail — agreed to before the emergency.

**"Our support team needs to do that themselves."** [Runbooks](https://app.nuon.co/{{ .nuon.org.id }}/installs/{{ .nuon.install.id }}/runbooks): an operational procedure as a reviewable, repeatable, parameterized workflow anyone on the team can run against an install.

**"Do we have to click a button every time?"** Triggers run actions and runbooks on a schedule or off lifecycle events — post-provision, before and after a deploy — so routine operations just happen.

**"Can we try the new version first?"** [App branches](https://github.com/nuonco/kitchen-sink) let one install track a different branch of the config repo, so a pilot customer gets the change before the fleet does.

---

This page is itself part of the config: [`control-plane.md`](https://github.com/nuonco/kitchen-sink/blob/main/control-plane.md) in [nuonco/kitchen-sink](https://github.com/nuonco/kitchen-sink), a template rendered against this install's live state. To build your own, start with the [Nuon documentation](https://docs.nuon.co/get-started/introduction).

</nuon-tab>

</nuon-tabs>
