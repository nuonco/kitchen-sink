import { useEffect, useRef, useState } from 'react'
import {
  countReady,
  type Envelope,
  type KubeResponse,
  type Loadable,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { useNavigate } from '../lib/router'
import { Icon, StatTile } from './Primitives'

/* ============================================================
   The onboarding drawer: the old six-step tour compressed to four panels
   in a right-side sheet. Opens automatically on a first visit over the
   Dashboard; "Getting started" in the sidebar reopens it. It borrows the
   Dashboard's reads — the drawer itself fetches nothing.
   ============================================================ */

const TOUR_KEY = 'kitchen-sink-tour'

/**
 * Whether this browser has been toured. Any stored value other than
 * 'arrive' counts — returning phase-3 visitors resume mid-tour values
 * ('explore', 'deployed', …) and don't get re-toured.
 */
export function tourDone(): boolean {
  try {
    const value = window.localStorage.getItem(TOUR_KEY)
    return value !== null && value !== 'arrive'
  } catch {
    // No storage (private mode): the drawer opens each visit, like the
    // old tour started over.
    return false
  }
}

export function markTourDone() {
  try {
    window.localStorage.setItem(TOUR_KEY, 'done')
  } catch {
    // Without storage the drawer still closes; it just has no memory.
  }
}

/** The golden-path diagram, small and static: no staging, no clicks. */
function GoldenPathMini() {
  return (
    <div className="arch arch--mini" aria-hidden="true">
      <div className="arch__sandbox">
        <span className="arch__boundary arch__boundary--static">
          <span className="arch__name">Sandbox</span>
          <span className="arch__hint">VPC · EKS · DNS</span>
        </span>
        <div className="arch__nodes">
          <span className="arch__node arch__node--static">
            <span className="arch__name">Components</span>
            <span className="arch__hint">periscope chart</span>
          </span>
          <div className="arch__edge">
            <span className="arch__edge-label">deploys</span>
            <span className="arch__edge-line" />
          </div>
          <span className="arch__node arch__node--static">
            <span className="arch__name">Runner</span>
            <span className="arch__hint">builds &amp; deploys here</span>
          </span>
        </div>
      </div>
    </div>
  )
}

const panelTitles = [
  'This is Periscope',
  'Nuon put it here',
  'What got deployed',
  'Where things live',
]

export function OnboardingDrawer({
  open,
  onClose,
  config,
  kube,
  ns,
}: {
  open: boolean
  onClose: () => void
  config: UIConfig
  kube: Loadable<Envelope<KubeResponse>>
  ns: Loadable<Envelope<NamespaceResponse>>
}) {
  const navigate = useNavigate()
  const [panel, setPanel] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  const close = () => {
    markTourDone()
    onClose()
  }

  // Fresh open starts at the first panel and takes focus into the sheet.
  useEffect(() => {
    if (open) {
      setPanel(0)
      sheetRef.current?.focus()
    }
  }, [open])

  // ESC closes; Tab stays inside the sheet while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key !== 'Tab') return
      const sheet = sheetRef.current
      if (!sheet) return
      const focusables = sheet.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === sheet)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const namespace = config.namespace ?? 'periscope'
  const kubeRows =
    kube.state === 'ok' ? (kube.value.response.namespaces ?? []) : undefined
  const nsData = ns.state === 'ok' ? ns.value.response : undefined
  const pods = nsData?.pods ?? []

  const places = [
    { to: '/workloads', label: 'Workloads', line: 'Live reads from the cluster this console runs in.' },
    { to: '/events', label: 'Events', line: 'The namespace’s Kubernetes events, five-second poll.' },
    { to: '/operations', label: 'Operations', line: 'The SOPs, health checks, and break-glass restart.' },
    { to: '/nuon', label: 'Deployed by Nuon', line: 'How this product maps onto components and rolls out.' },
  ]

  return (
    <div className="drawer-root">
      <div className="drawer-scrim" aria-hidden="true" onClick={close} />
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Getting started"
        ref={sheetRef}
        tabIndex={-1}
      >
        <div className="drawer__head">
          <span className="drawer__title">{panelTitles[panel]}</span>
          <button className="drawer__close" aria-label="Close" onClick={close}>
            ×
          </button>
        </div>

        <div className="drawer__body">
          {panel === 0 && (
            <>
              <p className="drawer__lede">
                A read-only console for the cluster it runs in.
                Periscope&rsquo;s job is to show you what runs here;
                Nuon&rsquo;s job was to put it here &mdash; this page is
                served from an EKS cluster Nuon provisioned when you
                installed.
              </p>
              {(config.install_id || config.cluster_name) && (
                <div className="row" style={{ marginTop: 20 }}>
                  {config.install_id && (
                    <span className="chip">install {config.install_id}</span>
                  )}
                  {config.cluster_name && (
                    <span className="chip">cluster {config.cluster_name}</span>
                  )}
                </div>
              )}
            </>
          )}

          {panel === 1 && (
            <>
              <GoldenPathMini />
              <ul className="drawer__lines">
                <li>
                  The sandbox is the footprint Nuon creates in the cloud
                  account: a VPC, an EKS cluster, a public DNS zone.
                </li>
                <li>
                  Components are the product &mdash; the{' '}
                  <span className="mono">periscope</span> chart deploys this
                  console.
                </li>
                <li>
                  The runner builds and deploys from inside the account, so
                  credentials never leave it.
                </li>
              </ul>
            </>
          )}

          {panel === 2 && (
            <div className="drawer__stats">
              <StatTile
                label="Install"
                value={config.install_id}
                note="The tenant this app belongs to"
              />
              <StatTile
                label="Cluster"
                value={config.cluster_name}
                note={config.region ? `EKS in ${config.region}` : 'EKS'}
              />
              <StatTile
                label="Namespaces"
                value={kubeRows ? kubeRows.length : undefined}
                note="Read from the Kubernetes API"
              />
              <StatTile
                label={`Pods ready in ${namespace}`}
                value={nsData ? `${countReady(pods)} of ${pods.length}` : undefined}
                note="api, web, collector"
              />
            </div>
          )}

          {panel === 3 && (
            <div className="drawer__places">
              {places.map((p) => (
                <a
                  key={p.to}
                  className="drawer__place"
                  href={`#${p.to}`}
                  onClick={(e) => {
                    e.preventDefault()
                    close()
                    navigate(p.to)
                  }}
                >
                  <span className="drawer__place-name">{p.label}</span>
                  <span className="drawer__place-line">{p.line}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="drawer__foot">
          <span className="tour__dots">
            {panelTitles.map((t, i) => (
              <button
                key={t}
                type="button"
                className={
                  i === panel
                    ? 'tour__dot tour__dot--active'
                    : i < panel
                      ? 'tour__dot tour__dot--done'
                      : 'tour__dot'
                }
                aria-label={`Panel ${i + 1} of ${panelTitles.length}`}
                {...(i === panel ? { 'aria-current': 'step' as const } : {})}
                onClick={() => setPanel(i)}
              />
            ))}
          </span>
          <span className="topbar__spacer" />
          {panel > 0 && (
            <button className="btn btn--ghost" onClick={() => setPanel(panel - 1)}>
              <Icon name="arrow-left" /> Back
            </button>
          )}
          {panel < panelTitles.length - 1 ? (
            <button className="btn btn--primary" onClick={() => setPanel(panel + 1)}>
              Next <Icon name="arrow-right" />
            </button>
          ) : (
            <>
              <button className="btn btn--secondary" onClick={close}>
                Close
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  close()
                  navigate('/workloads')
                }}
              >
                Start with Workloads <Icon name="arrow-right" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
