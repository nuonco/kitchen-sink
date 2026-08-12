# Kitchen Sink

{{ $accountId := dig "account_id" "000000000000" .nuon.install_stack.outputs }}
{{ $region := .nuon.cloud_account.aws.region }}
{{ $vpcId := dig "vpc_id" "vpc-000000" .nuon.install_stack.outputs }}
{{- $comps := default dict .nuon.components -}}
{{- $workflows := dict -}}{{- if .nuon.actions }}{{ $workflows = default dict .nuon.actions.workflows }}{{ end -}}

**This install is a working tour of Nuon.** A real web application (UI + API + worker), the AWS infrastructure it runs on, and the automation around it — all deployed from [one config repo](https://github.com/nuonco/kitchen-sink) into account `{{ $accountId }}`. The tiles below are live: they re-render from this install's actual state every time you open this page.

<div style="display:flex;flex-wrap:wrap;gap:14px;margin:22px 0 30px;">
{{- $col := "#64748b" -}}{{- $glow := "rgba(100,116,139,0.18)" -}}{{- $tint := "rgba(100,116,139,0.05)" -}}{{- $gly := "–" -}}{{- $lab := "" -}}
{{- /* tile 1: the application */ -}}
{{- $ks := default dict (index $comps "kitchen_sink") -}}
{{- $ksS := dig "status" "" $ks -}}
{{- if eq $ksS "active" }}{{ $col = "#16a34a" }}{{ $glow = "rgba(22,163,74,0.22)" }}{{ $tint = "rgba(22,163,74,0.07)" }}{{ $gly = "✓" }}{{ $lab = "RUNNING" }}{{ else if eq $ksS "error" }}{{ $col = "#dc2626" }}{{ $glow = "rgba(220,38,38,0.22)" }}{{ $tint = "rgba(220,38,38,0.07)" }}{{ $gly = "✗" }}{{ $lab = "ERROR" }}{{ else }}{{ $col = "#64748b" }}{{ $glow = "rgba(100,116,139,0.18)" }}{{ $tint = "rgba(100,116,139,0.05)" }}{{ $gly = "–" }}{{ $lab = "PENDING" }}{{ end -}}
<div style="flex:1 1 240px;min-width:240px;border:1px solid rgba(127,127,127,0.18);border-left:6px solid {{ $col }};border-radius:12px;padding:18px 20px;background:{{ $tint }};">
<div style="font-size:1.2em;font-weight:800;line-height:1.2;margin-bottom:12px;">Your application</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:{{ $col }};color:#fff;font-size:14px;font-weight:900;line-height:1;box-shadow:0 0 0 5px {{ $glow }};flex:none;">{{ $gly }}</span>
<span style="font-size:1.18em;font-weight:800;letter-spacing:0.03em;color:{{ $col }};">{{ $lab }}</span>
</div>
<div style="font-size:0.86em;opacity:0.72;line-height:1.35;margin-bottom:8px;">UI + API + worker on EKS, deployed by the <code>kitchen_sink</code> Helm chart</div>
{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}<div style="font-size:0.82em;line-height:1.35;"><a href="https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/">app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }} ↗</a></div>{{ else }}<div style="font-size:0.82em;opacity:0.6;line-height:1.35;">URL appears once the sandbox is provisioned</div>{{ end }}
</div>
{{- /* tile 2: components */ -}}
{{- $cR := 0 -}}{{- $cE := 0 -}}{{- range $n, $c := $comps }}{{ if eq (dig "status" "" $c) "active" }}{{ $cR = add $cR 1 }}{{ else if eq (dig "status" "" $c) "error" }}{{ $cE = add $cE 1 }}{{ end }}{{ end -}}
{{- $cT := len $comps -}}
{{- if gt $cE 0 }}{{ $col = "#dc2626" }}{{ $glow = "rgba(220,38,38,0.22)" }}{{ $tint = "rgba(220,38,38,0.07)" }}{{ $gly = "✗" }}{{ $lab = "ISSUES" }}{{ else if and (gt $cT 0) (ge $cR $cT) }}{{ $col = "#16a34a" }}{{ $glow = "rgba(22,163,74,0.22)" }}{{ $tint = "rgba(22,163,74,0.07)" }}{{ $gly = "✓" }}{{ $lab = "ALL ACTIVE" }}{{ else }}{{ $col = "#64748b" }}{{ $glow = "rgba(100,116,139,0.18)" }}{{ $tint = "rgba(100,116,139,0.05)" }}{{ $gly = "–" }}{{ $lab = "WORKING" }}{{ end -}}
<div style="flex:1 1 240px;min-width:240px;border:1px solid rgba(127,127,127,0.18);border-left:6px solid {{ $col }};border-radius:12px;padding:18px 20px;background:{{ $tint }};">
<div style="font-size:1.2em;font-weight:800;line-height:1.2;margin-bottom:12px;">Components</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:{{ $col }};color:#fff;font-size:14px;font-weight:900;line-height:1;box-shadow:0 0 0 5px {{ $glow }};flex:none;">{{ $gly }}</span>
<span style="font-size:1.18em;font-weight:800;letter-spacing:0.03em;color:{{ $col }};">{{ $lab }}</span>
</div>
{{ if gt $cT 0 }}<div style="display:flex;flex-wrap:wrap;gap:6px;">{{ range $n, $c := $comps }}{{ $ok := eq (dig "status" "" $c) "active" }}<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8em;font-weight:600;padding:3px 9px;border-radius:999px;border:1px solid {{ if $ok }}rgba(22,163,74,0.30){{ else }}rgba(220,38,38,0.30){{ end }};background:{{ if $ok }}rgba(22,163,74,0.10){{ else }}rgba(220,38,38,0.10){{ end }};color:{{ if $ok }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:7px;height:7px;border-radius:50%;flex:none;background:{{ if $ok }}#16a34a{{ else }}#dc2626{{ end }};"></span>{{ $n }}</span>{{ end }}</div>{{ else }}<div style="font-size:0.86em;opacity:0.72;line-height:1.35;">Components appear after the first sync</div>{{ end }}
</div>
{{- /* tile 3: infrastructure */ -}}
{{- $sb := default dict .nuon.sandbox -}}{{- $ss := dig "status" "" $sb -}}
{{- if or (eq $ss "active") (eq $ss "healthy") (eq $ss "finished") }}{{ $col = "#16a34a" }}{{ $glow = "rgba(22,163,74,0.22)" }}{{ $tint = "rgba(22,163,74,0.07)" }}{{ $gly = "✓" }}{{ $lab = "IN SYNC" }}{{ else if ne $ss "" }}{{ $col = "#dc2626" }}{{ $glow = "rgba(220,38,38,0.22)" }}{{ $tint = "rgba(220,38,38,0.07)" }}{{ $gly = "✗" }}{{ $lab = "ATTENTION" }}{{ else }}{{ $col = "#64748b" }}{{ $glow = "rgba(100,116,139,0.18)" }}{{ $tint = "rgba(100,116,139,0.05)" }}{{ $gly = "–" }}{{ $lab = "UNKNOWN" }}{{ end -}}
<div style="flex:1 1 240px;min-width:240px;border:1px solid rgba(127,127,127,0.18);border-left:6px solid {{ $col }};border-radius:12px;padding:18px 20px;background:{{ $tint }};">
<div style="font-size:1.2em;font-weight:800;line-height:1.2;margin-bottom:12px;">Infrastructure</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:{{ $col }};color:#fff;font-size:14px;font-weight:900;line-height:1;box-shadow:0 0 0 5px {{ $glow }};flex:none;">{{ $gly }}</span>
<span style="font-size:1.18em;font-weight:800;letter-spacing:0.03em;color:{{ $col }};">{{ $lab }}</span>
</div>
<div style="font-size:0.86em;opacity:0.72;line-height:1.35;">EKS + VPC + DNS + TLS, Terraform-provisioned in <code>{{ $accountId }}</code> ({{ $region }})</div>
</div>
{{- /* tile 4: health pulse (hourly cron_status action) */ -}}
{{- $hc := default dict (index $workflows "cron_status") -}}
{{- $hcOut := default dict (dig "outputs" dict $hc) -}}
{{- $pr := int (dig "pods_ready" 0 $hcOut) -}}{{- $pt := int (dig "pods_total" 0 $hcOut) -}}
{{- $checkedAt := dig "checked_at" "" $hcOut -}}
{{- if and (gt $pt 0) (ge $pr $pt) }}{{ $col = "#16a34a" }}{{ $glow = "rgba(22,163,74,0.22)" }}{{ $tint = "rgba(22,163,74,0.07)" }}{{ $gly = "✓" }}{{ $lab = "PASSING" }}{{ else if gt $pt 0 }}{{ $col = "#dc2626" }}{{ $glow = "rgba(220,38,38,0.22)" }}{{ $tint = "rgba(220,38,38,0.07)" }}{{ $gly = "✗" }}{{ $lab = "DEGRADED" }}{{ else }}{{ $col = "#64748b" }}{{ $glow = "rgba(100,116,139,0.18)" }}{{ $tint = "rgba(100,116,139,0.05)" }}{{ $gly = "–" }}{{ $lab = "NOT RUN" }}{{ end -}}
<div style="flex:1 1 240px;min-width:240px;border:1px solid rgba(127,127,127,0.18);border-left:6px solid {{ $col }};border-radius:12px;padding:18px 20px;background:{{ $tint }};">
<div style="font-size:1.2em;font-weight:800;line-height:1.2;margin-bottom:12px;">Health pulse</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:{{ $col }};color:#fff;font-size:14px;font-weight:900;line-height:1;box-shadow:0 0 0 5px {{ $glow }};flex:none;">{{ $gly }}</span>
<span style="font-size:1.18em;font-weight:800;letter-spacing:0.03em;color:{{ $col }};">{{ $lab }}</span>
</div>
{{ if gt $pt 0 }}<div style="font-size:0.86em;opacity:0.72;line-height:1.35;margin-bottom:8px;">{{ $pr }}/{{ $pt }} pods ready in <code>kitchen-sink</code></div>{{ else }}<div style="font-size:0.86em;opacity:0.72;line-height:1.35;margin-bottom:8px;">Checks every pod in the app namespace</div>{{ end }}
<div style="font-size:0.8em;opacity:0.6;">{{ if ne $checkedAt "" }}Last run <nuon-time time="{{ $checkedAt }}" format="relative"></nuon-time>{{ else }}Runs hourly — or run <code>cron_status</code> from the Actions tab{{ end }}</div>
</div>
</div>

## What just happened

When this install was created, Nuon ran three phases — every one driven by a file you can read in the config repo:

1. **It provisioned the sandbox** — an EKS cluster (`n-{{ .nuon.install.id }}`), a VPC (`{{ $vpcId }}`), a DNS zone, and TLS certificates, all Terraform in **your** AWS account. Defined in [`sandbox.toml`](https://github.com/nuonco/kitchen-sink/blob/main/sandbox.toml), sourced from [`aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox).
2. **It built {{ $cT }} components** — two container images built from source, one pulled from a registry, a Helm chart, two Kubernetes manifests, and a Pulumi program that creates an encrypted S3 bucket. Each is one TOML file in [`components/`](https://github.com/nuonco/kitchen-sink/tree/main/components).
3. **It deployed everything in dependency order** — images first, then the charts and manifests that reference them. The graph below is the real dependency graph of this install:

<nuon-config-graph></nuon-config-graph>

## Five things to try

1. **Open the app** — use the link in the "Your application" tile. The UI you see is served from your cluster and talks to the API in-cluster.
2. **Trace a component** — open the **Components** tab and click <code>kitchen_sink</code>. Every build and deploy is versioned, logged, and repeatable; this is what "day-2 operations" looks like for every install of your product.
3. **Run an action** — open the **Actions** tab and run <code>debug</code>. It's a read-only diagnostic (pods, events, recent logs) that lands its output right in the dashboard — no kubectl, no cloud credentials handed out.
4. **Change an input** — installs are parameterized by [`inputs/`](https://github.com/nuonco/kitchen-sink/tree/main/inputs): try <code>debug_mode</code> or <code>instance_type</code> under the install's inputs. Inputs flow into components and infrastructure as template variables.
5. **Inspect the guardrails** — [`policies/`](https://github.com/nuonco/kitchen-sink/tree/main/policies) holds Open Policy Agent checks that gate operations, [`permissions/`](https://github.com/nuonco/kitchen-sink/tree/main/permissions) scopes an IAM role per operation, and [`break_glass.toml`](https://github.com/nuonco/kitchen-sink/blob/main/break_glass.toml) defines a recorded emergency-admin role (which explicitly denies Secrets Manager).

## Under the hood

<nuon-tabs>

<nuon-tab name="components">

<div style="padding-top:1rem;"></div>

Everything Nuon manages for this install, straight from live state:

<table>
  <thead>
    <tr><th>Component</th><th>Status</th></tr>
  </thead>
  <tbody>
  {{ range $n, $c := $comps }}
    <tr>
      <td><code>{{ $n }}</code></td>
      <td><nuon-status status="{{ dig "status" "unknown" $c }}" variant="badge"></nuon-status></td>
    </tr>
  {{ end }}
  </tbody>
</table>

</nuon-tab>

<nuon-tab name="actions">

<div style="padding-top:1rem;"></div>

Actions are scripts that run **inside the install's boundary** with scoped credentials — on a schedule (<code>cron_status</code>, hourly), on lifecycle events (<code>lifecycle_hooks</code>, around provisions and deploys), or on demand (<code>debug</code>).

{{ if $workflows }}

<table>
  <thead>
    <tr>
      <th>Action</th>
      <th>Status</th>
      <th>Details</th>
    </tr>
  </thead>
  <tbody>
  {{ range $name, $workflow := $workflows }}
    {{ $status := dig "status" "unknown" $workflow }}
    <tr>
      <td><code>{{ $name }}</code></td>
      <td><nuon-status status="{{ $status }}" variant="badge"></nuon-status></td>
      <td>
        <nuon-panel heading="Action: {{ $name }}" trigger="View" size="3/4">
          <table>
            <thead><tr><th>Field</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Name</td><td><code>{{ $name }}</code></td></tr>
              <tr><td>Status</td><td><nuon-status status="{{ $status }}" variant="badge"></nuon-status></td></tr>
              <tr><td>ID</td><td><code>{{ dig "id" "—" $workflow }}</code></td></tr>
            </tbody>
          </table>
        </nuon-panel>
      </td>
    </tr>
  {{ end }}
  </tbody>
</table>

{{ else }}

<nuon-banner theme="info">No actions have run yet.</nuon-banner>

{{ end }}

</nuon-tab>

<nuon-tab name="infrastructure">

<div style="padding-top:1rem;"></div>

<div style="display:flex;gap:1.5rem;align-items:flex-start;">
  <div style="flex:1;min-width:0;">

<div style="display:flex;align-items:baseline;gap:0.75rem;"><h3 style="margin:0;">AWS Sandbox</h3></div>

{{ $sandboxStatus := dig "status" "" .nuon.install_stack }}

<table>
  <thead>
    <tr><th>Field</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Status</td><td>{{ if $sandboxStatus }}<nuon-status status="{{ $sandboxStatus }}" variant="badge"></nuon-status>{{ else }}—{{ end }}</td></tr>
    <tr><td>Account</td><td><code>{{ $accountId }}</code></td></tr>
    <tr><td>Region</td><td><code>{{ $region }}</code></td></tr>
    <tr><td>VPC</td><td><code>{{ $vpcId }}</code></td></tr>
  </tbody>
</table>

  </div>
  <div style="flex:1;min-width:0;">

<div style="display:flex;align-items:baseline;gap:0.75rem;"><h3 style="margin:0;">Install</h3></div>

<table>
  <thead>
    <tr><th>Field</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Install ID</td><td><code>{{ .nuon.install.id }}</code></td></tr>
    <tr><td>Install Name</td><td>{{ dig "name" "—" .nuon.install }}</td></tr>
  </tbody>
</table>

  </div>
</div>

</nuon-tab>

</nuon-tabs>

---

The full source for this app config lives at [nuonco/kitchen-sink](https://github.com/nuonco/kitchen-sink) — every tile, table, and behavior on this page came from that repo. To learn how each piece works, start with the [Nuon documentation](https://docs.nuon.co/get-started/introduction).
