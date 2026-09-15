import type { ReactNode } from 'react'
import { APP_WORKLOADS, type PodSummary } from '../lib/api'
import { caseBranch, type CaseId } from '../lib/cases'
import { branchName, components, guardrails, installConfigs, stack } from '../lib/config-data.gen'
import { navigate } from '../lib/router'

/* ============================================================
   Home's account diagram: this install, drawn from what the browser can
   read. Pods and namespace come from the introspection API; the install
   id and VPC id from /api/ui-config; the boxes from this repo's config.
   The two quoted facts about the runner and the control plane come from
   docs.nuon.co/security and the runner architecture post (see
   byoc-requirements-research-2026-09-14.md, section B).
   ============================================================ */

const T = {
  primary: '#f7f7f7',
  secondary: '#b6c2c7',
  tertiary: '#7c8b91',
  accent: '#4cc9f0',
  negative: '#fda29b',
  card: '#0b1215',
  raised: '#10191d',
  sunken: '#050c0f',
  border: 'rgba(255,255,255,0.2)',
  borderSubtle: 'rgba(255,255,255,0.12)',
  sans: 'Inter, sans-serif',
  mono: 'Hack, ui-monospace, SF Mono, Menlo, monospace',
}

const hasChart = components.some((c) => c.name === 'kitchen_sink')
const hasRDS = stack.customNestedStacks.some((s) => s.name.startsWith('rds'))
const hasS3 = components.some((c) => c.name === 'pulumi_infra')

function Callout({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <>
      <circle cx={x} cy={y} r="9" fill={T.accent} />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontFamily={T.mono}
        fontSize="10.5"
        fontWeight="600"
        fill="#020708"
      >
        {n}
      </text>
    </>
  )
}

/** A callout that also acts as the request's hover target and link. */
function HotCallout({
  x,
  y,
  n,
  id,
  onFocus,
}: {
  x: number
  y: number
  n: number
  id: CaseId
  onFocus?: (id: CaseId | null) => void
}) {
  return (
    <g
      className="hd__hit"
      role="link"
      tabIndex={0}
      aria-label={`request ${n}`}
      onMouseEnter={() => onFocus?.(id)}
      onMouseLeave={() => onFocus?.(null)}
      onFocus={() => onFocus?.(id)}
      onBlur={() => onFocus?.(null)}
      onClick={() => navigate(`/cases/${id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/cases/${id}`)
        }
      }}
    >
      <circle cx={x} cy={y} r="15" fill="transparent" />
      <Callout x={x} y={y} n={n} />
    </g>
  )
}

function Crossed({
  x1,
  x2,
  y,
  label,
  labelX,
  wrap = false,
}: {
  x1: number
  x2: number
  y: number
  label: string
  labelX?: number
  /** Break the label at its spaces, one word per line, for narrow gaps. */
  wrap?: boolean
}) {
  const mid = (x1 + x2) / 2 + 6
  const lx = labelX ?? mid - 26
  return (
    <>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="rgba(253,162,155,0.7)" strokeWidth="2" strokeDasharray="5 4" />
      <g transform={`translate(${mid} ${y})`} stroke={T.negative} strokeWidth="2">
        <line x1="-5" y1="-5" x2="5" y2="5" />
        <line x1="-5" y1="5" x2="5" y2="-5" />
      </g>
      <text x={lx} y={y + 18} textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.negative}>
        {wrap
          ? label.split(' ').map((word, i) => (
              <tspan key={word} x={lx} dy={i === 0 ? 0 : 12}>
                {word}
              </tspan>
            ))
          : label}
      </text>
    </>
  )
}

/** A group of the account picture that lights up for the requests in
    `cases` and dims for the others while one is hovered. */
function Part({
  cases,
  focus,
  children,
}: {
  cases: CaseId[]
  focus: CaseId | null
  children: ReactNode
}) {
  const cls = focus === null ? 'hd' : cases.includes(focus) ? 'hd hd--lit' : 'hd hd--dim'
  return <g className={cls}>{children}</g>
}

export function AccountDiagram({
  pods,
  namespace,
  installId,
  vpcId,
  focus = null,
  onFocus,
}: {
  pods: PodSummary[]
  namespace: string
  installId?: string
  vpcId?: string
  /** The request whose difference is lit; null shows the install as it is. */
  focus?: CaseId | null
  onFocus?: (id: CaseId | null) => void
}) {
  const present = APP_WORKLOADS.filter((w) =>
    pods.some((p) => (p.metadata?.name ?? '').startsWith(w)),
  ).map((w) => w.replace(/^kitchen-sink-/, ''))
  const others = pods.filter(
    (p) => !APP_WORKLOADS.some((w) => (p.metadata?.name ?? '').startsWith(w)),
  ).length
  const chips = [...present, ...(others > 0 ? [`+${others}`] : [])]
  const label = [
    'One customer AWS account holding one install',
    installId ? ` (${installId})` : '',
    '. Inside its VPC',
    vpcId ? ` ${vpcId}` : '',
    `: a runner, an EKS cluster running ${pods.length} pod${pods.length === 1 ? '' : 's'} in ${namespace}`,
    hasRDS ? ', RDS' : '',
    hasS3 ? ', S3' : '',
    '. The runner’s connection to the Nuon control plane is outbound only; the control plane opens no connection into the account.',
  ].join('')
  const vpcLabel =
    focus === 'byo-vpc'
      ? 'THEIR VPC · their subnets · their NAT'
      : vpcId
        ? `VPC · ${vpcId}`
        : `VPC · ${stack.vpcTemplate.path} (stack.toml @ ${branchName})`
  const accountLabel = focus === 'single-tenant' ? 'ACCOUNT PER CUSTOMER' : 'CUSTOMER AWS ACCOUNT'

  return (
    <svg viewBox="0 0 614 290" className="home__diagram" role="img" aria-label={label} data-focus={focus ?? undefined}>
      <defs>
        <marker id="home-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={T.accent} />
        </marker>
      </defs>

      {/* Nuon control plane */}
      <Part cases={['single-tenant']} focus={focus}>
        <rect x="0" y="92" width="160" height="100" rx="8" fill={T.raised} stroke={T.border} strokeWidth="1.5" />
        <text x="14" y="116" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
          Nuon control plane
        </text>
        <text x="14" y="136" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
          app · branches · plans
        </text>
        <text x="14" y="154" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
          no credentials
        </text>
        <text x="14" y="170" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
          to this account
        </text>
      </Part>

      {/* customer account */}
      <Part cases={['single-tenant']} focus={focus}>
        <rect x="226" y="4" width="386" height="282" rx="10" fill={T.sunken} stroke={T.border} strokeWidth="1.5" />
        <text x="242" y="26" fontFamily={T.mono} fontSize="10.5" letterSpacing="0.08em" fill={focus === 'single-tenant' ? T.accent : T.tertiary}>
          {accountLabel}
        </text>
        <rect x="440" y="12" width="162" height="22" rx="6" fill={T.raised} stroke={T.borderSubtle} />
        <text x="521" y="27" textAnchor="middle" fontFamily={T.mono} fontSize="9.5" fill={T.secondary}>
          {installId ?? '1 install'}
        </text>
      </Part>

      {/* their VPC */}
      <Part cases={['byo-vpc']} focus={focus}>
        <rect x="242" y="48" width="354" height="224" rx="8" fill="none" stroke={T.borderSubtle} strokeDasharray="4 4" />
        <text x="276" y="66" fontFamily={T.mono} fontSize="10.5" fill={focus === 'byo-vpc' ? T.accent : T.secondary}>
          {vpcLabel}
        </text>
      </Part>

      {/* runner */}
      <Part cases={['no-egress']} focus={focus}>
        <rect x="258" y="84" width="112" height="52" rx="6" fill={T.card} stroke={T.accent} strokeWidth="1.5" />
        <text x="314" y="106" textAnchor="middle" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
          runner
        </text>
        <text x="314" y="124" textAnchor="middle" fontFamily={T.mono} fontSize="9.5" fill={T.tertiary}>
          pull only · HTTPS
        </text>
      </Part>

      {/* EKS */}
      <Part cases={['no-egress']} focus={focus}>
        <rect x="384" y="84" width="196" height="96" rx="6" fill={T.card} stroke={T.border} />
        <text x="398" y="104" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
          EKS
        </text>
        <text x="428" y="104" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
          {namespace}
        </text>
        {chips.length === 0 ? (
          <text x="398" y="133" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
            reading pods…
          </text>
        ) : (
          chips.slice(0, 3).map((chip, i) => (
            <g key={chip}>
              <rect x={398 + i * 58} y="118" width="52" height="22" rx="4" fill={T.raised} stroke={T.borderSubtle} />
              <text x={424 + i * 58} y="133" textAnchor="middle" fontFamily={T.mono} fontSize="10" fill={T.secondary}>
                {chip}
              </text>
            </g>
          ))
        )}
        <text x="482" y="166" textAnchor="middle" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
          {hasChart ? `helm · kitchen_sink · ${pods.length} pod${pods.length === 1 ? '' : 's'}` : `${pods.length} pods`}
        </text>
      </Part>

      {/* ALB · RDS · S3 */}
      <Part cases={[]} focus={focus}>
        <rect x="258" y="200" width="112" height="52" rx="6" fill={T.card} stroke={T.border} />
        <text x="314" y="222" textAnchor="middle" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
          ALB
        </text>
        <text x="314" y="240" textAnchor="middle" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
          public HTTPS
        </text>
        {hasRDS && (
          <>
            <rect x="384" y="200" width="92" height="52" rx="6" fill={T.card} stroke={T.border} />
            <text x="430" y="226" textAnchor="middle" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
              RDS
            </text>
            <text x="430" y="242" textAnchor="middle" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
              stack.toml
            </text>
          </>
        )}
        {hasS3 && (
          <>
            <rect x="488" y="200" width="92" height="52" rx="6" fill={T.card} stroke={T.border} />
            <text x="534" y="226" textAnchor="middle" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
              S3
            </text>
            <text x="534" y="242" textAnchor="middle" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
              pulumi_infra
            </text>
          </>
        )}
      </Part>

      {/* 1: the runner pulls; nothing comes in */}
      <Part cases={['no-egress']} focus={focus}>
        <path d="M 258 106 H 163" stroke={T.accent} strokeWidth="2.5" fill="none" markerEnd="url(#home-arrow)" />
        <text x="193" y="80" textAnchor="middle" fontFamily={T.mono} fontSize="10" fill={T.accent}>
          outbound
        </text>
        <text x="193" y="92" textAnchor="middle" fontFamily={T.mono} fontSize="10" fill={T.accent}>
          only
        </text>
        <Crossed x1={160} x2={226} y={176} label="no inbound" labelX={193} wrap />
      </Part>

      {/* the three callouts, each a hover target and a link to its request */}
      <HotCallout x={193} y={106} n={1} id="no-egress" onFocus={onFocus} />
      <HotCallout x={258} y={62} n={2} id="byo-vpc" onFocus={onFocus} />
      <HotCallout x={424} y={23} n={3} id="single-tenant" onFocus={onFocus} />
    </svg>
  )
}

/* ============================================================
   The three case diagrams: pictures of what each branch changes, drawn
   from that branch's diff (case-deltas.gen.ts) and this repo's config. No
   live ids here; the branch is not this install.
   ============================================================ */

/** NAT gateways each published VPC template creates, read from the
    templates themselves (nuon-artifacts, v0.4.0). */
const natGateways: Record<string, string> = {
  'vpc/eks/default': '1 NAT gateway',
  'vpc/eks/multi-nat': '3 NAT gateways',
}

function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  sub2,
  accent = false,
  dashed = false,
}: {
  x: number
  y: number
  w: number
  h: number
  title: string
  sub?: string
  sub2?: string
  accent?: boolean
  dashed?: boolean
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="6"
        fill={dashed ? 'none' : T.card}
        stroke={accent ? T.accent : dashed ? T.borderSubtle : T.border}
        strokeWidth={accent ? 2 : 1}
        strokeDasharray={dashed ? '4 4' : undefined}
      />
      <text
        x={x + w / 2}
        y={y + (sub ? 26 : h / 2 + 5)}
        textAnchor="middle"
        fontFamily={T.sans}
        fontSize="14"
        fontWeight="500"
        fill={dashed ? T.tertiary : T.primary}
      >
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + 46} textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
          {sub}
        </text>
      )}
      {sub2 && (
        <text x={x + w / 2} y={y + 62} textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
          {sub2}
        </text>
      )}
    </>
  )
}

function Chip({ x, y, w, text }: { x: number; y: number; w: number; text: string }) {
  return (
    <>
      <rect x={x} y={y} width={w} height="26" rx="4" fill={T.raised} stroke={T.borderSubtle} />
      <text x={x + w / 2} y={y + 17} textAnchor="middle" fontFamily={T.mono} fontSize="11" fill={T.secondary}>
        {text}
      </text>
    </>
  )
}

export function NoEgressDiagram() {
  const images = components.filter((c) => c.type === 'container_image').length
  const addedPolicies = (caseBranch('no-egress')?.files ?? [])
    .filter((f) => f.status === 'A' && /^policies\/.*\.rego$/.test(f.path))
    .map((f) => f.path.replace(/^policies\//, '').replace(/\.rego$/, ''))
  const sandboxPolicies = guardrails.filter((g) => g.type === 'sandbox').map((g) => g.name)
  const nat = natGateways[stack.vpcTemplate.path]
  const label = [
    'One customer AWS account.',
    ` Its VPC comes from the ${stack.vpcTemplate.path} template${nat ? `, which creates ${nat}` : ''}.`,
    ' The runner\u2019s connection to the Nuon control plane is outbound only; the control plane opens no connection into the account.',
    ' The EKS API endpoint is private.',
    ` ${images} container images are synced into a registry in the account when released.`,
    ` The sandbox plan is checked by ${sandboxPolicies.length + addedPolicies.length} OPA policies, including ${addedPolicies.join(', ')} from this branch.`,
  ].join('')
  return (
    <svg viewBox="0 0 592 400" className="casediagram" role="img" aria-label={label}>
      <defs>
        <marker id="case-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={T.accent} />
        </marker>
      </defs>
      <rect x="0" y="96" width="136" height="88" rx="8" fill={T.raised} stroke={T.border} strokeWidth="1.5" />
      <text x="10" y="124" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
        Nuon control plane
      </text>
      <text x="10" y="146" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        plans · approvals
      </text>
      <text x="10" y="164" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        1 API · HTTPS
      </text>

      <rect x="216" y="0" width="376" height="400" rx="10" fill={T.sunken} stroke={T.border} strokeWidth="1.5" />
      <text x="232" y="24" fontFamily={T.mono} fontSize="10.5" letterSpacing="0.08em" fill={T.tertiary}>
        CUSTOMER AWS ACCOUNT
      </text>
      <rect x="232" y="44" width="344" height="340" rx="8" fill="none" stroke={T.borderSubtle} strokeDasharray="4 4" />
      <text x="246" y="64" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        VPC · {stack.vpcTemplate.path}
        {nat ? ` · ${nat}` : ''}
      </text>

      <Box x={252} y={84} w={140} h={76} title="runner" sub="pull · plan · apply" accent />
      <Box x={412} y={84} w={148} h={76} title="EKS" sub="kitchen_sink" sub2="private API endpoint" />

      <rect x="252" y="180" width="308" height="64" rx="6" fill={T.card} stroke={T.border} />
      <text x="270" y="204" fontFamily={T.sans} fontSize="14" fontWeight="500" fill={T.primary}>
        ECR
      </text>
      <text x="270" y="222" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        {images} images synced in at release
      </text>
      <text x="270" y="237" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        pulled in-account
      </text>

      <rect x="252" y="258" width="308" height="110" rx="6" fill={T.card} stroke={T.border} />
      <text x="270" y="284" fontFamily={T.sans} fontSize="14" fontWeight="500" fill={T.primary}>
        OPA
      </text>
      <text x="542" y="284" textAnchor="end" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        on the sandbox plan
      </text>
      {(() => {
        // First chip on its own row, the next two side by side, each as wide
        // as its text; the third starts after the second's real width.
        const names = [...addedPolicies.map((n) => `+ ${n}`), ...sandboxPolicies].slice(0, 3)
        const widths = names.map((n) => Math.min(Math.max(n.length * 7 + 16, 80), 270))
        const xs = [270, 270, 270 + (widths[1] ?? 0) + 8]
        const ys = [302, 334, 334]
        return names.map((name, i) => (
          <Chip key={`${name}-chip`} x={xs[i]} y={ys[i]} w={Math.min(widths[i], 542 - xs[i])} text={name} />
        ))
      })()}

      <path d="M 252 106 H 138" stroke={T.accent} strokeWidth="3" fill="none" markerEnd="url(#case-arrow)" />
      <text x="210" y="88" textAnchor="end" fontFamily={T.mono} fontSize="11" fontWeight="600" fill={T.accent}>
        1 outbound rule
      </text>
      <Crossed x1={136} x2={216} y={170} label="no inbound" labelX={176} />
    </svg>
  )
}

/** "byo-vpc/default · v0.4.0" from the branch's stack.toml line, or nothing. */
function byoVpcTemplate(): string | null {
  const plus = caseBranch('byo-vpc')?.files.find((f) => f.path === 'stack.toml')?.plus ?? []
  for (const line of plus) {
    const m = /aws-cloudformation-templates\/(v[\d.]+)\/(.+?)\/stack\.yaml/.exec(line)
    if (m) return `${m[2]} · ${m[1]}`
  }
  return null
}

const quickCreateParams = ['VpcID', 'PublicSubnetIDs', 'PrivateSubnetIDs', 'RunnerSubnetID']
const subnetTags = ['install.nuon.co/id', 'network.nuon.co/domain', 'visibility']

export function ByoVpcDiagram() {
  const template = byoVpcTemplate()
  const label = `The customer enters ${quickCreateParams.length} Quick Create parameters (${quickCreateParams.join(', ')}). The runner and the cluster land inside their VPC, in their subnets, behind their routes and NAT. Nuon creates no VPC. The sandbox selects subnets by ${subnetTags.length} tags: ${subnetTags.join(', ')}.`
  return (
    <svg viewBox="0 0 592 400" className="casediagram" role="img" aria-label={label}>
      <defs>
        <marker id="case-arrow-b" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={T.accent} />
        </marker>
      </defs>
      <rect x="0" y="52" width="150" height="128" rx="8" fill={T.raised} stroke={T.border} strokeWidth="1.5" />
      <text x="16" y="78" fontFamily={T.sans} fontSize="13" fontWeight="500" fill={T.primary}>
        Quick Create form
      </text>
      {quickCreateParams.map((p, i) => (
        <text key={p} x="16" y={100 + i * 18} fontFamily={T.mono} fontSize="10.5" fill={T.secondary}>
          {p}
        </text>
      ))}
      <path d="M 150 116 H 214" stroke={T.accent} strokeWidth="3" fill="none" markerEnd="url(#case-arrow-b)" />

      <text x="0" y="300" fontFamily={T.mono} fontSize="10.5" fill={T.secondary}>
        Nuon creates
      </text>
      <text x="0" y="330" fontFamily={T.sans} fontSize="22" fontWeight="600" fill={T.primary}>
        0 VPCs
      </text>
      {template && (
        <text x="0" y="352" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
          {template}
        </text>
      )}

      <rect x="216" y="0" width="376" height="400" rx="10" fill={T.sunken} stroke={T.border} strokeWidth="1.5" />
      <text x="232" y="24" fontFamily={T.mono} fontSize="10.5" letterSpacing="0.08em" fill={T.tertiary}>
        CUSTOMER AWS ACCOUNT
      </text>
      <rect x="232" y="44" width="344" height="340" rx="8" fill="none" stroke={T.accent} strokeDasharray="4 4" />
      <text x="246" y="64" fontFamily={T.mono} fontSize="10.5" fill={T.accent}>
        THEIR VPC · their subnets
      </text>

      <Box x={252} y={84} w={140} h={64} title="runner" sub="their runner subnet" accent />
      <Box x={412} y={84} w={148} h={64} title="EKS · RDS" sub="their private subnets" />
      <rect x="252" y="172" width="308" height="56" rx="6" fill="none" stroke={T.borderSubtle} strokeDasharray="4 4" />
      <text x="406" y="196" textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        their routes · their NAT · their firewall
      </text>
      <text x="406" y="214" textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        the runner subnet needs outbound access
      </text>

      <rect x="252" y="252" width="308" height="118" rx="6" fill={T.card} stroke={T.border} />
      <text x="270" y="278" fontFamily={T.sans} fontSize="14" fontWeight="500" fill={T.primary}>
        Subnet tags
      </text>
      <text x="542" y="278" textAnchor="end" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        the sandbox selects by
      </text>
      <Chip x={270} y={296} w={130} text={subnetTags[0]} />
      <Chip x={270} y={328} w={160} text={subnetTags[1]} />
      <Chip x={438} y={328} w={90} text={subnetTags[2]} />
    </svg>
  )
}

export function SingleTenantDiagram() {
  const n = Math.max(installConfigs.length, 1)
  const rowH = 400 / n
  const boxH = rowH - 16
  const innerH = Math.max(rowH - 66, 30)
  const twoLines = innerH >= 48
  // Each row's arrow meets the row's box at its vertical centre; the trunk
  // runs from the first to the last of those, and "you" sits at their middle.
  const mids = installConfigs.map((_, i) => 8 + i * rowH + boxH / 2)
  const centerY = mids.length > 0 ? (mids[0] + mids[mids.length - 1]) / 2 : 200
  const youH = 140
  const youY = centerY - youH / 2
  const label = `${installConfigs.length} install configs, one AWS account each (${installConfigs.map((c) => `${c.name} in ${c.region ?? 'an unset region'}`).join(', ')}), each running one install of kitchen_sink. The vendor operates all of them through runbooks and actions on each install's runner, with no ssh, no kubeconfig and no credentials handed out.`
  return (
    <svg viewBox="0 0 592 400" className="casediagram" role="img" aria-label={label}>
      <defs>
        <marker id="case-arrow-c" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={T.accent} />
        </marker>
      </defs>
      <rect x="0" y={youY} width="168" height={youH} rx="8" fill={T.raised} stroke={T.border} strokeWidth="1.5" />
      <text x="84" y={centerY - 42} textAnchor="middle" fontFamily={T.sans} fontSize="14" fontWeight="500" fill={T.primary}>
        you
      </text>
      <text x="84" y={centerY - 20} textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.secondary}>
        runbooks · actions
      </text>
      <text x="84" y={centerY + 18} textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.negative}>
        no ssh · no kubeconfig
      </text>
      <text x="84" y={centerY + 36} textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.negative}>
        no credentials handed out
      </text>
      <line x1="168" y1={centerY} x2="190" y2={centerY} stroke={T.accent} strokeWidth="2" />
      {mids.length > 1 && (
        <line x1="190" y1={mids[0]} x2="190" y2={mids[mids.length - 1]} stroke={T.accent} strokeWidth="2" />
      )}
      {installConfigs.map((c, i) => {
        const y = 8 + i * rowH
        const midY = mids[i]
        const innerY = y + 34
        return (
          <g key={c.name}>
            <path d={`M 190 ${midY} H 214`} stroke={T.accent} strokeWidth="2" fill="none" markerEnd="url(#case-arrow-c)" />
            <rect x="216" y={y} width="376" height={boxH} rx="8" fill={T.sunken} stroke={T.border} strokeWidth="1.5" />
            <text x="232" y={y + 22} fontFamily={T.mono} fontSize="10.5" letterSpacing="0.08em" fill={T.tertiary}>
              {c.name.toUpperCase()} · 1 AWS ACCOUNT{c.region ? ` · ${c.region.toUpperCase()}` : ''}
            </text>
            <rect x="232" y={innerY} width="344" height={innerH} rx="5" fill={T.card} stroke={T.border} />
            {twoLines ? (
              <>
                <text x="404" y={innerY + innerH / 2 - 4} textAnchor="middle" fontFamily={T.mono} fontSize="11" fill={T.secondary}>
                  1 install · kitchen_sink
                </text>
                <text x="404" y={innerY + innerH / 2 + 12} textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
                  {c.file}
                </text>
              </>
            ) : (
              <text x="404" y={innerY + innerH / 2 + 4} textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.secondary}>
                1 install · {c.file}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function CaseDiagram({ branch }: { branch: string }) {
  if (branch === 'no-egress') return <NoEgressDiagram />
  if (branch === 'byo-vpc') return <ByoVpcDiagram />
  if (branch === 'single-tenant') return <SingleTenantDiagram />
  return null
}
