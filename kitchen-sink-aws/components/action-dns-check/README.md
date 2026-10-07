# dns_check action image

Source for the `action_dns_check` container-image component. The `dns_check`
action runs inside it. The image includes `dig`, `nslookup`, `curl`, and `jq`.

GitHub Actions publishes to Nuon's public GAR repository when a release tag
is pushed:

```sh
git tag action-dns-check/v1.0.0
git push origin action-dns-check/v1.0.0
```

The workflow strips the `action-dns-check/v` prefix and publishes the image as
`1.0.0`. It can also be run manually with a semver version to bootstrap a new
repository.

The repository must define these GitHub Actions variables using the outputs
from `mono/infra/artifacts`:

- `GCP_PUBLIC_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_PUBLIC_SERVICE_ACCOUNT`

`components/images/action_dns_check.toml` uses `update_policy = "~1.0.0"`, so
Nuon selects the highest published `1.0.x` version whenever the component
builds. Publishing an image does not trigger a Nuon build by itself.
