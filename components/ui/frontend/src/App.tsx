import { useEffect, useState, type ReactNode } from 'react'
import { useUIConfig } from './lib/api'
import { redirectFor } from './lib/redirects'
import { navigate, query, replace, segments, useNavigate, useRoute } from './lib/router'
import { AmbientMark } from './ui/AmbientMark'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { Icon, NuonMark, OutLink } from './ui/Primitives'
import { CaseDetail } from './views/CaseDetail'
import { Cases } from './views/Cases'
import { TryYourApp } from './views/TryYourApp'
import { Home } from './views/Home'
import { markOpenerDone, Opener, openerDone } from './views/Opener'

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

  // Retired routes open the case and drawer that now carry them.
  const redirect = redirectFor(path)
  useEffect(() => {
    if (redirect) replace(redirect)
  }, [redirect])

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
  let view: ReactNode = seenOpener ? (
    <Home config={config} />
  ) : (
    <Opener key="opener" config={config} onDone={finishOpener} />
  )
  if (parts[0] === 'intro') {
    view = <Opener key="intro" config={config} onDone={finishOpener} fromStart />
  } else if (parts[0] === 'home') {
    view = <Home config={config} />
  } else if (parts[0] === 'try') {
    view = <TryYourApp />
  } else if (parts[0] === 'cases') {
    view = parts[1] ? (
      <CaseDetail config={config} branch={parts[1]} panel={query(path).get('panel')} />
    ) : (
      <Cases />
    )
  }
  if (redirect) view = null

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
