import { seenSteps } from '../lib/progress'
import { useNavigate } from '../lib/router'
import { pathSteps } from '../lib/taxonomy'
import { PixelCheck } from '../ui/CapabilityGrid'
import { BackLink } from '../ui/Primitives'

/* ============================================================
   The operations hub: the day-2 features as one index, in the same rowed
   style as the landing's. Each row is an existing feature page; this page
   adds nothing but the front door.
   ============================================================ */

const opsSteps = [
  '/customize/health',
  '/customize/runbooks',
  '/customize/actions',
  '/customize/triggers',
  '/customize/roles',
]

export function Operations() {
  const navigate = useNavigate()
  const seen = seenSteps()
  const phases = ['Operate', 'Govern'] as const
  const rows = opsSteps
    .map((to) => pathSteps.find((s) => s.to === to))
    .filter((s) => s !== undefined)

  return (
    <>
      <BackLink to="/">Customize the Kitchen Sink</BackLink>
      <header className="page-header">
        <h1>BYOC operations</h1>
        <p className="lede">
          Day-2 without SSH or a kubeconfig — every operation runs on the
          install&rsquo;s runner, inside the customer&rsquo;s account.
        </p>
      </header>

      <div className="encyc" style={{ marginTop: 40 }}>
        {phases.map((phase) => (
          <div className="encyc__group" key={phase}>
            <div className="encyc__phase">{phase}</div>
            <ul className="encyc__list">
              {rows
                .filter((s) => s.phase === phase)
                .map((s) => (
                  <li key={s.to}>
                    <a
                      className="encyc__row"
                      href={`#${s.to}`}
                      onClick={(e) => {
                        e.preventDefault()
                        navigate(s.to)
                      }}
                    >
                      <span className="encyc__title">{s.title}</span>
                      <span className="encyc__desc">{s.desc}</span>
                      {seen.has(s.to) && (
                        <span
                          className="encyc__seen"
                          title="You have opened this page"
                        >
                          <PixelCheck />
                        </span>
                      )}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}
