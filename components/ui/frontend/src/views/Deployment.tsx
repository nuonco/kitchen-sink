import { useState } from 'react'
import {
  countReady,
  useIntrospectPoll,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import {
  branchConfigAbridged,
  branchName,
  installGroups,
  repoName,
  toggleableComponents,
} from '../lib/config-data.gen'
import { proofPrompts } from '../lib/prompts'
import {
  CodeBlock,
  CommandBlock,
  CopyButton,
  Icon,
  OutLink,
  Section,
  Tracks,
} from '../ui/Primitives'

/* ============================================================
   THE "Nuon deployed this" page: what each component does, how the install
   got here (sandbox → components → runner), and how new versions ship
   through the app branch. Config-plane facts come from the generated
   config data, so they cannot drift from the repo's TOMLs.
   ============================================================ */

/* ---------- header facts ---------- */

function Fact({
  label,
  value,
  href,
  external = false,
}: {
  label: string
  value?: string
  href?: string
  external?: boolean
}) {
  if (!value) return null
  const body = (
    <>
      <div className="fact__label">{label}</div>
      <div className="fact__value mono">{value}</div>
      {href && (
        <span className="fact__go" aria-hidden="true">
          <Icon name="arrow-up-right" />
        </span>
      )}
    </>
  )
  return href ? (
    <a
      className="fact fact--link"
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {body}
    </a>
  ) : (
    <div className="fact">{body}</div>
  )
}

/* ---------- how it got here: the golden-path diagram, static ---------- */

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

function HowItGotHere() {
  return (
    <div className="arch">
      <div className="arch__sandbox">
        <span className="arch__boundary arch__boundary--static">
          <span className="arch__num">01</span>
          <span className="arch__name">Sandbox</span>
          <span className="arch__hint">VPC · EKS · DNS</span>
        </span>
        <div className="arch__nodes">
          <button
            type="button"
            className="arch__node"
            onClick={() => scrollTo('components')}
          >
            <span className="arch__num">02</span>
            <span className="arch__name">Components</span>
            <span className="arch__hint">engine · db · bucket · UI</span>
          </button>
          <div className="arch__edge" aria-hidden="true">
            <span className="arch__edge-label">deploys</span>
            <span className="arch__edge-line" />
          </div>
          <button
            type="button"
            className="arch__node"
            onClick={() => scrollTo('shipping')}
          >
            <span className="arch__num">03</span>
            <span className="arch__name">Runner</span>
            <span className="arch__hint">builds &amp; deploys here</span>
          </button>
        </div>
      </div>
      <ul className="archnotes">
        <li>
          <span className="mono">sandbox</span> — the footprint Nuon creates in
          this account; everything Conduit does happens inside it.
        </li>
        <li>
          <span className="mono">components</span> — one component is one
          deployable piece of the product, each a small TOML file in the repo.
        </li>
        <li>
          <span className="mono">runner</span> — an agent inside the account
          that runs every build, deploy, runbook, and action; no inbound
          access, and credentials never leave the cloud.
        </li>
      </ul>
    </div>
  )
}

/* ---------- the components table ---------- */

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

const complianceToml = toggleableComponents.find(
  (c) => c.name === 'compliance_export',
)?.toml

interface CompRow {
  name: string
  type: string
  /** What this component runs or provides, one line. */
  runs: string
  /** Where its work is visible, live, in this app. */
  evidence?: { label: string; href: string }
  /** The open row's detail. */
  what?: string
  file?: string
  toml?: string
}

/** In deploy order: images first (nothing to wait for), then the pieces the
    chart interpolates, the chart, its dependents, and the toggleable. */
const componentRows: CompRow[] = [
  {
    name: 'img_api · img_ui · img_premium_connector',
    type: 'container_image',
    runs: 'prebuilt images Nuon pulls; CI stamps the pinned tags',
    what:
      'CI builds img_api (the API and the sync engine, one image) and img_ui (this page) from this repo and publishes them to a public ECR gallery; Nuon only pulls the tag the config pins. img_premium_connector is the private-registry variant, pulled with an IAM role Nuon assumes — the shape a paid connector distribution takes.',
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
    name: 'destination_bucket',
    type: 'pulumi',
    runs: 'the S3 bucket syncs land in + the IRSA role the engine writes with',
    evidence: { label: 'live keys in Destinations', href: '#/destinations' },
    what:
      'A Pulumi program in Go: the bucket, the IAM role, and the trust between them — no access key exists anywhere. Its outputs flow onward: the chart interpolates the bucket name into the engine’s environment, which is how the engine knows where to write.',
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
    name: 'certificate',
    type: 'terraform_module',
    runs: 'a DNS-validated wildcard ACM certificate for *.<install domain>',
    what:
      'A Terraform module the runner executes — it holds the state and the credentials, so the customer keeps both. The load balancer terminates HTTPS with this certificate.',
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
    name: 'conduit',
    type: 'helm_chart',
    runs: 'engine · postgres · api · this UI',
    evidence: { label: 'pods in System', href: '#/system/namespace' },
    what:
      'One chart, four deployments. Nuon interpolates the values file first, so image tags and other components’ outputs are filled in per install.',
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
    name: 'application_load_balancer',
    type: 'helm_chart',
    runs: 'the public HTTPS entry to this UI',
    what:
      'The internet-facing ALB in front of the UI, with the ACM certificate attached. Its health probe watches the public endpoint — the same URL the pipeline-health-sweep runbook checks.',
    file: 'components/alb.toml',
    toml: `name         = "application_load_balancer"
type         = "helm_chart"
chart_name   = "application-load-balancer"
dependencies = ["certificate", "conduit"]

[public_repo]
repo      = "nuonco/kitchen-sink"
directory = "src/components/alb"
branch    = "ms/theme-conduit"

[values]
domain_certificate = "{{.nuon.components.certificate.outputs.public_domain_certificate_arn}}"
domain             = "app.{{.nuon.install.sandbox.outputs.nuon_dns.public_domain.name}}"
service_name       = "conduit-ui"

[[health.probes]]
type = "http"
url  = "https://app.{{.nuon.install.sandbox.outputs.nuon_dns.public_domain.name}}/livez"`,
  },
  {
    name: 'compliance_export',
    type: 'kubernetes_manifest',
    runs: 'the Enterprise export destination — toggleable = true',
    evidence: { label: 'entitlement in Destinations', href: '#/destinations' },
    what:
      'A kustomize overlay deployed only where the toggle is on: the per-install entitlement mechanic. Flip it in the dashboard and watch the Destinations page notice.',
    file: 'components/compliance_export.toml',
    toml: complianceToml ?? '',
  },
]

function ComponentsTable({ podChip }: { podChip?: string }) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="typelist">
      {componentRows.map((c) => {
        const isOpen = open === c.name
        return (
          <div className={isOpen ? 'typerow typerow--open' : 'typerow'} key={c.name}>
            <button
              className="typerow__head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : c.name)}
            >
              <span className="typerow__type mono">{c.name}</span>
              <span className="typerow__purpose">
                {c.runs}
                {c.name === 'conduit' && podChip && (
                  <span className="chip typerow__chip">{podChip}</span>
                )}
              </span>
              <span className="typerow__uses mono">{c.type}</span>
              <span className="typerow__caret" aria-hidden="true">
                <Icon name="caret-right" />
              </span>
            </button>
            {isOpen && (
              <div className="typerow__body">
                {c.what && <p className="typerow__what">{c.what}</p>}
                {c.evidence && (
                  <p className="typerow__here">
                    <strong>See it live:</strong>{' '}
                    <a href={c.evidence.href}>{c.evidence.label}</a>
                  </p>
                )}
                {c.file && c.toml && <FileCode file={c.file} code={c.toml} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- shipping ---------- */

const groupNotes: Record<string, string> = {
  staging: 'use_for_previews: PR preview plans run here',
  customers: 'the production fleet',
  enterprise: 'the installs with change windows',
}

function Shipping({ config }: { config: UIConfig }) {
  const install = config.install_id ?? '<your-install-id>'
  const app = config.app_id ?? '<your-app-id>'
  const prompt = proofPrompts.branches(install, app)

  return (
    <Section id="shipping" title="Shipping" aside="branch.toml · [[install_groups]]">
      <p className="small muted" style={{ maxWidth: '72ch', marginBottom: 16 }}>
        Every push to <span className="mono">{branchName}</span> builds the
        config at that commit and rolls it across these groups in order. Each
        group&rsquo;s plan holds for a human approval, and the{' '}
        <span className="mono">pipeline-health-sweep</span> runbook runs on
        every install after its group deploys.
      </p>
      <div className="groups">
        {installGroups.map((group) => (
          <div key={group.name} className="group-card">
            <div className="group-card__head">
              <span className="arch__num">0{group.order}</span>
              <span className="group-card__name">{group.name}</span>
            </div>
            <div className="group-card__selector mono">{group.selector}</div>
            <div className="group-card__note">
              {groupNotes[group.name] ??
                (group.preview ? 'PR preview plans run here' : '')}
            </div>
          </div>
        ))}
      </div>
      <CodeBlock
        label="branch.toml (the real config, comments stripped)"
        code={branchConfigAbridged}
      />

      <div style={{ marginTop: 24 }}>
        <Tracks
          agent={
            <div className="agent-prompt proof-prompt">
              <div className="cmd__head">
                <span className="cmd__label">the prompt, your ids filled in</span>
                <CopyButton text={prompt} />
              </div>
              <pre className="cmd__pre agent-prompt__pre proof-prompt__pre">
                {prompt}
              </pre>
            </div>
          }
          manual={
            <CommandBlock
              label="edit any file in your clone, then sync and trigger the run"
              command={`nuon sync --app-id ${app} --force --branch ${branchName}`}
              note={
                <>
                  Syncs your local files exactly as they are (even uncommitted,
                  no push) and triggers a real branch run through the groups
                  above. <span className="mono">--preview</span> plans every
                  group with nothing applied.
                </>
              }
            />
          }
        />
      </div>

      <p className="small muted" style={{ marginTop: 16, maxWidth: '72ch' }}>
        Each group&rsquo;s approval is a person in the dashboard; there is
        deliberately no CLI command for it.{' '}
        {config.links.branches && (
          <OutLink href={config.links.branches} variant="plain">
            Watch the run and approve each group
          </OutLink>
        )}
      </p>
      <p className="small muted" style={{ marginTop: 12, maxWidth: '72ch' }}>
        Rolling back: there is no CLI command yet. Re-deploy a previous
        version from the dashboard&rsquo;s version history (plan first), or
        revert the commit and let the same staged rollout replay.{' '}
        {config.links.versions && (
          <OutLink href={config.links.versions} variant="plain">
            Version history &middot; rollback
          </OutLink>
        )}
      </p>
    </Section>
  )
}

/* ---------- the page ---------- */

export function Deployment({ config }: { config: UIConfig }) {
  const namespace = config.namespace ?? 'conduit'
  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    20_000,
    true,
  )
  const pods = ns.state === 'ok' ? (ns.value.response.pods ?? []) : undefined
  const podChip = pods ? `${countReady(pods)} of ${pods.length} pods ready` : undefined

  return (
    <>
      <header className="page-header page-header--slim">
        <h1>Deployment</h1>
      </header>

      <div className="facts" style={{ marginTop: 0 }}>
        <Fact
          label="Install"
          value={config.install_id}
          href={config.links.install}
          external
        />
        <Fact label="Cluster" value={config.cluster_name} />
        <Fact label="Region" value={config.region} />
        <Fact label="Namespace" value={config.namespace} />
      </div>

      <Section title="How it got here">
        <HowItGotHere />
      </Section>

      <Section
        id="components"
        title="Components"
        aside="components/*.toml · in deploy order"
      >
        <ComponentsTable podChip={podChip} />
        {config.links.components && (
          <div className="row" style={{ marginTop: 24 }}>
            <OutLink href={config.links.components}>
              See every component for this install
            </OutLink>
          </div>
        )}
      </Section>

      <Shipping config={config} />
    </>
  )
}
