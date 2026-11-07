# Kitchen Sink — BYO EKS

A lightweight Kitchen Sink app for an existing EKS cluster. It deploys the
shared API, UI, and worker, which emit OTLP traces, metrics, and logs directly
to an independently deployed Nuon telemetry agent.

## Prerequisites

- An existing EKS cluster with worker capacity and access-entry authentication
  (`API` or `API_AND_CONFIG_MAP`).
- The install stack must use the cluster's AWS account, region, VPC, and subnets.
  The runner subnet needs outbound access to Nuon, AWS APIs, and image registries.
  Enable the private EKS endpoint so the runner can reach it inside the VPC.
- Use a dedicated test cluster. The operation roles use AWS `AdministratorAccess`,
  and the maintenance role receives EKS cluster-admin access because the shared
  demo chart creates cluster-wide RBAC. These are not production least-privilege
  permissions.

The stack deploys the runner into the existing VPC, adds a runner-to-EKS HTTPS
security-group rule, and creates the maintenance role's EKS access entry. The
sandbox discovers the existing cluster and creates install-owned ECR resources;
it does not create or own the cluster. DNS, ingress controllers, Kyverno,
databases, and load balancers are not provisioned by this app.

## Configuration

Set `cluster_name` to the existing cluster. The example install config is
[`install-configs/stage/example.toml`](./install-configs/stage/example.toml).
Supply the existing VPC and subnet IDs when applying the generated install stack.
Custom CloudFormation templates are local files uploaded by Nuon during sync;
they do not need a separate template-publication step.

The `default` app branch is manual-only. Its Git ref must contain this app config.
The component sources are public repositories. `nuonctl seed` discovers app
configs from its cached `main` checkout; to test an unmerged Git branch, create
a fresh app and sync the branch config separately. This variant does not require
access to a private application repo.

## Telemetry

Deploy the [Nuon telemetry agent](https://github.com/nuonco/charts/tree/main/charts/telemetry-agent)
separately using an install-scoped telemetry token mounted from a Kubernetes
Secret. Do not put credentials in this app config. Enable telemetry forwarding
in the install's Nuon settings; the example install config enables it.

The default `telemetry_otlp_endpoint` targets release `nuon-telemetry` in namespace
`telemetry`. Override it for another agent Service or namespace. Restrict that
Service's unauthenticated OTLP ingress to trusted producers for this install.
The API and worker export over OTLP/HTTP; no intermediate collector or runner
telemetry endpoint is used. Until the agent is deployed, the application still
runs but telemetry exports cannot succeed.

Set `telemetry_demo_profile` to `steady`, `noisy`, or `incident` to vary the worker's
synthetic workload. When testing against a local control plane, the cluster's
agent and the cloud runner need reachable API addresses; `localhost` on the
developer machine is not reachable from EKS.

## Access and teardown

There is no public ingress. Access the UI through the existing cluster context:

```sh
kubectl -n kitchen-sink port-forward service/kitchen-sink-ui 3000:3000
```

Open `http://localhost:3000`. Deprovision the Nuon install before removing its
CloudFormation stack: Helm teardown removes the app's workloads and RBAC, sandbox
teardown removes install-owned resources, and stack deletion removes the runner,
access entry, and HTTPS rule. The existing EKS cluster is retained. Separately
remove the manually installed telemetry agent and its bootstrap Secret.
