# UI

The web app the install publishes at `https://app.<install domain>`. A Go server
(`main.go`) embeds a Vite + TypeScript SPA from `frontend/` and does three
things:

- serves the SPA, falling back to `index.html` for unknown paths
- proxies `/api/*` to the app's API in the cluster (`API_URL`) — sync status
  and cluster introspection — through the allowlist and response filter in
  `apifilter.go`
- serves `/api/ui-config`, `/livez` and `/readyz` itself

## The /api/ boundary

This app is published on the install's internet-facing load balancer and the
API has no authentication, so anything the proxy forwards is
public. `apifilter.go` is that boundary:

- only the endpoints these views read are forwarded — five introspection
  endpoints (`/introspect/kube`, `/introspect/helm`, `/introspect/env`,
  `/introspect/namespace/<the app's own namespace>`, and that same namespace's
  `/events`) plus the two read-only sync status endpoints (`/sync/pipelines`
  and `/sync/runs` — exact paths, query strings only). Everything else answers
  403 with an explanation, including
  `/introspect/secrets` and `/introspect/helm-values/...`, which return
  credentials by design.
- responses are filtered on the way back: Kubernetes Secret values, container
  environment values whose name looks like a credential, and Helm hook manifests
  are replaced or dropped.
- the filter fails closed. If it cannot parse a response it is never forwarded;
  the proxy's error handler answers 502 instead.

`apifilter_test.go` covers all of it. Do not move this logic into the frontend —
a browser-side filter protects nobody, since the endpoint can just be called
directly.

`/api/ui-config` is how the frontend learns which install it is running in. The
chart passes `NUON_INSTALL_ID`, `NUON_ORG_ID` and friends from
`components/chart/values.yaml`; any value that did not resolve is dropped, and
the UI hides the fact or the dashboard link rather than showing a broken one.

## Local development

`frontend/dist` is embedded with `//go:embed`, so it has to exist before the Go
build. It is generated, not committed:

```sh
cd frontend && npm ci && npm run build && cd ..
go build -o /tmp/ui . && API_URL=http://localhost:8080 /tmp/ui
```

Or run the frontend on its own with `npm run dev` — `vite.config.ts` proxies
`/api` to `localhost:8080`, where a local copy of `../api` would be listening.
Without an API the views render their error states, and without the env vars
above the install facts and dashboard links are simply absent.

## Deploying

`components/images/ui.toml` is a `container_image` component pulling a
CI-published image from Nuon's public ECR gallery. Pushes touching this
directory are built and published by `.github/workflows/build-images.yaml`,
which then stamps the new tag into `components/images/ui.toml`; that stamp
commit is what starts the staged rollout. Read the comment at the top of the
`Dockerfile` before changing it: it is written defensively against cache reuse,
so every stage wipes the directory it owns before writing to it.
