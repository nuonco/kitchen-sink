import { useEffect } from 'react'
import { useDelivery, useUIConfig, type DeliveryStats } from './lib/api'
import { redirect, segments, useNavigate, useRoute } from './lib/router'
import { AmbientMark } from './ui/AmbientMark'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { Icon, NuonMark, OutLink } from './ui/Primitives'
import { Dashboard } from './views/Dashboard'
import { DeadLetters } from './views/DeadLetters'
import { Endpoints } from './views/Endpoints'
import { Events } from './views/Events'
import { Infrastructure } from './views/Infrastructure'
import { LogsExport } from './views/LogsExport'
import { TicTacToe } from './views/TicTacToe'

/** How often the shell re-reads the delivery stats it shares with its views. */
const STATS_POLL_MS = 15_000

function TopBar({
  installID,
  clusterName,
  dashboardURL,
}: {
  installID?: string
  clusterName?: string
  dashboardURL?: string
}) {
  const navigate = useNavigate()

  return (
    <header className="topbar">
      <button className="topbar__brand" onClick={() => navigate('/')}>
        <NuonMark />
        <span className="topbar__brand-name">Relay</span>
      </button>
      {installID && (
        <>
          <span className="topbar__divider" />
          <span className="topbar__meta" title={clusterName ? `${installID} · ${clusterName}` : installID}>
            <Icon name="cube" />
            {installID}
            {clusterName && <span className="topbar__cluster"> · {clusterName}</span>}
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

/* ============================================================
   The product nav. One entry per surface; Dead letters carries the live
   queue depth. Tictactoe stays off the nav on purpose.
   ============================================================ */

const navItems = [
  { to: '/', head: '', label: 'Dashboard' },
  { to: '/events', head: 'events', label: 'Events' },
  { to: '/endpoints', head: 'endpoints', label: 'Endpoints' },
  { to: '/dead-letters', head: 'dead-letters', label: 'Dead letters' },
  { to: '/logs', head: 'logs', label: 'Logs & export' },
  { to: '/infrastructure', head: 'infrastructure', label: 'Infrastructure' },
]

function SideNav({ head, dlqDepth }: { head: string; dlqDepth?: number }) {
  const navigate = useNavigate()
  return (
    <nav className="sidenav" aria-label="Relay">
      <ul className="sidenav__list">
        {navItems.map((item) => (
          <li key={item.to}>
            <button
              className={
                head === item.head ? 'sidenav__item sidenav__item--active' : 'sidenav__item'
              }
              aria-current={head === item.head ? 'page' : undefined}
              onClick={() => navigate(item.to)}
            >
              <span>{item.label}</span>
              {item.head === 'dead-letters' &&
                dlqDepth !== undefined &&
                dlqDepth > 0 && (
                  <span className="sidenav__count" aria-label={`${dlqDepth} dead`}>
                    {dlqDepth}
                  </span>
                )}
            </button>
          </li>
        ))}
      </ul>
      <div className="sidenav__foot">Deployed by Nuon</div>
    </nav>
  )
}

/** Retired routes from the tour-era console, mapped into the new pages. */
function redirectTarget(parts: string[]): string | null {
  const head = parts[0]
  if (head === 'delivery') return '/events'
  if (head === 'deployed' || head === 'map' || head === 'ops')
    return '/infrastructure'
  if (head === 'customize' || head === 'day2') {
    const flow = parts[1]
    if (flow === 'branches' || flow === 'agent') return '/infrastructure/ship'
    if (
      flow === 'runbooks' ||
      flow === 'actions' ||
      flow === 'health' ||
      flow === 'triggers' ||
      flow === 'roles'
    )
      return '/infrastructure/operate'
    return '/infrastructure'
  }
  if (head === 'audit-log') return '/logs'
  return null
}

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    redirect(to)
  }, [to])
  return null
}

export default function App() {
  const config = useUIConfig()
  const path = useRoute()
  const parts = segments(path)
  const head = parts[0] ?? ''

  // Delivery stats are the one read several surfaces share: the dashboard's
  // tiles, the nav's dead-letter count. Fetched once here, refreshed by a
  // replay so the count never lags the action that changed it.
  const [stats, refreshStats] = useDelivery<DeliveryStats>(
    '/api/delivery/stats',
    STATS_POLL_MS,
  )
  const dlqDepth = stats.state === 'ok' ? stats.value.dlq_depth : undefined

  const retired = redirectTarget(parts)

  let view = <Dashboard config={config} stats={stats} />
  if (retired) {
    view = <Redirect to={retired} />
  } else if (head === 'events') {
    view = <Events id={parts[1]} />
  } else if (head === 'endpoints') {
    view = <Endpoints id={parts[1]} />
  } else if (head === 'dead-letters') {
    view = <DeadLetters onMutated={refreshStats} />
  } else if (head === 'logs') {
    view = <LogsExport config={config} />
  } else if (head === 'infrastructure') {
    view = <Infrastructure config={config} section={parts[1]} />
  } else if (head === 'tictactoe') {
    view = <TicTacToe config={config} />
  }

  return (
    <div className="shell">
      <LoadingOverlay />
      <AmbientMark />
      <TopBar
        installID={config.install_id}
        clusterName={config.cluster_name}
        dashboardURL={config.links.install}
      />
      <div className="body">
        <SideNav head={retired ? '' : head} dlqDepth={dlqDepth} />
        <main className="main">{view}</main>
      </div>
      <footer className="footer">
        <div className="footer__inner">
          <span className="mono">nuonco/kitchen-sink</span>
          <span className="topbar__spacer" />
          <OutLink href="https://docs.nuon.co" variant="plain">
            docs.nuon.co
          </OutLink>
        </div>
      </footer>
    </div>
  )
}
