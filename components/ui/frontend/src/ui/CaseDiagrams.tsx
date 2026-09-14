import { APP_WORKLOADS, type PodSummary } from '../lib/api'
import { components, stack } from '../lib/config-data.gen'

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

function Crossed({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  const mid = (x1 + x2) / 2 + 6
  return (
    <>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="rgba(253,162,155,0.7)" strokeWidth="2" strokeDasharray="5 4" />
      <g transform={`translate(${mid} ${y})`} stroke={T.negative} strokeWidth="2">
        <line x1="-5" y1="-5" x2="5" y2="5" />
        <line x1="-5" y1="5" x2="5" y2="-5" />
      </g>
      <text x={mid - 26} y={y + 20} textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.negative}>
        {label}
      </text>
    </>
  )
}

export function AccountDiagram({
  pods,
  namespace,
  installId,
  vpcId,
}: {
  pods: PodSummary[]
  namespace: string
  installId?: string
  vpcId?: string
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
    `: a runner, an EKS cluster running ${present.length} pod${present.length === 1 ? '' : 's'} in ${namespace}`,
    hasRDS ? ', RDS' : '',
    hasS3 ? ', S3' : '',
    '. The runner makes the only outbound connection, to the Nuon control plane; nothing comes in.',
  ].join('')

  return (
    <svg viewBox="0 0 612 290" className="home__diagram" role="img" aria-label={label}>
      <defs>
        <marker id="home-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={T.accent} />
        </marker>
      </defs>

      {/* Nuon control plane */}
      <rect x="0" y="100" width="140" height="96" rx="8" fill={T.raised} stroke={T.border} strokeWidth="1.5" />
      <text x="16" y="126" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
        Nuon control plane
      </text>
      <text x="16" y="146" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        app · branches · plans
      </text>
      <text x="16" y="162" fontFamily={T.mono} fontSize="10.5" fill={T.tertiary}>
        no credentials to this account
      </text>

      {/* customer account */}
      <rect x="226" y="4" width="386" height="282" rx="10" fill={T.sunken} stroke={T.border} strokeWidth="1.5" />
      <text x="242" y="26" fontFamily={T.mono} fontSize="10.5" letterSpacing="0.08em" fill={T.tertiary}>
        CUSTOMER AWS ACCOUNT
      </text>
      <rect x="392" y="12" width="210" height="22" rx="6" fill={T.raised} stroke={T.borderSubtle} />
      <text x="497" y="27" textAnchor="middle" fontFamily={T.mono} fontSize="9" fill={T.secondary}>
        {installId ? `1 install · ${installId}` : '1 install'}
      </text>
      <Callout x={392} y={12} n={3} />

      {/* their VPC */}
      <rect x="242" y="48" width="354" height="224" rx="8" fill="none" stroke={T.borderSubtle} strokeDasharray="4 4" />
      <text x="262" y="66" fontFamily={T.mono} fontSize="10.5" fill={T.secondary}>
        {vpcId ? `VPC · ${vpcId}` : `VPC · ${stack.vpcTemplate.path}`}
      </text>
      <Callout x={242} y={48} n={2} />

      {/* runner */}
      <rect x="258" y="84" width="104" height="52" rx="6" fill={T.card} stroke={T.accent} strokeWidth="1.5" />
      <text x="310" y="106" textAnchor="middle" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
        runner
      </text>
      <text x="310" y="124" textAnchor="middle" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
        pull only · HTTPS
      </text>

      {/* EKS */}
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

      {/* ALB · RDS · S3 */}
      <rect x="258" y="200" width="104" height="52" rx="6" fill={T.card} stroke={T.border} />
      <text x="310" y="222" textAnchor="middle" fontFamily={T.sans} fontSize="12.5" fontWeight="500" fill={T.primary}>
        ALB
      </text>
      <text x="310" y="240" textAnchor="middle" fontFamily={T.mono} fontSize="10" fill={T.tertiary}>
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

      {/* 1: the runner pulls; nothing comes in */}
      <path d="M 258 106 H 150" stroke={T.accent} strokeWidth="2.5" fill="none" markerEnd="url(#home-arrow)" />
      <text x="204" y="98" textAnchor="middle" fontFamily={T.mono} fontSize="10.5" fill={T.accent}>
        outbound only
      </text>
      <Crossed x1={150} x2={222} y={176} label="no inbound" />
      <Callout x={150} y={106} n={1} />
    </svg>
  )
}
