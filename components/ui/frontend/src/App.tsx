import { useEffect } from 'react'
import { useUIConfig, type UIConfig } from './lib/api'
import { segments, useNavigate, useRoute } from './lib/router'
import { AmbientMark } from './ui/AmbientMark'
import { AppShell } from './ui/AppShell'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { OutLink } from './ui/Primitives'
import { AuditLog } from './views/AuditLog'
import { Customize } from './views/Customize'
import { Deployed } from './views/Deployed'
import { Landing } from './views/Landing'
import { Mapping } from './views/Mapping'
import { Ops } from './views/Ops'
import { TicTacToe } from './views/TicTacToe'

/* ============================================================
   Legacy hash routes redirect to the product IA. The old paths keep
   working forever; the URL bar shows the new one.
   ============================================================ */

const legacyAliases: Record<string, string> = {
  deployed: 'workloads',
  'audit-log': 'events',
  ops: 'operations',
  map: 'nuon',
  customize: 'guide',
  day2: 'guide',
}

function canonicalize(path: string): string {
  const parts = segments(path)
  const head = parts[0]
  if (head && legacyAliases[head]) {
    return `/${[legacyAliases[head], ...parts.slice(1)].join('/')}`
  }
  return path
}

/** Interim: the Reports surface lands with its own view; until then the
 * route resolves and names itself. */
function ReportsInterim() {
  return (
    <header className="page-header">
      <h1>Reports</h1>
      <p className="lede">The install&rsquo;s report archive.</p>
    </header>
  )
}

/** Interim: the instance facts, until the full Settings view lands. */
function SettingsInterim({ config }: { config: UIConfig }) {
  const facts: Array<[string, string | undefined]> = [
    ['install id', config.install_id],
    ['org id', config.org_id],
    ['app id', config.app_id],
    ['cluster', config.cluster_name],
    ['region', config.region],
    ['domain', config.public_domain],
    ['namespace', config.namespace],
  ]
  const known = facts.filter(([, v]) => v)
  return (
    <>
      <header className="page-header">
        <h1>Settings</h1>
        <p className="lede">
          A read-only console: settings here are facts, not forms.
        </p>
      </header>
      {known.length > 0 && (
        <dl className="kv" style={{ marginTop: 24 }}>
          {known.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {config.links.versions && (
        <p className="small" style={{ marginTop: 24 }}>
          <OutLink href={config.links.versions} variant="plain">
            Config versions
          </OutLink>
        </p>
      )}
    </>
  )
}

export default function App() {
  const config = useUIConfig()
  const rawPath = useRoute()
  const path = canonicalize(rawPath)
  const parts = segments(path)
  const navigate = useNavigate()

  // Rewrite legacy hashes in place so bookmarks land on the new URLs.
  useEffect(() => {
    if (path !== rawPath) {
      window.location.replace(`#${path}`)
    }
  }, [path, rawPath])

  let view = <Landing config={config} />
  if (parts[0] === 'workloads') {
    view = <Deployed config={config} section={parts[1]} />
  } else if (parts[0] === 'events') {
    view = <AuditLog config={config} />
  } else if (parts[0] === 'reports') {
    view = <ReportsInterim />
  } else if (parts[0] === 'operations') {
    view = <Ops config={config} />
  } else if (parts[0] === 'settings') {
    view = <SettingsInterim config={config} />
  } else if (parts[0] === 'nuon') {
    view = <Mapping config={config} />
  } else if (parts[0] === 'guide') {
    view = <Customize config={config} flow={parts[1]} />
  } else if (parts[0] === 'tictactoe') {
    view = <TicTacToe config={config} />
  }

  return (
    <>
      <LoadingOverlay />
      <AmbientMark />
      <AppShell
        config={config}
        path={path}
        onGettingStarted={() => navigate('/')}
      >
        {view}
      </AppShell>
    </>
  )
}
