import { useEffect, useState, type ReactNode } from 'react'
import type { UIConfig } from '../lib/api'
import { useNavigate } from '../lib/router'
import { Icon, NuonMark, OutLink } from './Primitives'

/* ============================================================
   The product app shell: slim topbar spanning the full width, a fixed
   left sidebar carrying the nav (the product group first, the Nuon story
   second), and the content pane. Collapses to an icon rail under 960px
   and to a topbar-hamburger overlay drawer under 680px.
   ============================================================ */

interface NavItem {
  to: string
  icon: string
  label: string
}

const productNav: NavItem[] = [
  { to: '/', icon: 'gauge', label: 'Dashboard' },
  { to: '/workloads', icon: 'cube', label: 'Workloads' },
  { to: '/events', icon: 'lightning', label: 'Events' },
  { to: '/reports', icon: 'book-open', label: 'Reports' },
  { to: '/operations', icon: 'heartbeat', label: 'Operations' },
  { to: '/settings', icon: 'lock', label: 'Settings' },
]

const deploymentNav: NavItem[] = [
  { to: '/nuon', icon: 'puzzle-piece', label: 'Deployed by Nuon' },
  { to: '/guide', icon: 'grid-four', label: 'Evaluation guide' },
]

function isActive(path: string, to: string): boolean {
  if (to === '/') return path === '/'
  return path === to || path.startsWith(`${to}/`)
}

function SidebarLink({
  item,
  path,
  onNavigate,
}: {
  item: NavItem
  path: string
  onNavigate: () => void
}) {
  const navigate = useNavigate()
  const active = isActive(path, item.to)
  return (
    <a
      className={active ? 'sidebar__link sidebar__link--active' : 'sidebar__link'}
      href={`#${item.to}`}
      title={item.label}
      {...(active ? { 'aria-current': 'page' as const } : {})}
      onClick={(e) => {
        e.preventDefault()
        navigate(item.to)
        onNavigate()
      }}
    >
      <Icon name={item.icon} />
      <span className="sidebar__label">{item.label}</span>
    </a>
  )
}

function SidebarGroup({
  label,
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <div className="sidebar__group">
      {label && <div className="sidebar__group-label">{label}</div>}
      {children}
    </div>
  )
}

function Sidebar({
  path,
  open,
  onClose,
  onGettingStarted,
}: {
  path: string
  open: boolean
  onClose: () => void
  onGettingStarted: () => void
}) {
  return (
    <aside className={open ? 'sidebar sidebar--open' : 'sidebar'}>
      <div className="sidebar__inner">
        <nav className="sidebar__nav" aria-label="Periscope">
          <SidebarGroup>
            {productNav.map((item) => (
              <SidebarLink key={item.to} item={item} path={path} onNavigate={onClose} />
            ))}
          </SidebarGroup>
          <SidebarGroup label="Deployment">
            {deploymentNav.map((item) => (
              <SidebarLink key={item.to} item={item} path={path} onNavigate={onClose} />
            ))}
          </SidebarGroup>
        </nav>
        <div className="sidebar__foot">
          <button
            className="sidebar__link"
            title="Getting started"
            onClick={() => {
              onClose()
              onGettingStarted()
            }}
          >
            <Icon name="magnifying-glass" />
            <span className="sidebar__label">Getting started</span>
          </button>
          <a
            className="sidebar__link"
            href="https://docs.nuon.co"
            target="_blank"
            rel="noreferrer"
            title="docs.nuon.co"
          >
            <Icon name="arrow-up-right" />
            <span className="sidebar__label">docs.nuon.co</span>
          </a>
        </div>
      </div>
    </aside>
  )
}

function TopBar({
  installID,
  dashboardURL,
  onMenu,
}: {
  installID?: string
  dashboardURL?: string
  onMenu: () => void
}) {
  const navigate = useNavigate()
  return (
    <header className="topbar">
      <button
        className="topbar__menu"
        aria-label="Menu"
        onClick={onMenu}
      >
        <Icon name="grid-four" />
      </button>
      <button className="topbar__brand" onClick={() => navigate('/')}>
        <NuonMark />
        <span className="topbar__brand-name">Periscope</span>
      </button>
      {installID && (
        <>
          <span className="topbar__divider" />
          <span className="topbar__meta" title={installID}>
            <Icon name="cube" />
            {installID}
          </span>
        </>
      )}
      <span className="topbar__spacer" />
      <OutLink href={dashboardURL} variant="secondary">
        Open in Nuon
      </OutLink>
    </header>
  )
}

export function AppShell({
  config,
  path,
  onGettingStarted,
  children,
}: {
  config: UIConfig
  path: string
  onGettingStarted: () => void
  children: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  // The mobile drawer closes on ESC and never survives a route change.
  useEffect(() => {
    setMenuOpen(false)
  }, [path])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="shell">
      <TopBar
        installID={config.install_id}
        dashboardURL={config.links.install}
        onMenu={() => setMenuOpen((v) => !v)}
      />
      <div className="shell-grid">
        {menuOpen && (
          <div
            className="sidebar-scrim"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <Sidebar
          path={path}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onGettingStarted={onGettingStarted}
        />
        <div className="pane">
          <main className="main">{children}</main>
          <footer className="footer">
            <div className="footer__inner">
              <span className="mono">nuonco/kitchen-sink</span>
              <span className="topbar__divider" />
              <span>Deployed by Nuon</span>
              <span className="topbar__spacer" />
              <OutLink href="https://docs.nuon.co" variant="plain">
                docs.nuon.co
              </OutLink>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
