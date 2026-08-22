import { useState } from 'react'
import type { UIConfig } from '../lib/api'
import {
  branchName,
  installGroups,
  repoName,
  roles,
} from '../lib/config-data.gen'
import { useMarkStepSeen } from '../lib/progress'
import { GoldenPathStatic } from '../ui/GoldenPath'
import {
  Callout,
  CommandBlock,
  Icon,
  Mono,
  OutLink,
  PageHeader,
  Section,
} from '../ui/Primitives'

/* ============================================================
   The product-inside-product surface: one screen a buyer can point at and
   say "that's what Nuon did". The component map is the config that produced
   this install; rollout, roles, and the entitlement pointer are the levers
   around it.
   ============================================================ */

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
    uses: 'periscope',
    what:
      'Deploys a Helm chart into the install cluster. Nuon interpolates your values file first, so image tags and sandbox outputs are filled in per install.',
    here:
      'periscope — the console itself: the API, the collector, and this web UI. One chart, three deployments.',
    file: 'components/chart/nuon.toml',
    toml: `name = "periscope"
type = "helm_chart"
chart_name = "periscope"
namespace = "periscope"
storage_driver = "configmap"
dependencies = ["img_api", "img_ui"]

[public_repo]
repo = "nuonco/kitchen-sink"
directory = "components/chart"
branch = "ms/theme-periscope"

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
      'img_ui (this page) and img_api (the introspection API). CI builds both from this repo and publishes them to a public ECR gallery; Nuon only pulls the tag the config pins. img_collector_premium is the premium collector, distributed from a private ECR that Nuon assumes an IAM role to pull from — how an enterprise-only build ships.',
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
    uses: 'pulumi_infra',
    what:
      'Runs a Pulumi program in Go, TypeScript or Python. Same contract as Terraform: your code, the customer’s account, the runner in between.',
    here:
      'pulumi_infra: the report archive — an encrypted, versioned S3 bucket, periscope-reports-<install-id>. It holds real objects from the first deploy on: health-reports/ after every deploy, heartbeats/ hourly, debug-bundles/ from the support SOP.',
    file: 'components/pulumi/nuon.toml',
    toml: `name    = "pulumi_infra"
type    = "pulumi"
runtime = "go"

[public_repo]
repo      = "nuonco/kitchen-sink"
directory = "components/pulumi"
branch    = "ms/theme-periscope"

[config]
"aws:region"              = "{{.nuon.install_stack.outputs.region}}"
"periscope:install_id"  = "{{.nuon.install.id}}"`,
  },
  {
    type: 'kubernetes_manifest',
    purpose: 'Apply raw YAML or a kustomize overlay',
    uses: 'observed_workload · activity_generator',
    what:
      'Applies raw YAML or a kustomize overlay. The escape hatch for anything that is not packaged as a chart.',
    here:
      'observed_workload: the sample workload the console observes, applied straight from a public repo into its own namespace. activity_generator runs a real job there every five minutes, so the live view always has activity.',
    file: 'components/kustomize.toml',
    toml: `name = "observed_workload"
type = "kubernetes_manifest"

namespace    = "{{.nuon.install.id}}-observed"
dependencies = ["observed_namespace"]

[public_repo]
directory = "."
repo      = "argoproj/argocd-example-apps"
branch    = "master"

[kustomize]
path        = "./kustomize-guestbook"
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
 * component's own `dependencies` line.
 */
const deployOrder = [
  {
    label: 'img_api · img_ui',
    detail: 'container_image — nothing to wait for',
  },
  {
    label: 'periscope',
    detail: 'dependencies = ["img_api", "img_ui"]',
  },
  {
    label: 'application_load_balancer',
    detail: 'dependencies = ["certificate", "periscope"]',
  },
]

export function Nuon({ config }: { config: UIConfig }) {
  useMarkStepSeen('/nuon')
  const app = config.app_id ?? '<your-app-id>'

  return (
    <>
      <PageHeader
        title="Deployed by Nuon"
        lede={
          <>
            Periscope&rsquo;s job is to show you what runs here; Nuon&rsquo;s
            job was to put it here.
          </>
        }
      />

      <Section title="The golden path" aside="sandbox · components · runner">
        <GoldenPathStatic config={config} />
      </Section>

      <Section title="The component types" aside="Five of them, in this app">
        <TypeMatrix />
        <Callout label="A first config needs one, not five">
          Pick the type that matches how you already ship — a chart, a prebuilt
          image, a Terraform module. Periscope uses all five so you can see
          each one running.
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
          component can interpolate another&rsquo;s outputs.
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
          code={`api:
  image: "{{.nuon.components.img_api.outputs.image.repository}}:{{.nuon.components.img_api.outputs.image.tag}}"`}
        />
      </Section>

      <Section title="Rollout" aside="branch.toml · [[install_groups]]">
        <p className="small muted" style={{ maxWidth: '72ch' }}>
          Every push to <Mono>{branchName}</Mono> rolls out through these
          groups in order, holding for a human approval per group.
        </p>
        <div className="ship" style={{ marginTop: 12 }}>
          {installGroups.map((group) => (
            <span key={group.name} className="ship__beat">
              <span className="ship__num">0{group.order}</span>
              <span className="ship__label">{group.name}</span>
              <span className="ship__detail mono">{group.selector}</span>
            </span>
          ))}
        </div>
        <CommandBlock
          label="edit any file in your clone, then"
          command={`nuon sync --app-id ${app} --force --branch ${branchName}`}
          note={
            <>
              Uncommitted files count. <Mono>--preview</Mono> plans without
              applying.
              {config.links.branches && (
                <>
                  {' '}
                  <OutLink href={config.links.branches} variant="plain">
                    Watch the run and approve each group
                  </OutLink>
                </>
              )}
            </>
          }
        />
      </Section>

      <Section title="Access" aside="permissions/* · break_glass.toml">
        <p className="small muted" style={{ marginBottom: 16, maxWidth: '72ch' }}>
          Every operation assumes its own scoped IAM role in the account,
          named <Mono>&lt;install&gt;-&lt;role&gt;</Mono>.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Role</th>
                <th>Boundary</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.name}>
                  <td className="mono">{r.name}</td>
                  <td className="mono subtext">{r.boundary}</td>
                  <td>
                    {r.desc}
                    {r.name === 'app-break-glass' && (
                      <>
                        {' '}
                        <a href="#/operations">Emergency restart</a> uses it.
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <p className="small muted" style={{ maxWidth: '72ch' }}>
        Toggleable components appear as entitlements in{' '}
        <a href="#/settings">Settings</a>.
      </p>

      <div className="row" style={{ marginTop: 32 }}>
        {config.links.install && (
          <OutLink href={config.links.install}>
            Open this install in Nuon
          </OutLink>
        )}
        <a className="btn btn--secondary" href="#/guide">
          Evaluation guide <Icon name="arrow-right" />
        </a>
      </div>
    </>
  )
}
