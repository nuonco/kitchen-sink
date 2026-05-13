import { useEffect, useState } from 'react'

interface IntrospectData {
  description: string
  response: Record<string, unknown>
}

const endpoints = [
  { name: 'Environment', path: '/api/introspect/env' },
  { name: 'Kubernetes', path: '/api/introspect/kube' },
  { name: 'Helm Charts', path: '/api/introspect/helm' },
  { name: 'Terraform', path: '/api/introspect/terraform' },
  { name: 'Secrets', path: '/api/introspect/secrets' },
  { name: 'Defaults', path: '/api/introspect/defaults' },
  { name: 'Sandbox', path: '/api/introspect/sandbox' },
  { name: 'Nuon', path: '/api/introspect/nuon' },
  { name: 'Docker Build', path: '/api/introspect/docker-build' },
  { name: 'External Image', path: '/api/introspect/external-image' },
]

function App() {
  const [selected, setSelected] = useState(endpoints[0].path)
  const [data, setData] = useState<IntrospectData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(selected)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [selected])

  return (
    <div className="app">
      <header>
        <h1>Kitchen Sink App</h1>
        <p>Nuon Platform Introspection Dashboard</p>
      </header>
      <div className="layout">
        <nav>
          {endpoints.map((ep) => (
            <button
              key={ep.path}
              className={selected === ep.path ? 'active' : ''}
              onClick={() => setSelected(ep.path)}
            >
              {ep.name}
            </button>
          ))}
        </nav>
        <main>
          {loading && <p className="status">Loading...</p>}
          {error && <p className="status error">Error: {error}</p>}
          {data && !loading && (
            <div>
              <h2>{data.description}</h2>
              <pre>{JSON.stringify(data.response, null, 2)}</pre>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
