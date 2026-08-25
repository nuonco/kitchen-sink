# Actions

Single scripts that run on the install's runner, inside the customer's account —
manually, on a cron, or off lifecycle hooks. Each is a directory with a `nuon.toml`
(triggers, role, env vars) and a `script.sh`.

| Action | Triggers | What it does |
|--------|----------|--------------|
| [`cron_status`](./cron_status/nuon.toml) | hourly cron, manual | pod/node/service status; feeds the install README's health pulse |
| [`debug`](./debug/nuon.toml) | manual | read-only diagnostics: pods, events, helm, logs |
| [`lifecycle_hooks`](./lifecycle_hooks/nuon.toml) | provision + deploy hooks, manual | logs each lifecycle event it fires on |
| [`break_glass_remediation`](./break_glass_remediation/nuon.toml) | manual | force-rolls the app's workloads under the break-glass role |
| [`break_glass_s3_pull`](./break_glass_s3_pull/nuon.toml) | manual | reads the demo object the bucket policy hides from everyone else |
| [`break_glass_kubectl`](./break_glass_kubectl/nuon.toml) | role-enabled, role-disabled, manual | creates/deletes an EKS access entry for a customer principal |

## Break-glass demos

Both gates key off one switch: the customer enabling or disabling the
`<install-id>-app-break-glass` role ([`../break_glass.toml`](../break_glass.toml))
in their install stack.

**S3 read.** The bucket policy in
[`../components/pulumi/main.go`](../components/pulumi/main.go) denies
`s3:GetObject` to every principal except the break-glass and Nuon lifecycle
roles — the account admin included:

```sh
aws s3 cp s3://kitchen-sink-<install-id>/break-glass/demo.txt -   # AccessDenied
```

Enable break glass and run `break_glass_s3_pull`: the object's contents appear in
the run logs. Disable it and the same run fails — the role can no longer be assumed.

**kubectl.** Set the `kubectl_principal` install input to an IAM principal ARN.
Enabling break glass fires `break_glass_kubectl` on the role-enabled hook, which
creates an EKS access entry for that principal; disabling fires it again on
role-disabled and deletes the entry.

```sh
aws eks update-kubeconfig --name n-<install-id> --region <region>
kubectl get pods -n kitchen-sink    # works only while break glass is enabled
```
