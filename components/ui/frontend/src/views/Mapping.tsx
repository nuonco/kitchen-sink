import { useState } from 'react'
import type { UIConfig } from '../lib/api'
import { branchName, components, repoName } from '../lib/config-data.gen'
import { buildGraph } from '../lib/graph'
import { useMarkStepSeen } from '../lib/progress'
import { StepNav } from '../ui/CapabilityGrid'
import {
  BackLink,
  Callout,
  Icon,
  OutLink,
  Section,
} from '../ui/Primitives'

interface ComponentType {
  type: string
  /** One line for the matrix row. */
  purpose: string
  /** The open row's detail. */
  what: string
  here: string
  file: string
  toml: string
}

/**
 * One row per component type this app config actually uses. The TOML is copied
 * from the repo, so what a visitor reads here is the config that produced the
 * install they are reading it in.
 */
const types: ComponentType[] = [
  {
    type: 'helm_chart',
    purpose: 'Deploy a Helm chart',
    what:
      'Deploys a Helm chart into the install cluster. Nuon interpolates your values file first, so image tags and sandbox outputs are filled in per install.',
    here:
      'kitchen_sink: the API, the worker, and this UI. One chart, three deployments.',
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
    what:
      'Copies an image you have already built into the install. Use it when your CI publishes images and you only want Nuon to deploy them.',
    here:
      'img_ui (this page) and img_api (the introspection API). CI builds both from this repo and publishes them to a public ECR gallery; Nuon only pulls the tag the config pins.',
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
    what:
      'Runs a Terraform module. The runner holds the state and the credentials, so your customer keeps both.',
    here:
      'certificate: a DNS-validated wildcard ACM certificate for *.<install domain>, which the load balancer then terminates HTTPS with.',
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
    what:
      'Runs a Pulumi program in Go, TypeScript or Python. Same contract as Terraform: your code, the customer’s account, the runner in between.',
    here:
      'pulumi_infra: an S3 bucket with encryption and versioning, named from the install id.',
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
    what:
      'Applies raw YAML or a kustomize overlay. The escape hatch for anything that is not packaged as a chart.',
    here:
      'kustomizeapp: the Argo CD guestbook example, applied straight from a public repo into its own namespace.',
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

/** The components of one type, from the generated config, so the matrix
    never disagrees with the graph below it. */
const usesOf = (type: string) =>
  components
    .filter((c) => c.type === type)
    .map((c) => c.name)
    .join(' · ')

const typeCount = new Set(components.map((c) => c.type)).size

/** The file's home in the repo, at the branch this install tracks. */
function repoFileURL(file: string): string {
  return `https://github.com/${repoName}/blob/${branchName}/${file}`
}

function FileCode({ file, code }: { file: string; code: string }) {
  return (
    <div className="filecode">
      <a
        className="filecode__name mono"
        href={repoFileURL(file)}
        target="_blank"
        rel="noreferrer"
      >
        {file} <Icon name="arrow-up-right" />
      </a>
      <pre className="raw">{code}</pre>
    </div>
  )
}

/** The matrix: one row per type, one row open at a time. */
function TypeMatrix() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="typelist">
      {types.map((t) => {
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
                  <strong>In this app:</strong> {t.here}
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

/** The graph this app's own components draw, one row per deploy wave. */
function DependencyGraph() {
  const graph = buildGraph(components)
  const byName = new Map(graph.nodes.map((n) => [n.name, n]))

  // Per node, what it needs — the edges pointing into it, named.
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
                      <span className="cgraph__node-type mono">
                        {byName.get(name)?.type}
                      </span>
                      {nodeNeeds && (
                        <span className="cgraph__node-needs mono">
                          needs {nodeNeeds.join(' · ')}
                        </span>
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

export function Mapping({ config }: { config: UIConfig }) {
  useMarkStepSeen('/map')
  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <h1>How does my product map onto this?</h1>
        <p className="lede">
          A component is one deployable piece of your product, described by a
          TOML file in your repo.
        </p>
      </header>

      <Section title="The component types" aside={`${typeCount} of them, in this app`}>
        <TypeMatrix />
        <Callout label="A first config needs one type">
          Pick the type that matches how you already ship — a chart, a prebuilt
          image, a Terraform module. The other {typeCount - 1} are here because
          this app exists to show them.
        </Callout>
        {config.links.components && (
          <div className="row" style={{ marginTop: 24 }}>
            <OutLink href={config.links.components}>
              See every component for this install
            </OutLink>
          </div>
        )}
      </Section>

      <Section title="How they find each other" aside="outputs · dependencies">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Each component names its own{' '}
          <span className="mono">dependencies</span>; it deploys one wave
          below the deepest one it names. Any component can also interpolate
          another&rsquo;s outputs, the way <span className="mono">values.yaml</span>{' '}
          does below.
        </p>
        <DependencyGraph />
        <FileCode
          file="components/chart/values.yaml"
          code={`api:
  image: "{{.nuon.components.img_api.outputs.image.repository}}:{{.nuon.components.img_api.outputs.image.tag}}"`}
        />
      </Section>
      <StepNav current="/map" />
    </>
  )
}
