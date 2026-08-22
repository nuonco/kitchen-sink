import { useEffect, useState } from 'react'
import { useUIConfig } from './lib/api'
import { segments, useNavigate, useRoute } from './lib/router'
import { AmbientMark } from './ui/AmbientMark'
import { AppShell } from './ui/AppShell'
import { tourDone } from './ui/Drawer'
import { LoadingOverlay } from './ui/LoadingOverlay'
import { Guide } from './views/Guide'
import { Dashboard } from './views/Dashboard'
import { Events } from './views/Events'
import { Workloads } from './views/Workloads'
import { Nuon } from './views/Nuon'
import { Operations } from './views/Operations'
import { Reports } from './views/Reports'
import { Settings } from './views/Settings'
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

export default function App() {
  const config = useUIConfig()
  const rawPath = useRoute()
  const path = canonicalize(rawPath)
  const parts = segments(path)
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Rewrite legacy hashes in place so bookmarks land on the new URLs.
  useEffect(() => {
    if (path !== rawPath) {
      window.location.replace(`#${path}`)
    }
  }, [path, rawPath])

  // First visit: the onboarding drawer opens over the Dashboard. Dismissing
  // writes the tour key, so it never reopens on its own.
  useEffect(() => {
    if (path === '/' && !tourDone()) setDrawerOpen(true)
  }, [path])

  let view = (
    <Dashboard
      config={config}
      drawerOpen={drawerOpen}
      onDrawerClose={() => setDrawerOpen(false)}
    />
  )
  if (parts[0] === 'workloads') {
    view = <Workloads config={config} section={parts[1]} />
  } else if (parts[0] === 'events') {
    view = <Events config={config} />
  } else if (parts[0] === 'reports') {
    view = <Reports config={config} />
  } else if (parts[0] === 'operations') {
    view = <Operations config={config} />
  } else if (parts[0] === 'settings') {
    view = <Settings config={config} />
  } else if (parts[0] === 'nuon') {
    view = <Nuon config={config} />
  } else if (parts[0] === 'guide') {
    view = <Guide config={config} flow={parts[1]} />
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
        onGettingStarted={() => {
          navigate('/')
          setDrawerOpen(true)
        }}
      >
        {view}
      </AppShell>
    </>
  )
}
