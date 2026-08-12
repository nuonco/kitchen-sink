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

## What just happened?

You (or whoever created this install) pointed Nuon at an AWS account, and Nuon did the rest: it provisioned dedicated infrastructure in that account, built every piece of the application, deployed it all in dependency order, and started watching it. The four tiles above **are** that story, live — the infrastructure, the components, the running app, and the health check keeping an eye on it. Nobody SSH'd into anything, and the whole thing repeats identically for the next account.

## What would this look like for *your* app?

Kitchen Sink is a stand-in for **your product**. If your enterprise customers want your software running inside **their** cloud account — Bring Your Own Cloud (BYOC) — these are the moments that actually make or break that model, and every one of them is something you can do from this page.

**A new enterprise customer signs.** Their security team won't approve the shared-SaaS version; the deal depends on running in their AWS account. This install *is* that motion: connect the account, create an install, and Nuon stamps out the full stack from the config repo. Customer number two is the same motion again — installs are reproduced from config, not hand-built by your best infrastructure engineer.

**Release day.** You merge v2. A `nuon apps sync` picks up the change and builds new component versions; you roll them out install by install, or across the fleet, with every deploy versioned and logged. *Try it: open the **Components** tab and click `kitchen_sink` — this install has already taken multiple chart deploys today, and you can read each one's history.*

**A support ticket lands: "it's acting weird."** Normally this means a week of screenshare archaeology, because you have no access to the customer's environment. Here, you open **Actions** and run `debug` — it executes *inside the customer's boundary* and streams pod status, recent events, and application logs back to this dashboard. No credentials handed out, no VPN. The **Health pulse** tile above is the same idea on a schedule: `cron_status` checks every pod, every hour.

**The customer's platform team wants changes.** Bigger nodes, their own domain. That's what **inputs** are for: `instance_type` and `domain` are declared once in the config with sane defaults, surfaced per install, and flow into infrastructure and components as template variables. Some inputs are for your eyes only (`debug_mode` is internal), and some are secret by design (`api_token` is marked sensitive). *Try it: **Current inputs**, top right of this page.*

**Something changed under you.** Someone in the customer's account hand-edited the infrastructure. The **Drift detection** indicator in this page's header catches the divergence, and a reprovision re-applies the desired state — the config repo, not the cloud account, stays the source of truth.

**The security review asks: "what exactly can you touch?"** You answer with files instead of promises: every operation runs under its own scoped Identity and Access Management (IAM) role with a permissions boundary, Open Policy Agent policies gate what's allowed to deploy, and emergency access is a pre-declared, fully recorded break-glass role. All of it is in the **guardrails** tab below.

## Under the hood

Everything above, in as much detail as you want. Each tab mixes live state from this install with the config that produced it.

<nuon-tabs>

<nuon-tab name="architecture">

<div style="padding-top:1rem;"></div>

This is the real dependency graph of this install — components deploy in this order, and a change to one triggers only what depends on it:

<nuon-config-graph></nuon-config-graph>

### How a request reaches the app

1. A browser hits {{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}<code>https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}</code>{{ else }}<code>https://app.&lt;install domain&gt;</code>{{ end }} — a record in this install's public Route53 zone, managed by external-dns.
2. It lands on an **internet-facing Application Load Balancer** (the `application_load_balancer` component), which terminates TLS using a wildcard certificate from AWS Certificate Manager (the `certificate` component) and health-checks the app on `/livez`.
3. The load balancer forwards to the `kitchen-sink-ui` service on port 3000; the UI calls the API over the in-cluster service (`http://kitchen-sink-api:8080`), and the worker runs alongside. None of the API or worker traffic ever leaves the cluster.

### What the sandbox provides

The **sandbox** is the platform layer every component lands on, defined in [`sandbox.toml`](https://github.com/nuonco/kitchen-sink/blob/main/sandbox.toml) and sourced from [`nuonco/aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox): an EKS 1.34 cluster (`n-{{ .nuon.install.id }}`), a dedicated VPC (`{{ $vpcId }}`), public and internal Route53 zones, plus in-cluster essentials — cert-manager, external-dns, ingress-nginx, and the AWS Load Balancer Controller.

### Who does the work: the runner

Every build, deploy, and action for this install executes on the **runner** — an EC2 Auto Scaling group *inside* account `{{ $accountId }}`, stood up by the CloudFormation stack `nuon-kitchen-sink-{{ .nuon.install.id }}` ([`stack.toml`](https://github.com/nuonco/kitchen-sink/blob/main/stack.toml), [`runner.toml`](https://github.com/nuonco/kitchen-sink/blob/main/runner.toml)). It authenticates outbound using its instance identity and polls for work — **Nuon never needs inbound access to the customer's account**. That asymmetry is the heart of the security story.

</nuon-tab>

<nuon-tab name="components">

<div style="padding-top:1rem;"></div>

Live status, straight from this install:

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

### What each one is — and why it's here

Kitchen Sink deliberately uses **every component type Nuon supports**, so you can see how your own stack maps onto it. Each row is one TOML file in [`components/`](https://github.com/nuonco/kitchen-sink/tree/main/components).

<table>
  <thead>
    <tr><th>Component</th><th>Type</th><th>Source</th><th>What it demonstrates</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>img_api</code>, <code>img_api_two</code>, <code>img_ui</code></td>
      <td>container_image</td>
      <td>Private Amazon ECR registry (cross-account IAM role)</td>
      <td>Delivering pre-built images from <em>your</em> registry into the customer's account — no public images required.</td>
    </tr>
    <tr>
      <td><code>kitchen_sink</code></td>
      <td>helm_chart</td>
      <td>This repo, <code>components/chart</code></td>
      <td>The application itself: UI, API, and worker deployments with services, autoscalers, and role-based access control, templated with the image components' outputs.</td>
    </tr>
    <tr>
      <td><code>kustomize_namespace</code>, <code>kustomizeapp</code></td>
      <td>kubernetes_manifest</td>
      <td>Inline manifest + public <code>argoproj/argocd-example-apps</code> (kustomize)</td>
      <td>Raw Kubernetes manifests and third-party kustomize bases — for the parts of your stack that aren't Helm.</td>
    </tr>
    <tr>
      <td><code>pulumi_infra</code></td>
      <td>pulumi (Go)</td>
      <td>This repo, <code>components/pulumi</code></td>
      <td>Application-owned cloud infrastructure beyond the cluster: an encrypted, versioned S3 bucket, created per install.</td>
    </tr>
    <tr>
      <td><code>certificate</code></td>
      <td>terraform_module</td>
      <td><code>nuonco/example-app-configs</code></td>
      <td>A wildcard AWS Certificate Manager certificate, DNS-validated against the install's public zone.</td>
    </tr>
    <tr>
      <td><code>application_load_balancer</code></td>
      <td>helm_chart</td>
      <td><code>nuonco/example-app-configs</code></td>
      <td>The public HTTPS front door: an internet-facing Application Load Balancer terminating TLS in front of the UI.</td>
    </tr>
  </tbody>
</table>

Dependencies drive everything: the chart declares it needs the images, the load balancer declares it needs the chart and the certificate, and Nuon derives the build and deploy order from that graph — the same one drawn in the **architecture** tab.

</nuon-tab>

<nuon-tab name="actions">

<div style="padding-top:1rem;"></div>

Actions are scripts that run **on the runner, inside the install's boundary**, with scoped credentials and kubectl access to the cluster. Kitchen Sink ships three, each showing a different trigger style:

<table>
  <thead>
    <tr><th>Action</th><th>Triggers</th><th>What it does</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>cron_status</code></td>
      <td>Hourly cron + manual</td>
      <td>Collects node, pod, service, and ingress state; emits <code>pods_ready</code>/<code>pods_total</code>/<code>checked_at</code> as structured outputs — which is exactly what feeds the <strong>Health pulse</strong> tile at the top of this page.</td>
    </tr>
    <tr>
      <td><code>debug</code></td>
      <td>Manual</td>
      <td>Read-only diagnostic bundle: pod status, the last 50 events, Helm releases, and the last 100 log lines from the API and UI.</td>
    </tr>
    <tr>
      <td><code>lifecycle_hooks</code></td>
      <td>Post-provision, pre/post-deploy of <code>kitchen_sink</code>, manual</td>
      <td>Fires around lifecycle events — the hook point for anything your product needs to do before or after a deploy (migrations, cache warms, notifications).</td>
    </tr>
  </tbody>
</table>

Two output channels matter: everything an action prints goes to its run **Logs** in this dashboard, while anything written as key=value pairs to the outputs file becomes **structured outputs** — queryable by this page's template, by other tooling, or by you.

Recent runs on this install:

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

<nuon-tab name="inputs & secrets">

<div style="padding-top:1rem;"></div>

**Inputs** are the knobs a vendor exposes per install. Each is declared in [`inputs/`](https://github.com/nuonco/kitchen-sink/tree/main/inputs), grouped for the UI, and referenced anywhere in the config as a template variable — the sandbox, for example, builds this install's DNS zone from the `domain` input.

<table>
  <thead>
    <tr><th>Input</th><th>Group</th><th>Type</th><th>Default</th><th>Behavior</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>domain</code></td>
      <td>dns</td>
      <td>string</td>
      <td><code>nuon.run</code></td>
      <td>Required. Becomes the root of the install's public and internal DNS zones.</td>
    </tr>
    <tr>
      <td><code>instance_type</code></td>
      <td>compute</td>
      <td>string</td>
      <td><code>t3a.medium</code></td>
      <td>User-configurable — the knob you'd hand the customer's platform team for node sizing.</td>
    </tr>
    <tr>
      <td><code>debug_mode</code></td>
      <td>compute</td>
      <td>bool</td>
      <td><code>false</code></td>
      <td><strong>Internal</strong> — visible to you as the vendor, hidden from the customer.</td>
    </tr>
    <tr>
      <td><code>api_token</code></td>
      <td>compute</td>
      <td>string</td>
      <td>—</td>
      <td><strong>Sensitive</strong> — masked in the UI and handled as a secret value.</td>
    </tr>
  </tbody>
</table>

**Secrets** ([`secrets.toml`](https://github.com/nuonco/kitchen-sink/blob/main/secrets.toml)) are first-class: declared in config, materialized per install, and synced into the cluster as Kubernetes Secrets — never committed anywhere.

<table>
  <thead>
    <tr><th>Secret</th><th>Origin</th><th>Where it lands</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>db_password</code></td>
      <td>Auto-generated per install</td>
      <td>Kubernetes Secret <code>kitchen-sink/db-password</code></td>
    </tr>
    <tr>
      <td><code>api_key</code></td>
      <td>Supplied by the vendor</td>
      <td>Kubernetes Secret <code>kitchen-sink/api-key</code></td>
    </tr>
  </tbody>
</table>

</nuon-tab>

<nuon-tab name="guardrails">

<div style="padding-top:1rem;"></div>

The answer to "what exactly can Nuon touch in our account?" — as config files, all reviewable in the repo.

### One IAM role per operation

Every operation type gets its **own IAM role**, declared in [`permissions/`](https://github.com/nuonco/kitchen-sink/tree/main/permissions). The pattern: a broad managed policy for capability, constrained by an explicit **permissions boundary** document that caps what the role can ever do — and the customer can read every boundary before installing.

<table>
  <thead>
    <tr><th>Role</th><th>Used for</th><th>Boundary</th></tr>
  </thead>
  <tbody>
    <tr><td><code>{{ .nuon.install.id }}-provision</code></td><td>Provisioning the sandbox and components</td><td><code>provision_boundary.json</code></td></tr>
    <tr><td><code>{{ .nuon.install.id }}-setup</code></td><td>Initial component deployment</td><td><code>provision_boundary.json</code></td></tr>
    <tr><td><code>{{ .nuon.install.id }}-maintenance</code></td><td>Operating and remediating components</td><td><code>maintenance_boundary.json</code></td></tr>
    <tr><td><code>{{ .nuon.install.id }}-sandbox-updates</code></td><td>Updating sandbox infrastructure</td><td><code>provision_boundary.json</code></td></tr>
    <tr><td><code>{{ .nuon.install.id }}-actions</code></td><td>Running actions (health checks, debug, cron)</td><td>Scoped EKS-access policy</td></tr>
    <tr><td><code>{{ .nuon.install.id }}-deprovision</code></td><td>Tearing the install down</td><td><code>deprovision_boundary.json</code></td></tr>
  </tbody>
</table>

### Policy gates on every deploy

[`policies/`](https://github.com/nuonco/kitchen-sink/tree/main/policies) holds Open Policy Agent (OPA) rules evaluated **before** changes apply — failing policy blocks the operation:

<table>
  <thead>
    <tr><th>Policy</th><th>Applies to</th><th>Enforces</th></tr>
  </thead>
  <tbody>
    <tr><td><code>cluster-requirements</code></td><td>Sandbox</td><td>Baseline requirements for the cluster configuration</td></tr>
    <tr><td><code>sandbox-limits</code></td><td>Sandbox</td><td>Limits on what sandbox changes may do</td></tr>
    <tr><td><code>deny-public-api-ingress</code></td><td><code>kitchen_sink</code> Helm chart</td><td>The API must never be exposed on a public ingress</td></tr>
    <tr><td><code>deny-public-s3-bucket</code></td><td>All Terraform modules</td><td>No component may create a public S3 bucket</td></tr>
  </tbody>
</table>

### Break glass, on the record

[`break_glass.toml`](https://github.com/nuonco/kitchen-sink/blob/main/break_glass.toml) pre-declares an emergency-admin role (`{{ .nuon.install.id }}-app-break-glass`) for the incidents that scoped roles can't cover. It's administrator access **minus an explicit deny on all of Secrets Manager**, and every use of it is a recorded event — emergency access with an audit trail, agreed to *before* the emergency.

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
    <tr><td>Cluster</td><td><code>n-{{ .nuon.install.id }}</code></td></tr>
    <tr><td>CloudFormation stack</td><td><code>nuon-kitchen-sink-{{ .nuon.install.id }}</code></td></tr>
  </tbody>
</table>

  </div>
</div>

</nuon-tab>

</nuon-tabs>

---

Every tile, table, and behavior on this page came from [nuonco/kitchen-sink](https://github.com/nuonco/kitchen-sink) — including this page itself ([`control-plane.md`](https://github.com/nuonco/kitchen-sink/blob/main/control-plane.md) is a template rendered against the install's live state). To go deeper, start with the [Nuon documentation](https://docs.nuon.co/get-started/introduction).
