# Kitchen Sink

{{ $accountId := dig "account_id" "000000000000" .nuon.install_stack.outputs }}
{{ $region := .nuon.cloud_account.aws.region }}
{{ $vpcId := dig "vpc_id" "vpc-000000" .nuon.install_stack.outputs }}

<nuon-tabs>

<nuon-tab name="about">

<div style="padding-top:1rem;"></div>

A test application showcasing all features of the Nuon platform including Helm charts, Pulumi infrastructure, container images, actions, roles, and policies. Access your app here: [https://app.{{ .nuon.install.sandbox.outputs.nuon_dns.public_domain.name }}](https://app.{{ .nuon.install.sandbox.outputs.nuon_dns.public_domain.name }})

## What Gets Deployed

<table>
  <thead>
    <tr>
      <th>Feature</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Helm Chart</strong></td>
      <td>Deploys API, UI, and Worker pods to EKS</td>
    </tr>
    <tr>
      <td><strong>Pulumi Infrastructure</strong></td>
      <td>Creates an S3 bucket with encryption and versioning</td>
    </tr>
    <tr>
      <td><strong>Container Images</strong></td>
      <td>Pre-built images from private ECR</td>
    </tr>
    <tr>
      <td><strong>Actions</strong></td>
      <td>Automated health checks, debugging, and lifecycle hooks</td>
    </tr>
    <tr>
      <td><strong>Policies</strong></td>
      <td>OPA policies for security and compliance</td>
    </tr>
  </tbody>
</table>

## About this App Config

The full source code can be referenced [here](https://github.com/nuonco/kitchen-sink). For more information on Nuon platform features, see the [documentation](https://docs.nuon.co/get-started/introduction).

</nuon-tab>

<nuon-tab name="health">

<div style="padding-top:1rem;"></div>

## Deployment Status

{{ $helmComponent := .nuon.components.kitchen_sink }}
{{ $helmStatus := dig "status" "unknown" $helmComponent }}
{{ $pulumiComponent := .nuon.components.pulumi_infra }}
{{ $pulumiStatus := dig "status" "unknown" $pulumiComponent }}
{{ $apiComponent := .nuon.components.img_api }}
{{ $apiStatus := dig "status" "unknown" $apiComponent }}
{{ $uiComponent := .nuon.components.img_ui }}
{{ $uiStatus := dig "status" "unknown" $uiComponent }}

<table>
  <thead>
    <tr>
      <th>Component</th>
      <th>Status</th>
      <th>Type</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>kitchen_sink</strong></td>
      <td><nuon-status status="{{ $helmStatus }}" variant="badge"></nuon-status></td>
      <td>helm_chart</td>
    </tr>
    <tr>
      <td><strong>pulumi_infra</strong></td>
      <td><nuon-status status="{{ $pulumiStatus }}" variant="badge"></nuon-status></td>
      <td>pulumi</td>
    </tr>
    <tr>
      <td><strong>img_api</strong></td>
      <td><nuon-status status="{{ $apiStatus }}" variant="badge"></nuon-status></td>
      <td>container_image</td>
    </tr>
    <tr>
      <td><strong>img_ui</strong></td>
      <td><nuon-status status="{{ $uiStatus }}" variant="badge"></nuon-status></td>
      <td>container_image</td>
    </tr>
  </tbody>
</table>

</nuon-tab>

<nuon-tab name="debug">

<div style="padding-top:1rem;"></div>

## Recent Actions

{{ $workflows := dict }}
{{ with .nuon.actions }}{{ $workflows = default dict .workflows }}{{ end }}
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

<div style="display:flex;align-items:baseline;gap:0.75rem;"><h3 style="margin:0;">Components</h3></div>

<table style="width:100%;">
  <thead>
    <tr><th style="width:40%;">Name</th><th style="width:30%;">Type</th><th style="width:30%;">Status</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>kitchen_sink</code></td>
      <td>helm_chart</td>
      <td><nuon-status status="{{ $helmStatus }}" variant="badge"></nuon-status></td>
    </tr>
    <tr>
      <td><code>pulumi_infra</code></td>
      <td>pulumi</td>
      <td><nuon-status status="{{ $pulumiStatus }}" variant="badge"></nuon-status></td>
    </tr>
    <tr>
      <td><code>img_api</code></td>
      <td>container_image</td>
      <td><nuon-status status="{{ $apiStatus }}" variant="badge"></nuon-status></td>
    </tr>
    <tr>
      <td><code>img_ui</code></td>
      <td>container_image</td>
      <td><nuon-status status="{{ $uiStatus }}" variant="badge"></nuon-status></td>
    </tr>
  </tbody>
</table>

  </div>
</div>

<div style="margin-top:1.5rem;">

<div style="display:flex;align-items:baseline;gap:0.75rem;"><h3 style="margin:0;">Install Information</h3></div>

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

</nuon-tab>

</nuon-tabs>
