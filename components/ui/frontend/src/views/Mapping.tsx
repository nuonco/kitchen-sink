import { useState } from 'react'
import type { UIConfig } from '../lib/api'
import { branchName, repoName } from '../lib/config-data.gen'
import { stepEyebrow } from '../lib/taxonomy'
import { useMarkStepSeen } from '../lib/progress'
import { StepNav } from '../ui/CapabilityGrid'
import {
  BackLink,
  Callout,
  Eyebrow,
  Icon,
  OutLink,
  Section,
} from '../ui/Primitives'

interface ComponentType {
  type: string
  /** One line for the matrix row. */
  purpose: string
  /** What this type is in this app, named. */
  uses: string
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
    uses: 'conduit',
    what:
      'Deploys a Helm chart into the install cluster. Nuon interpolates your values file first, so image tags and other components’ outputs are filled in per install.',
    here:
      'conduit: the sync engine, the source Postgres, the API, and this UI. One chart, four deployments.',
    file: 'components/chart/nuon.toml',
    toml: `name = "conduit"
type = "helm_chart"
chart_name = "conduit"
namespace = "conduit"
storage_driver = "configmap"
dependencies = ["img_api", "img_ui"]

[public_repo]
repo = "nuonco/kitchen-sink"
directory = "components/chart"
branch = "ms/theme-conduit"

[[values_file]]
contents = "./chart/values.yaml"`,
  },
  {
    type: 'container_image',
    purpose: 'Sync an image your CI already built',
    uses: 'img_ui · img_api',
    what:
      'Copies an image you have already built into the install. Use it when your CI publishes images and you only want Nuon to deploy them.',
    here:
      'img_ui (this page) and img_api (the API and the sync engine, one image). CI builds both from this repo and publishes them to a public ECR gallery; Nuon only pulls the tag the config pins. img_premium_connector shows the private-registry variant, pulled with an IAM role Nuon assumes.',
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
    uses: 'certificate',
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
    uses: 'destination_bucket',
    what:
      'Runs a Pulumi program in Go, TypeScript or Python. Same contract as Terraform: your code, the customer’s account, the runner in between.',
    here:
      'destination_bucket: the S3 bucket every sync lands in, plus the IAM role the engine writes with — assumed through the worker’s service account (IRSA), so no access key exists anywhere.',
    file: 'components/pulumi/nuon.toml',
    toml: `name    = "destination_bucket"
type    = "pulumi"
runtime = "go"

[public_repo]
repo      = "nuonco/kitchen-sink"
directory = "components/pulumi"
branch    = "ms/theme-conduit"

[config]
"aws:region"                = "{{.nuon.install_stack.outputs.region}}"
"conduit:install_id"        = "{{.nuon.install.id}}"
"conduit:oidc_provider_arn" = "{{.nuon.install.sandbox.outputs.cluster.oidc_provider_arn}}"`,
  },
  {
    type: 'kubernetes_manifest',
    purpose: 'Apply raw YAML or a kustomize overlay',
    uses: 'tictactoe · compliance_export',
    what:
      'Applies raw YAML or a kustomize overlay. The escape hatch for anything that is not packaged as a chart.',
    here:
      'the two toggleable components — compliance_export (the Enterprise destination) and tictactoe — both applied as kustomize overlays, deployed only where the toggle is on.',
    file: 'components/tictactoe.toml',
    toml: `name = "tictactoe"
type = "kubernetes_manifest"

namespace    = "conduit"
dependencies = ["conduit"]

toggleable      = true
default_enabled = false

[public_repo]
directory = "."
repo      = "nuonco/kitchen-sink"
branch    = "ms/theme-conduit"

[kustomize]
path        = "./src/components/tictactoe"
enable_helm = false`,
  },
]

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
              <span className="typerow__uses mono">{t.uses}</span>
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

/**
 * The dependency order of this app's core pieces, copied from each
 * component's own `dependencies` line — plus the one edge that comes from an
 * output reference rather than a dependencies list.
 */
const deployOrder = [
  {
    label: 'img_api · img_ui',
    detail: 'container_image — nothing to wait for',
  },
  {
    label: 'destination_bucket',
    detail: 'the chart interpolates its outputs',
  },
  {
    label: 'conduit',
    detail: 'dependencies = ["img_api", "img_ui"]',
  },
  {
    label: 'application_load_balancer',
    detail: 'dependencies = ["certificate", "conduit"]',
  },
]

export function Mapping({ config }: { config: UIConfig }) {
  useMarkStepSeen('/map')
  return (
    <>
      <BackLink to="/">Conduit</BackLink>
      <header className="page-header">
        <Eyebrow>{stepEyebrow('/map')}</Eyebrow>
        <h1>How does my product map onto this?</h1>
        <p className="lede">
          A component is one deployable piece of your product, described by a
          small TOML file in your repo. Conduit is nine of them.
        </p>
      </header>

      <Section title="The component types" aside="Five of them, in this app">
        <TypeMatrix />
        <Callout label="A first config needs one, not five">
          Pick the type that matches how you already ship — a chart, a prebuilt
          image, a Terraform module. The other four are here because Conduit
          needs them.
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
          <span className="mono">dependencies</span> orders the deploys; any
          component can interpolate another&rsquo;s outputs. That second
          mechanism is how the engine knows its bucket:
        </p>
        <div className="ship">
          {deployOrder.map((beat, i) => (
            <span key={beat.label} className="ship__beat">
              <span className="ship__num">0{i + 1}</span>
              <span className="ship__label">{beat.label}</span>
              <span className="ship__detail mono">{beat.detail}</span>
            </span>
          ))}
        </div>
        <FileCode
          file="components/chart/values.yaml"
          code={`worker:
  env:
    S3_BUCKET: "{{.nuon.components.destination_bucket.outputs.bucket_name}}"

api:
  image: "{{.nuon.components.img_api.outputs.image.repository}}:{{.nuon.components.img_api.outputs.image.tag}}"`}
        />
      </Section>
      <StepNav current="/map" />
    </>
  )
}
