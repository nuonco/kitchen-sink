import { useState } from 'react'
import type { UIConfig } from '../../lib/api'
import { branchName, components, repoName } from '../../lib/config-data.gen'
import { buildGraph } from '../../lib/graph'
import type { PanelProps } from '../../lib/panels'
import { Icon } from '../Primitives'

/* ============================================================
   components: the component types this config uses, each with its TOML
   quoted from the repo, and the dependency graph they draw. Config only.
   From the old "Your product as components" page.
   ============================================================ */

interface ComponentType {
  type: string
  purpose: string
  what: string
  /** The instance in this app; a function when it names a live value. */
  here: string | ((config: UIConfig) => string)
  file: string
  toml: string
}

const types: ComponentType[] = [
  {
    type: 'helm_chart',
    purpose: 'Deploy a Helm chart',
    what: 'Deploys a Helm chart into the install cluster. Nuon interpolates the values file first, so image tags and sandbox outputs are filled in per install.',
    here: 'kitchen_sink: one chart deploying the API, the worker, and this UI.',
    file: 'components/chart/nuon.toml',
    toml: `name = "kitchen_sink"
type = "helm_chart"
chart_name = "kitchen-sink"
namespace = "kitchen-sink"
storage_driver = "configmap"
dependencies = ["img_api", "img_ui"]

[public_repo]
repo = "nuonco/kitchen-sink"
directory = "components/chart"
branch = "main"

[[values_file]]
contents = "./chart/values.yaml"`,
  },
  {
    type: 'container_image',
    purpose: 'Sync an image your CI already built',
    what: 'Copies an image you have already built into the install. Use it when your CI publishes images and you only want Nuon to deploy them.',
    here: 'img_ui (this page) and img_api (the introspection API), built by CI from this repo and published to a public ECR gallery at the tag the config pins; action_curl and action_dns_check, the images two container actions run in.',
    file: 'components/images/ui.toml',
    toml: `name     = "img_ui"
type     = "container_image"
var_name = "img_ui"

[public]
image_url = "public.ecr.aws/p7e3r5y0/kitchen-sink-ui"
# CI stamps the pinned tag on every image build
tag       = "sha-…"`,
  },
  {
    type: 'terraform_module',
    purpose: 'Run a Terraform module',
    what: 'Runs a Terraform module on the runner with the install\u2019s IAM roles, so the credentials stay in the customer\u2019s account; the state is managed by the Nuon data plane (docs.nuon.co/guides/terraform-components).',
    here: (c) =>
      `certificate: a DNS-validated wildcard ACM certificate for *.${c.public_domain ?? '<install domain>'}, which the load balancer terminates HTTPS with.`,
    file: 'components/certificate.toml',
    toml: `name              = "certificate"
type              = "terraform_module"
terraform_version = "1.11.3"

[public_repo]
repo      = "nuonco/kitchen-sink"
directory = "src/components/certificate"
branch    = "main"

[vars]
install_id  = "{{ .nuon.install.id }}"
region      = "{{ .nuon.install_stack.outputs.region }}"
zone_id     = "{{ .nuon.install.sandbox.outputs.nuon_dns.public_domain.zone_id }}"
domain_name = "*.{{ .nuon.install.sandbox.outputs.nuon_dns.public_domain.name }}"`,
  },
  {
    type: 'pulumi',
    purpose: 'Run a Pulumi program',
    what: 'Runs a Pulumi program in Go, TypeScript or Python. Same contract as Terraform: your code, the customer’s account, the runner in between.',
    here: 'pulumi_infra: an S3 bucket with encryption and versioning, named from the install id.',
    file: 'components/pulumi/nuon.toml',
    toml: `name    = "pulumi_infra"
type    = "pulumi"
runtime = "go"

[public_repo]
repo      = "nuonco/kitchen-sink"
directory = "components/pulumi"
branch    = "main"

[config]
"aws:region"              = "{{.nuon.install_stack.outputs.region}}"
"kitchen-sink:install_id" = "{{.nuon.install.id}}"`,
  },
  {
    type: 'kubernetes_manifest',
    purpose: 'Apply raw YAML or a kustomize overlay',
    what: 'Applies raw YAML or a kustomize overlay, for anything that is not packaged as a chart.',
    here: 'kustomizeapp: the Argo CD guestbook example, applied from a public repo into its own namespace.',
    file: 'components/kustomize.toml',
    toml: `name = "kustomizeapp"
type = "kubernetes_manifest"

namespace    = "{{.nuon.install.id}}-dne"
dependencies = ["kustomize_namespace"]

[public_repo]
directory = "."
repo      = "argoproj/argocd-example-apps"
branch    = "master"

[kustomize]
path        = "./kustomize-guestbook"
enable_helm = false`,
  },
]

const usesOf = (type: string) =>
  components
    .filter((c) => c.type === type)
    .map((c) => c.name)
    .join(' · ')

const typeCount = new Set(components.map((c) => c.type)).size

function repoFileURL(file: string): string {
  return `https://github.com/${repoName}/blob/${branchName}/${file}`
}

function FileCode({ file, code }: { file: string; code: string }) {
  return (
    <div className="filecode">
      <a className="filecode__name mono" href={repoFileURL(file)} target="_blank" rel="noreferrer">
        {file} <Icon name="arrow-up-right" />
      </a>
      <pre className="raw">{code}</pre>
    </div>
  )
}

function TypeMatrix({ config }: { config: UIConfig }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="typelist">
      {types
        .filter((t) => components.some((c) => c.type === t.type))
        .map((t) => {
          const isOpen = open === t.type
          return (
            <div className={isOpen ? 'typerow typerow--open' : 'typerow'} key={t.type}>
              <button
                className="typerow__head"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : t.type)}
              >
                <span className="typerow__type mono">{t.type}</span>
                <span className="typerow__purpose">{t.purpose}</span>
                <span className="typerow__uses mono">{usesOf(t.type)}</span>
                <span className="typerow__caret" aria-hidden="true">
                  <Icon name="caret-right" />
                </span>
              </button>
              {isOpen && (
                <div className="typerow__body">
                  <p className="typerow__what">{t.what}</p>
                  <p className="typerow__here">
                    <strong>In this app:</strong> {typeof t.here === 'function' ? t.here(config) : t.here}
                  </p>
                  <FileCode file={t.file} code={t.toml} />
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

function DependencyGraph() {
  const graph = buildGraph(components)
  const byName = new Map(graph.nodes.map((n) => [n.name, n]))
  const needs = new Map<string, string[]>()
  for (const e of graph.edges) {
    const list = needs.get(e.to) ?? []
    list.push(e.from)
    needs.set(e.to, list)
  }
  return (
    <div className="cgraph">
      {graph.layers.map(
        (layer, i) =>
          layer.length > 0 && (
            <div className="cgraph__layer" key={i}>
              <span className="cgraph__layer-label mono">Wave {i}</span>
              <div className="cgraph__nodes">
                {layer.map((name) => {
                  const nodeNeeds = needs.get(name)
                  return (
                    <span className="cgraph__node" key={name}>
                      <span className="cgraph__node-name mono">{name}</span>
                      <span className="cgraph__node-type mono">{byName.get(name)?.type}</span>
                      {nodeNeeds && (
                        <span className="cgraph__node-needs mono">needs {nodeNeeds.join(' · ')}</span>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          ),
      )}
    </div>
  )
}

export function ComponentsTile(_: PanelProps) {
  return (
    <>
      <span className="ptile__value">{typeCount} component types</span>
      <span className="ptile__label mono">{components.length} components · components/*.toml</span>
    </>
  )
}

export function ComponentsDrawer({ config }: PanelProps) {
  return (
    <>
      <div className="section__head">
        <h3 className="section__title">{typeCount} component types</h3>
        <div className="subtext muted">components/*.toml</div>
      </div>
      <TypeMatrix config={config} />

      <div className="section__head" style={{ marginTop: 24 }}>
        <h3 className="section__title">Deploy order</h3>
        <div className="subtext muted">dependencies · outputs</div>
      </div>
      <p className="small muted" style={{ maxWidth: '72ch' }}>
        Each component names its own <span className="mono">dependencies</span>; it deploys one wave
        below the deepest one it names. Any component can interpolate another&rsquo;s outputs, the
        way <span className="mono">values.yaml</span> does below.
      </p>
      <DependencyGraph />
      <FileCode
        file="components/chart/values.yaml"
        code={`api:
  image: "{{.nuon.components.img_api.outputs.image.repository}}:{{.nuon.components.img_api.outputs.image.tag}}"`}
      />
    </>
  )
}
