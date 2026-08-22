import { useIntrospectPoll, useUIConfig, type SyncPipelinesResponse } from './lib/api'
import { canonicalize } from './lib/nav'
import { segments, useRoute } from './lib/router'
import { AmbientMark } from './ui/AmbientMark'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { OutLink } from './ui/Primitives'
import { MobileNav, PausedBanner, Sidebar } from './ui/Shell'
import { Customize } from './views/Customize'
import { Dashboard } from './views/Dashboard'
import { Destinations } from './views/Destinations'
import { Landing } from './views/Landing'
import { Mapping } from './views/Mapping'
import { Ops } from './views/Ops'
import { PipelineDetail } from './views/PipelineDetail'
import { Pipelines } from './views/Pipelines'
import { TicTacToe } from './views/TicTacToe'
import { UnderTheHood } from './views/UnderTheHood'

/** The shell-level pipeline poll: feeds the sidebar's status dot and the
    global paused banner. Additive to the pages' own 10s polls. */
const SHELL_POLL_MS = 15_000

export default function App() {
  const config = useUIConfig()
  const path = useRoute()
  const parts = canonicalize(segments(path))

  const sync = useIntrospectPoll<SyncPipelinesResponse>(
    '/api/sync/pipelines',
    SHELL_POLL_MS,
    true,
  )
  const shellData = sync.state === 'ok' ? sync.value.response : undefined
  const shellPipelines = shellData?.pipelines ?? []

  let view = <Dashboard config={config} />
  if (parts[0] === 'pipelines') {
    view = parts[1] ? (
      <PipelineDetail
        name={parts[1]}
        runId={parts[2] === 'run' ? parts[3] : undefined}
      />
    ) : (
      <Pipelines config={config} />
    )
  } else if (parts[0] === 'system') {
    view = <UnderTheHood config={config} section={parts[1]} />
  } else if (parts[0] === 'destinations') {
    view = <Destinations config={config} />
  } else if (parts[0] === 'deployment') {
    // The Deployment page replaces Mapping here in a later chunk.
    view = <Mapping config={config} />
  } else if (parts[0] === 'operate') {
    view = parts[1] ? <Customize config={config} flow={parts[1]} /> : <Ops config={config} />
  } else if (parts[0] === 'tictactoe') {
    view = <TicTacToe config={config} />
  } else if (parts[0] === 'tour') {
    view = <Landing config={config} />
  }

  return (
    <div className="shell">
      <LoadingOverlay />
      <AmbientMark />
      <MobileNav config={config} pipelines={shellPipelines} parts={parts} />
      <div className="appgrid">
        <Sidebar config={config} pipelines={shellPipelines} parts={parts} />
        <div className="shell__col">
          <PausedBanner
            pipelines={shellPipelines}
            count={shellData?.pipelines_count ?? 0}
          />
          <main className="main">{view}</main>
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
      </div>
    </div>
  )
}
