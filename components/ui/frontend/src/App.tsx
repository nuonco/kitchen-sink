import { useUIConfig } from './lib/api'
import { segments, useNavigate, useRoute } from './lib/router'
import { AmbientMark } from './ui/AmbientMark'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { Icon, NuonMark, OutLink } from './ui/Primitives'
import { AuditLog } from './views/AuditLog'
import { Customize } from './views/Customize'
import { Delivery } from './views/Delivery'
import { Deployed } from './views/Deployed'
import { Landing } from './views/Landing'
import { Mapping } from './views/Mapping'
import { Ops } from './views/Ops'
import { TicTacToe } from './views/TicTacToe'

function TopBar({
  installID,
  dashboardURL,
}: {
  installID?: string
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

export default function App() {
  const config = useUIConfig()
  const path = useRoute()
  const parts = segments(path)

  let view = <Landing config={config} />
  if (parts[0] === 'delivery') {
    view = <Delivery config={config} />
  } else if (parts[0] === 'deployed') {
    view = <Deployed config={config} section={parts[1]} />
  } else if (parts[0] === 'map') {
    view = <Mapping config={config} />
  } else if (parts[0] === 'day2') {
    // The old day-2 pages merged into the customize taxonomy; keep the old
    // deep links working.
    view = <Customize config={config} flow={parts[1]} />
  } else if (parts[0] === 'ops') {
    view = <Ops config={config} />
  } else if (parts[0] === 'tictactoe') {
    view = <TicTacToe config={config} />
  } else if (parts[0] === 'audit-log') {
    view = <AuditLog config={config} />
  } else if (parts[0] === 'customize') {
    view = <Customize config={config} flow={parts[1]} />
  }

  return (
    <div className="shell">
      <LoadingOverlay />
      <AmbientMark />
      <TopBar installID={config.install_id} dashboardURL={config.links.install} />
      <main className="main">{view}</main>
      <footer className="footer">
        <div className="footer__inner">
          <span className="mono">nuonco/kitchen-sink</span>
          <span className="topbar__divider" />
          <span>
            Relay and the Nuon dashboard are two halves of the same tour.
          </span>
          <span className="topbar__spacer" />
          <OutLink href="https://docs.nuon.co" variant="plain">
            docs.nuon.co
          </OutLink>
        </div>
      </footer>
    </div>
  )
}
