import { useEffect, useState } from 'react'
import type { SyncPipeline, UIConfig } from '../lib/api'
import { activeNavItem, navItems } from '../lib/nav'
import { useNavigate } from '../lib/router'
import { Icon, NuonMark, OutLink } from './Primitives'

/* ============================================================
   The product shell's chrome: a persistent sidebar (brand, the product
   pages, the Nuon layer under its own caption, the install in the footer),
   its mobile collapse, and the global paused banner. The pipeline state
   that feeds the nav dot and the banner comes from one shell-level poll of
   /sync/pipelines owned by App.
   ============================================================ */

/** The Conduit mark: two joined squares, drawn from the same 3px-pixel
    vocabulary as nuon.co's arrows. */
function ConduitMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="0" y="3" width="6" height="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="9" y="6" width="6" height="6" fill="currentColor" />
      <rect x="6" y="7" width="3" height="3" fill="currentColor" />
    </svg>
  )
}

/**
 * The Pipelines nav item's status hint: red when a pipeline's last run
 * failed, amber when any pipeline is paused. Chrome-level only — the word
 * for the state lives on the pages themselves.
 */
function pipelinesDot(pipelines: SyncPipeline[]): { cls: string; title: string } | null {
  if (pipelines.some((p) => p.last_run?.status === 'failed')) {
    return { cls: 'sidenav__dot sidenav__dot--failed', title: 'a pipeline’s last run failed' }
  }
  const paused = pipelines.filter((p) => p.paused).length
  if (paused > 0) {
    return {
      cls: 'sidenav__dot sidenav__dot--paused',
      title: `${paused} pipeline${paused === 1 ? '' : 's'} paused`,
    }
  }
  return null
}

function NavList({
  active,
  pipelines,
  onPick,
}: {
  active?: string
  pipelines: SyncPipeline[]
  onPick?: () => void
}) {
  const navigate = useNavigate()
  const dot = pipelinesDot(pipelines)

  const item = (to: string, label: string) => (
    <a
      key={to}
      className={active === to ? 'sidenav__item sidenav__item--active' : 'sidenav__item'}
      href={`#${to}`}
      {...(active === to ? { 'aria-current': 'page' as const } : {})}
      onClick={(e) => {
        e.preventDefault()
        navigate(to)
        onPick?.()
      }}
    >
      {label}
      {to === '/pipelines' && dot && (
        <span className={dot.cls} title={dot.title} aria-hidden="true" />
      )}
    </a>
  )

  return (
    <nav className="sidenav" aria-label="Conduit">
      {navItems.filter((n) => n.group === 'product').map((n) => item(n.to, n.label))}
      <div className="sidenav__caption" aria-hidden="false">
        <NuonMark size={12} />
        Deployed by Nuon
      </div>
      {navItems.filter((n) => n.group === 'nuon').map((n) => item(n.to, n.label))}
    </nav>
  )
}

export function Sidebar({
  config,
  pipelines,
  parts,
}: {
  config: UIConfig
  pipelines: SyncPipeline[]
  parts: string[]
}) {
  const navigate = useNavigate()
  const active = activeNavItem(parts)

  return (
    <aside className="sidebar">
      <button className="sidebar__brand" onClick={() => navigate('/')}>
        <ConduitMark />
        <span className="sidebar__brand-name">Conduit</span>
      </button>
      <NavList active={active} pipelines={pipelines} />
      <div className="sidebar__foot">
        {config.install_id && (
          <span className="sidebar__install mono" title={config.install_id}>
            <Icon name="cube" />
            {config.install_id}
          </span>
        )}
        <OutLink href={config.links.install} variant="plain">
          Open in Nuon
        </OutLink>
      </div>
    </aside>
  )
}

/** Below 860px the sidebar collapses into this bar + sheet overlay. */
export function MobileNav({
  config,
  pipelines,
  parts,
}: {
  config: UIConfig
  pipelines: SyncPipeline[]
  parts: string[]
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const active = activeNavItem(parts)

  // The sheet is a modal layer; no page scroll behind it.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <div className="mobilebar">
        <button
          className="mobilebar__brand"
          onClick={() => {
            setOpen(false)
            navigate('/')
          }}
        >
          <ConduitMark />
          <span className="sidebar__brand-name">Conduit</span>
        </button>
        <button
          className="mobilebar__menu"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && (
        <div className="navsheet" role="dialog" aria-label="Navigation">
          <NavList active={active} pipelines={pipelines} onPick={() => setOpen(false)} />
          <div className="sidebar__foot navsheet__foot">
            {config.install_id && (
              <span className="sidebar__install mono" title={config.install_id}>
                <Icon name="cube" />
                {config.install_id}
              </span>
            )}
            <OutLink href={config.links.install} variant="plain">
              Open in Nuon
            </OutLink>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * The one shell-level alert: every pipeline is paused (the pause drill, or a
 * real emergency). Partial pauses stay page-level badges.
 */
export function PausedBanner({
  pipelines,
  count,
}: {
  pipelines: SyncPipeline[]
  count: number
}) {
  const allPaused = count > 0 && pipelines.length > 0 && pipelines.every((p) => p.paused)
  if (!allPaused) return null
  return (
    <div className="pausebanner-wrap">
      <div className="pausebanner" role="status">
        <span className="pausebanner__dot" aria-hidden="true" />
        All pipelines are paused — <a href="#/operate/roles">the pause drill</a>{' '}
        resumes them.
      </div>
    </div>
  )
}
