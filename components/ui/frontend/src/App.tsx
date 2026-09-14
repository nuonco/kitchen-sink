import { useEffect, useState } from 'react'
import { useUIConfig } from './lib/api'
import { recordHub } from './lib/origin'
import { navigate, query, segments, useNavigate, useRoute } from './lib/router'
import { AmbientMark } from './ui/AmbientMark'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { Icon, NuonMark, OutLink } from './ui/Primitives'
import { ProgressStrip } from './ui/ProgressStrip'
import { AuditLog } from './views/AuditLog'
import { CaseDetail } from './views/CaseDetail'
import { Cases } from './views/Cases'
import { Customize } from './views/Customize'
import { Deployed } from './views/Deployed'
import { Home } from './views/Home'
import { Mapping } from './views/Mapping'
import { Operations } from './views/Operations'
import { markOpenerDone, Opener, openerDone } from './views/Opener'
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

  // The opener shows until it has been passed or skipped once in this
  // browser; after that "/" is Home. "/intro" replays it on request.
  const [seenOpener, setSeenOpener] = useState(openerDone)
  const finishOpener = () => {
    markOpenerDone()
    setSeenOpener(true)
    navigate('/')
  }

  // Distinct keys so a hash change between "/" and "/intro" remounts the
  // opener instead of carrying the current slide across.
  let view = seenOpener ? (
    <Home config={config} />
  ) : (
    <Opener key="opener" config={config} onDone={finishOpener} />
  )
  if (parts[0] === 'intro') {
    view = <Opener key="intro" config={config} onDone={finishOpener} fromStart />
  } else if (parts[0] === 'home') {
    view = <Home config={config} />
  } else if (parts[0] === 'cases') {
    view = parts[1] ? (
      <CaseDetail config={config} branch={parts[1]} panel={query(path).get('panel')} />
    ) : (
      <Cases />
    )
  } else if (parts[0] === 'deployed') {
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
      <ProgressStrip />
      <main className="main">{view}</main>
      <footer className="footer">
        <div className="footer__inner">
          <span className="mono">nuonco/kitchen-sink</span>
          <span className="topbar__divider" />
          <a href="#/intro">Opener</a>
          <span className="topbar__spacer" />
          <OutLink href="https://docs.nuon.co" variant="plain">
            docs.nuon.co
          </OutLink>
        </div>
      </footer>
    </div>
  )
}
