import { useEffect } from 'react'
import { useUIConfig } from './lib/api'
import { branchName, installGroups } from './lib/config-data.gen'
import { recordHub } from './lib/origin'
import { segments, useNavigate, useRoute } from './lib/router'
import { AmbientMark } from './ui/AmbientMark'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { Icon, NuonMark, OutLink } from './ui/Primitives'
import { AuditLog } from './views/AuditLog'
import { Customize } from './views/Customize'
import { Deployed } from './views/Deployed'
import { Landing } from './views/Landing'
import { Mapping } from './views/Mapping'
import { Operations } from './views/Operations'
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
        <span className="topbar__brand-name">Kitchen sink</span>
      </button>
      {/* The two ideas this demo exists to show, visible from every view. */}
      <a
        className="topbar__chip"
        href="#/customize/branches"
        title="Every change to this install ships through an app branch, group by group"
      >
        <Icon name="git-branch" />
        <span>
          ships via <span className="topbar__chip-strong">{branchName}</span>
        </span>
        <span className="topbar__chip-groups">
          {installGroups.map((g) => g.name).join(' → ')}
        </span>
      </a>
      <a
        className="topbar__chip topbar__chip--agent"
        href="#/customize/agent"
        title="Connect Nuon's MCP server to Claude Code, Cursor, or Amp"
      >
        <Icon name="lightning" />
        Connect your coding agent
      </a>
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

  // Remember which hub the visitor last passed through, so feature pages
  // reachable from both can point their breadcrumb at the right one.
  useEffect(() => {
    recordHub(path)
  }, [path])

  let view = <Landing config={config} />
  if (parts[0] === 'deployed') {
    view = <Deployed config={config} />
  } else if (parts[0] === 'operations') {
    view = <Operations />
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
            This app and the Nuon dashboard are two halves of the same tour.
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
