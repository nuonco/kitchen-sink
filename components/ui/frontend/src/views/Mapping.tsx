import type { UIConfig } from '../lib/api'
import {
  BackLink,
  Callout,
  CodeBlock,
  Eyebrow,
  OutLink,
  Section,
} from '../ui/Primitives'

interface ComponentType {
  type: string
  what: string
  here: string
  file: string
  toml: string
}

/**
 * One card per component type this app config actually uses. The TOML is copied
 * from the repo, so what a visitor reads here is the config that produced the
 * install they are reading it in.
 */
const types: ComponentType[] = [
  {
    type: 'helm_chart',
    what:
      'Deploys a Helm chart into the install cluster. Nuon interpolates your values file first, so image tags and sandbox outputs are filled in per install.',
    here:
      'kitchen_sink — the API, the worker, and this UI. One chart, three deployments.',
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
branch = "ms/onboarding-edit"

[[values_file]]
contents = "./chart/values.yaml"`,
  },
  {
    type: 'docker_build',
    what:
      'Builds a container image from a Dockerfile in your repo, inside the customer account, and pushes it to a registry Nuon manages there. No image ever crosses accounts.',
    here:
      'img_ui — this page. The build runs on every deploy from components/ui, so editing the frontend is enough to ship a new UI.',
    file: 'components/images/ui.toml',
    toml: `name     = "img_ui"
type     = "docker_build"
var_name = "img_ui"

dockerfile    = "Dockerfile"
build_timeout = "30m"

[public_repo]
repo      = "nuonco/kitchen-sink"
directory = "components/ui"
branch    = "ms/onboarding-edit"`,
  },
  {
    type: 'container_image',
    what:
      'Copies an image you have already built into the install. Use it when your CI publishes images and you only want Nuon to deploy them.',
    here:
      'img_api — the introspection API, pulled from a private ECR repository using an IAM role Nuon assumes.',
    file: 'components/images/api.toml',
    toml: `name     = "img_api"
type     = "container_image"
var_name = "img_api"

[aws_ecr]
image_url    = "431927561584.dkr.ecr.us-west-2.amazonaws.com/kitchen-sink-app"
tag          = "2ab4b6587ee5-wip20260804004838"
region       = "us-west-2"
iam_role_arn = "arn:aws:iam::431927561584:role/nuon-ecr-access"`,
  },
  {
    type: 'terraform_module',
    what:
      'Runs a Terraform module. The runner holds the state and the credentials, so your customer keeps both.',
    here:
      'certificate — a DNS-validated wildcard ACM certificate for *.<install domain>, which the load balancer then terminates HTTPS with.',
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
    what:
      'Runs a Pulumi program in Go, TypeScript or Python. Same contract as Terraform — your code, the customer’s account, the runner in between.',
    here:
      'pulumi_infra — an S3 bucket with encryption and versioning, named from the install id.',
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
    what:
      'Applies raw YAML or a kustomize overlay. The escape hatch for anything that is not packaged as a chart.',
    here:
      'kustomizeapp — the Argo CD guestbook example, applied straight from a public repo into its own namespace.',
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

export function Mapping({ config }: { config: UIConfig }) {
  return (
    <>
      <BackLink to="/">All paths</BackLink>
      <header className="page-header">
        <Eyebrow>Path 02</Eyebrow>
        <h1>How does my product map onto this?</h1>
        <p className="lede">
          A component is one deployable piece of your product, described by a
          small TOML file in your repo. There are six kinds in play in this
          install. You almost certainly need one or two of them.
        </p>
      </header>

      <Section title="The component types" aside="Six of them, in this app">
        <div className="maps">
          {types.map((t) => (
            <article className="card" key={t.type}>
              <div className="map__type">type = &quot;{t.type}&quot;</div>
              <p className="map__what">{t.what}</p>
              <div className="map__here">
                <strong>In this app:</strong> {t.here}
              </div>
              <CodeBlock label={t.file} code={t.toml} />
            </article>
          ))}
        </div>
      </Section>

      <Section title="How they find each other" aside="Outputs and dependencies">
        <div className="prose">
          <p>
            Components are not islands. Each one publishes outputs, and any other
            component can interpolate them. That is the whole wiring model —
            there is no service mesh to configure and no registry to run.
          </p>
          <p>
            The Helm values file for this app names the two image components
            directly, and Nuon fills in the repository and tag that the build
            produced in <em>this</em> customer&rsquo;s account:
          </p>
        </div>
        <CodeBlock
          label="components/chart/values.yaml"
          code={`api:
  image: "{{.nuon.components.img_api.outputs.image.repository}}:{{.nuon.components.img_api.outputs.image.tag}}"

ui:
  image: "{{.nuon.components.img_ui.outputs.image.repository}}:{{.nuon.components.img_ui.outputs.image.tag}}"
  env:
    API_URL: "http://kitchen-sink-api:8080"
    NUON_INSTALL_ID: "{{.nuon.install.id}}"`}
        />
        <div className="prose" style={{ marginTop: 24 }}>
          <p>
            <code>dependencies = ["img_api", "img_ui"]</code> in the chart&rsquo;s TOML
            is what makes the ordering safe: the images build before the chart
            deploys. The load balancer component depends on the chart, the
            certificate on nothing, and Nuon works out the rest.
          </p>
        </div>
        <Callout label="The three-part rule, applied">
          Of the six component types here, a first app config needs exactly one.
          Pick the type that matches how you already ship — a chart, a
          Dockerfile, a Terraform module — write the sandbox, and the runner does
          the rest. The other five are here because this app exists to show them,
          not because you need them.
        </Callout>
        {config.links.components && (
          <div className="row" style={{ marginTop: 24 }}>
            <OutLink href={config.links.components}>
              See every component for this install
            </OutLink>
          </div>
        )}
      </Section>
    </>
  )
}
