# Kitchen Sink

{{ $accountId := dig "account_id" "000000000000" .nuon.install_stack.outputs }}
{{ $region := .nuon.cloud_account.aws.region }}
{{ $vpcId := dig "vpc_id" "vpc-000000" .nuon.install_stack.outputs }}
{{- $comps := default dict .nuon.components -}}
{{- $workflows := dict -}}{{- if .nuon.actions }}{{ $workflows = default dict .nuon.actions.workflows }}{{ end -}}
{{- /* per-part live statuses */ -}}
{{- $sImgApi := dig "status" "" (default dict (index $comps "img_api")) -}}
{{- $sImgApi2 := dig "status" "" (default dict (index $comps "img_api_two")) -}}
{{- $sImgUi := dig "status" "" (default dict (index $comps "img_ui")) -}}
{{- $sChart := dig "status" "" (default dict (index $comps "kitchen_sink")) -}}
{{- $sKustNs := dig "status" "" (default dict (index $comps "kustomize_namespace")) -}}
{{- $sKustApp := dig "status" "" (default dict (index $comps "kustomizeapp")) -}}
{{- $sPulumi := dig "status" "" (default dict (index $comps "pulumi_infra")) -}}
{{- $sCert := dig "status" "" (default dict (index $comps "certificate")) -}}
{{- $sAlb := dig "status" "" (default dict (index $comps "application_load_balancer")) -}}
{{- $sSandbox := dig "status" "" (default dict .nuon.sandbox) -}}
{{- $sStack := dig "status" "" .nuon.install_stack -}}
{{- $imgsOk := and (eq $sImgApi "active") (eq $sImgApi2 "active") (eq $sImgUi "active") -}}
{{- $kustOk := and (eq $sKustNs "active") (eq $sKustApp "active") -}}
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

**This install is a working tour of Nuon.** A real application, deployed from [one config repo](https://github.com/nuonco/kitchen-sink) into AWS account `{{ $accountId }}`. Kitchen Sink deliberately uses every primitive on Nuon's platform, so a DevOps engineer can map each one onto what *their* product needs to ship Bring Your Own Cloud (BYOC).

## Parts

Everything this install is made of. The status on each part is read live from the install — a complete inventory, checked for you.

<div style="font-size:0.78em;font-weight:700;letter-spacing:0.09em;opacity:0.55;margin:26px 0 10px;">A &nbsp;·&nbsp; YOUR PRODUCT — your application, in the formats you already ship</div>
<div style="display:flex;flex-wrap:wrap;gap:12px;">
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">A1</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78em;font-weight:600;color:{{ if $imgsOk }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:8px;height:8px;border-radius:50%;background:{{ if $imgsOk }}#16a34a{{ else }}#dc2626{{ end }};display:inline-block;"></span>{{ if $imgsOk }}active{{ else }}check{{ end }}</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">container_image</span><span style="font-weight:800;opacity:0.7;">×3</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">img_api · img_api_two · img_ui</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">Pre-built pieces of your software, delivered from your private registry into the customer's account. No public images required.</div>
</div>
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">A2</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78em;font-weight:600;color:{{ if eq $sChart "active" }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:8px;height:8px;border-radius:50%;background:{{ if eq $sChart "active" }}#16a34a{{ else }}#dc2626{{ end }};display:inline-block;"></span>{{ if eq $sChart "active" }}active{{ else }}check{{ end }}</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">helm_chart</span><span style="font-weight:800;opacity:0.7;">×1</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">kitchen_sink</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">How the app deploys to the cluster: UI, API, and worker, with services, autoscaling, and role-based access control.</div>
</div>
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">A3</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78em;font-weight:600;color:{{ if $kustOk }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:8px;height:8px;border-radius:50%;background:{{ if $kustOk }}#16a34a{{ else }}#dc2626{{ end }};display:inline-block;"></span>{{ if $kustOk }}active{{ else }}check{{ end }}</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">kubernetes_manifest</span><span style="font-weight:800;opacity:0.7;">×2</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">kustomize_namespace · kustomizeapp</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">Raw Kubernetes objects and third-party kustomize bases — for the parts of a stack that aren't Helm.</div>
</div>
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">A4</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78em;font-weight:600;color:{{ if eq $sPulumi "active" }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:8px;height:8px;border-radius:50%;background:{{ if eq $sPulumi "active" }}#16a34a{{ else }}#dc2626{{ end }};display:inline-block;"></span>{{ if eq $sPulumi "active" }}active{{ else }}check{{ end }}</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">pulumi</span><span style="font-weight:800;opacity:0.7;">×1</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">pulumi_infra</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">Cloud infrastructure your app owns, created per install — here, an encrypted and versioned S3 bucket. Terraform modules work the same way.</div>
</div>
</div>

<div style="font-size:0.78em;font-weight:700;letter-spacing:0.09em;opacity:0.55;margin:26px 0 10px;">B &nbsp;·&nbsp; INFRASTRUCTURE — everything between an empty customer account and your running app</div>
<div style="display:flex;flex-wrap:wrap;gap:12px;">
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">B1</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78em;font-weight:600;color:{{ if $sandboxOk }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:8px;height:8px;border-radius:50%;background:{{ if $sandboxOk }}#16a34a{{ else }}#dc2626{{ end }};display:inline-block;"></span>{{ if $sandboxOk }}active{{ else }}check{{ end }}</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">sandbox</span><span style="font-weight:800;opacity:0.7;">×1</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">aws-eks-sandbox</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">The foundation layer every component lands on: an EKS cluster, dedicated VPC, DNS zones, and cluster essentials, Terraform-provisioned per install.</div>
</div>
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">B2</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78em;font-weight:600;color:{{ if $stackOk }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:8px;height:8px;border-radius:50%;background:{{ if $stackOk }}#16a34a{{ else }}#dc2626{{ end }};display:inline-block;"></span>{{ if $stackOk }}active{{ else }}check{{ end }}</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">stack</span><span style="font-weight:800;opacity:0.7;">×1</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">aws-cloudformation</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">One CloudFormation stack the customer runs to bootstrap the VPC and runner — the only setup step on their side.</div>
</div>
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">B3</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78em;font-weight:600;color:{{ if eq $sCert "active" }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:8px;height:8px;border-radius:50%;background:{{ if eq $sCert "active" }}#16a34a{{ else }}#dc2626{{ end }};display:inline-block;"></span>{{ if eq $sCert "active" }}active{{ else }}check{{ end }}</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">terraform_module</span><span style="font-weight:800;opacity:0.7;">×1</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">certificate</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">A wildcard TLS certificate from AWS Certificate Manager, DNS-validated against the install's own zone.</div>
</div>
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">B4</span><span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78em;font-weight:600;color:{{ if eq $sAlb "active" }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:8px;height:8px;border-radius:50%;background:{{ if eq $sAlb "active" }}#16a34a{{ else }}#dc2626{{ end }};display:inline-block;"></span>{{ if eq $sAlb "active" }}active{{ else }}check{{ end }}</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">helm_chart</span><span style="font-weight:800;opacity:0.7;">×1</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">application_load_balancer</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">The public entry point: an internet-facing load balancer terminating HTTPS in front of the UI, health-checked on <code>/livez</code>.</div>
</div>
</div>

<div style="font-size:0.78em;font-weight:700;letter-spacing:0.09em;opacity:0.55;margin:26px 0 10px;">C &nbsp;·&nbsp; EXECUTION — the compute that does the work, inside the customer's account</div>
<div style="display:flex;flex-wrap:wrap;gap:12px;">
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">C1</span><span style="font-size:0.78em;font-weight:600;opacity:0.5;">declared in config</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">runner</span><span style="font-weight:800;opacity:0.7;">×1</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">EC2 Auto Scaling group</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">A small compute group <em>inside the customer's account</em> performs every build, deploy, and action itself. It only ever calls out — <strong>Nuon never needs inbound access to the account</strong>. This is the heart of the security story.</div>
</div>
</div>

<div style="font-size:0.78em;font-weight:700;letter-spacing:0.09em;opacity:0.55;margin:26px 0 10px;">D &nbsp;·&nbsp; CONFIGURATION — per-customer settings, declared once</div>
<div style="display:flex;flex-wrap:wrap;gap:12px;">
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">D1</span><span style="font-size:0.78em;font-weight:600;opacity:0.5;">declared in config</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">inputs</span><span style="font-weight:800;opacity:0.7;">×4</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">domain · instance_type · debug_mode · api_token</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">The knobs each install exposes: node sizing, root domain — plus one internal-only flag and one sensitive value. Set per customer, templated everywhere.</div>
</div>
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">D2</span><span style="font-size:0.78em;font-weight:600;opacity:0.5;">declared in config</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">secrets</span><span style="font-weight:800;opacity:0.7;">×2</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">db_password · api_key</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">Materialized per install (one auto-generated, one vendor-supplied) and synced into the cluster as Kubernetes Secrets — never committed anywhere.</div>
</div>
</div>

<div style="font-size:0.78em;font-weight:700;letter-spacing:0.09em;opacity:0.55;margin:26px 0 10px;">E &nbsp;·&nbsp; GUARDRAILS — what the platform is allowed to do, in reviewable files</div>
<div style="display:flex;flex-wrap:wrap;gap:12px;">
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">E1</span><span style="font-size:0.78em;font-weight:600;opacity:0.5;">declared in config</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">IAM roles</span><span style="font-weight:800;opacity:0.7;">×6</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">provision · setup · maintenance · sandbox-updates · actions · deprovision</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">One scoped Identity and Access Management (IAM) role per operation, each capped by a permissions boundary the customer can read before installing.</div>
</div>
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">E2</span><span style="font-size:0.78em;font-weight:600;opacity:0.5;">declared in config</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">OPA policies</span><span style="font-weight:800;opacity:0.7;">×4</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">cluster-requirements · sandbox-limits · deny-public-api-ingress · deny-public-s3-bucket</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">Open Policy Agent rules evaluated <em>before</em> any change applies. A failing policy blocks the operation.</div>
</div>
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">E3</span><span style="font-size:0.78em;font-weight:600;opacity:0.5;">declared in config</span></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">break-glass role</span><span style="font-weight:800;opacity:0.7;">×1</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">break_glass.toml</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">Pre-declared, fully recorded emergency access: administrator minus an explicit deny on Secrets Manager. Agreed to before the emergency.</div>
</div>
</div>

<div style="font-size:0.78em;font-weight:700;letter-spacing:0.09em;opacity:0.55;margin:26px 0 10px;">F &nbsp;·&nbsp; OPERATIONS — how the install is maintained after deploy</div>
<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:6px;">
<div style="flex:1 1 210px;min-width:200px;border:1px solid rgba(127,127,127,0.28);border-radius:8px;padding:14px 16px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;"><span style="font-family:monospace;font-weight:800;opacity:0.5;letter-spacing:0.05em;">F1</span>{{ if gt $pt 0 }}<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78em;font-weight:600;color:{{ if $healthOk }}#15803d{{ else }}#b91c1c{{ end }};"><span style="width:8px;height:8px;border-radius:50%;background:{{ if $healthOk }}#16a34a{{ else }}#dc2626{{ end }};display:inline-block;"></span>{{ $pr }}/{{ $pt }} pods ready</span>{{ else }}<span style="font-size:0.78em;font-weight:600;opacity:0.5;">not run yet</span>{{ end }}</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-weight:800;">actions</span><span style="font-weight:800;opacity:0.7;">×3</span></div>
<div style="font-family:monospace;font-size:0.72em;opacity:0.55;margin:2px 0 8px;">cron_status · debug · lifecycle_hooks</div>
<div style="font-size:0.84em;line-height:1.4;opacity:0.8;">Scheduled checks, on-demand diagnostics, and lifecycle hooks that run inside the install. {{ if ne $checkedAt "" }}Last check <nuon-time time="{{ $checkedAt }}" format="relative"></nuon-time>.{{ else }}The hourly check hasn't run yet — trigger <code>cron_status</code> from the Actions tab.{{ end }}</div>
</div>
</div>

## What just happened?

Creating this install performed every step below, in order. The checkmarks are live.

<div style="display:flex;flex-direction:column;gap:10px;margin:18px 0 8px;">
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">1</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Provision the infrastructure (<strong>B1</strong>, <strong>B2</strong>) in <code>{{ $accountId }}</code> ({{ $region }}) — cluster, VPC <code>{{ $vpcId }}</code>, DNS, and the runner (<strong>C1</strong>).</div>
<span style="font-weight:800;flex:none;color:{{ if and $sandboxOk $stackOk }}#16a34a{{ else }}#64748b{{ end }};">{{ if and $sandboxOk $stackOk }}✓{{ else }}…{{ end }}</span>
</div>
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">2</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Build your application's components (<strong>A1–A4</strong>) and deploy them in dependency order ({{ $cR }}/{{ $cT }} components active).</div>
<span style="font-weight:800;flex:none;color:{{ if $allCompsOk }}#16a34a{{ else }}#64748b{{ end }};">{{ if $allCompsOk }}✓{{ else }}…{{ end }}</span>
</div>
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">3</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Issue the TLS certificate and stand up the public endpoint (<strong>B3</strong>, <strong>B4</strong>). {{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}The app is live: <a href="https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/"><strong>app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }} ↗</strong></a>{{ else }}The public URL appears here once the sandbox is provisioned.{{ end }}</div>
<span style="font-weight:800;flex:none;color:{{ if eq $sAlb "active" }}#16a34a{{ else }}#64748b{{ end }};">{{ if eq $sAlb "active" }}✓{{ else }}…{{ end }}</span>
</div>
<div style="display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(127,127,127,0.22);border-radius:8px;padding:14px 16px;">
<span style="font-family:monospace;font-weight:800;font-size:1.05em;border:1.5px solid rgba(127,127,127,0.5);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;">4</span>
<div style="flex:1;font-size:0.92em;line-height:1.45;">Start scheduled health checks (<strong>F1</strong>): every pod, every hour{{ if gt $pt 0 }} — currently <strong>{{ $pr }}/{{ $pt }} ready</strong>{{ if ne $checkedAt "" }}, last run <nuon-time time="{{ $checkedAt }}" format="relative"></nuon-time>{{ end }}{{ end }}.</div>
<span style="font-weight:800;flex:none;color:{{ if $healthOk }}#16a34a{{ else }}#64748b{{ end }};">{{ if $healthOk }}✓{{ else }}…{{ end }}</span>
</div>
</div>

Nobody SSH'd into anything, and the whole sequence repeats identically for the next customer account.

## What would this look like for *your* app?

Kitchen Sink is a stand-in for **your product**. If your enterprise customers want your software running inside **their** cloud account — Bring Your Own Cloud (BYOC) — these are the moments that actually make or break that model, and every one of them is something you can do from this page.

**A new enterprise customer signs.** Their security team won't approve the shared-SaaS version; the deal depends on running in their AWS account. This install *is* that motion: connect the account, create an install, and Nuon stamps out the full stack from the config repo. Customer number two is the same motion again — installs are reproduced from config, not hand-built by your best infrastructure engineer.

**Release day.** You merge v2. A `nuon apps sync` picks up the change and builds new component versions; you roll them out install by install, or across the fleet, with every deploy versioned and logged. *Try it: open the **Components** tab and click `kitchen_sink` — this install has already taken multiple chart deploys, and you can read each one's history.*

**A support ticket lands: "it's acting weird."** Normally this means a week of screenshare archaeology, because you have no access to the customer's environment. Here, you open **Actions** and run `debug` — it executes *inside the customer's boundary* and streams pod status, recent events, and application logs back to this dashboard. No credentials handed out, no VPN. The hourly `cron_status` check (part **F1**, step 4 above) is the same idea on a schedule.

**The customer's platform team wants changes.** Bigger nodes, their own domain. That's what **inputs** (part **D1**) are for: `instance_type` and `domain` are declared once in the config with sane defaults, surfaced per install, and flow into infrastructure and components as template variables. Some inputs are for your eyes only (`debug_mode` is internal), and some are secret by design (`api_token` is marked sensitive). *Try it: **Current inputs**, top right of this page.*

**Something changed under you.** Someone in the customer's account hand-edited the infrastructure. The **Drift detection** indicator in this page's header catches the divergence, and a reprovision re-applies the desired state — the config repo, not the cloud account, stays the source of truth.

**The security review asks: "what exactly can you touch?"** You answer with files instead of promises: the guardrails (parts **E1–E3**) are all config — scoped Identity and Access Management (IAM) roles with permissions boundaries, Open Policy Agent policies that gate deploys, and a pre-declared, fully recorded break-glass role. All of it is in the **guardrails** tab below.

## Under the hood

Everything above, in as much detail as you want. Each tab mixes live state from this install with the config that produced it.

<nuon-tabs>

<nuon-tab name="architecture">

<div style="padding-top:1rem;"></div>

This is the real dependency graph of this install — components deploy in this order, and a change to one triggers only what depends on it:

<nuon-config-graph></nuon-config-graph>

### How a request reaches the app

1. A browser hits {{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}<code>https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}</code>{{ else }}<code>https://app.&lt;install domain&gt;</code>{{ end }} — a record in this install's public Route53 zone, managed by external-dns.
2. It lands on an **internet-facing Application Load Balancer** (part B4), which terminates TLS using the wildcard certificate from AWS Certificate Manager (part B3) and health-checks the app on `/livez`.
3. The load balancer forwards to the `kitchen-sink-ui` service on port 3000; the UI calls the API over the in-cluster service (`http://kitchen-sink-api:8080`), and the worker runs alongside. None of the API or worker traffic ever leaves the cluster.

### What the sandbox provides

The **sandbox** (part B1) is the platform layer every component lands on, defined in [`sandbox.toml`](https://github.com/nuonco/kitchen-sink/blob/main/sandbox.toml) and sourced from [`nuonco/aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox): an EKS 1.34 cluster (`n-{{ .nuon.install.id }}`), a dedicated VPC (`{{ $vpcId }}`), public and internal Route53 zones, plus in-cluster essentials — cert-manager, external-dns, ingress-nginx, and the AWS Load Balancer Controller.

### Who does the work: the runner

Every build, deploy, and action for this install executes on the **runner** (part C1) — an EC2 Auto Scaling group *inside* account `{{ $accountId }}`, stood up by the CloudFormation stack `nuon-kitchen-sink-{{ .nuon.install.id }}` ([`stack.toml`](https://github.com/nuonco/kitchen-sink/blob/main/stack.toml), [`runner.toml`](https://github.com/nuonco/kitchen-sink/blob/main/runner.toml)). It authenticates outbound using its instance identity and polls for work — **Nuon never needs inbound access to the customer's account**. That asymmetry is the heart of the security story.

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
      <td>The public HTTPS entry point: an internet-facing Application Load Balancer terminating TLS in front of the UI.</td>
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
      <td>Collects node, pod, service, and ingress state; emits <code>pods_ready</code>/<code>pods_total</code>/<code>checked_at</code> as structured outputs — which is exactly what feeds part <strong>F1</strong>'s live check in the parts list above.</td>
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

**Inputs** (part D1) are the knobs a vendor exposes per install. Each is declared in [`inputs/`](https://github.com/nuonco/kitchen-sink/tree/main/inputs), grouped for the UI, and referenced anywhere in the config as a template variable — the sandbox, for example, builds this install's DNS zone from the `domain` input.

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

**Secrets** (part D2, [`secrets.toml`](https://github.com/nuonco/kitchen-sink/blob/main/secrets.toml)) are first-class: declared in config, materialized per install, and synced into the cluster as Kubernetes Secrets — never committed anywhere.

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

The answer to "what exactly can Nuon touch in our account?" — as config files, all reviewable in the repo. These are parts E1–E3.

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

Every part, table, and behavior on this page came from [nuonco/kitchen-sink](https://github.com/nuonco/kitchen-sink) — including this page itself ([`control-plane.md`](https://github.com/nuonco/kitchen-sink/blob/main/control-plane.md) is a template rendered against the install's live state). To go deeper, start with the [Nuon documentation](https://docs.nuon.co/get-started/introduction).
