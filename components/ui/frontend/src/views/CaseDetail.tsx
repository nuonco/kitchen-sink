import type { UIConfig } from '../lib/api'
import type { DeltaFile } from '../lib/case-deltas.gen'
import { caseBranch, cases, shipsTo, type CaseDef } from '../lib/cases'
import { repoName } from '../lib/config-data.gen'
import { panelById } from '../lib/panels'
import { useNavigate } from '../lib/router'
import { CaseDiagram } from '../ui/CaseDiagrams'
import { Drawer } from '../ui/Drawer'
import { BackLink, CopyButton, Disclosure, OutLink } from '../ui/Primitives'

/* ============================================================
   One request end to end: the picture of the branch, the diff against
   main, the sync command, the rollout order, then the "On this install"
   strip of proof tiles and the one prompt for a coding agent.
   ============================================================ */

/** How many removed and added lines a delta row shows before the fold. */
const SHOWN = 2

function DeltaRow({ file }: { file: DeltaFile }) {
  const shownMinus = file.minus.slice(0, SHOWN)
  const shownPlus = file.plus.slice(0, SHOWN)
  const rest = file.minus.length - shownMinus.length + (file.plus.length - shownPlus.length)
  return (
    <div className="delta__row">
      <span className={`delta__tag delta__tag--${file.status.toLowerCase()} mono`}>{file.status}</span>
      <div className="delta__body">
        <div className="delta__file mono">{file.path}</div>
        <div className="delta__lines mono">
          {shownMinus.map((l, i) => (
            <div key={`m${i}`} className="delta__minus">
              − {l}
            </div>
          ))}
          {shownPlus.map((l, i) => (
            <div key={`p${i}`} className="delta__plus">
              + {l}
            </div>
          ))}
        </div>
        {rest > 0 && (
          <Disclosure summary={`${rest} more lines`}>
            <pre className="raw">
              {[
                ...file.minus.slice(SHOWN).map((l) => `− ${l}`),
                ...file.plus.slice(SHOWN).map((l) => `+ ${l}`),
              ].join('\n')}
            </pre>
          </Disclosure>
        )}
      </div>
    </div>
  )
}

function Strip({ def, config, open }: { def: CaseDef; config: UIConfig; open: string | null }) {
  const navigate = useNavigate()
  const mounted = def.panels.map(panelById).filter((p) => p !== undefined)
  if (mounted.length === 0) return null
  return (
    <section className="strip">
      <div className="section__head">
        <h2 className="section__title">On this install</h2>
        <div className="subtext muted">{config.install_id ?? 'install id not served'}</div>
      </div>
      <div className="strip__tiles">
        {mounted.map((p) => (
          <button
            key={p.id}
            type="button"
            className={open === p.id ? 'ptile ptile--open' : 'ptile'}
            onClick={() => navigate(`/cases/${def.branch}?panel=${p.id}`, { keepScroll: true })}
          >
            <span className="ptile__title mono">{p.title}</span>
            <p.Tile config={config} />
          </button>
        ))}
      </div>
    </section>
  )
}

export function CaseDetail({
  config,
  branch,
  panel,
}: {
  config: UIConfig
  branch: string
  panel: string | null
}) {
  const navigate = useNavigate()
  const index = cases.findIndex((c) => c.branch === branch)
  const def = index === -1 ? undefined : cases[index]
  if (!def) {
    return (
      <>
        <BackLink to="/cases">Common requests</BackLink>
        <header className="page-header">
          <h1>No case named {branch}.</h1>
        </header>
      </>
    )
  }

  const data = caseBranch(def.branch)
  const ships = shipsTo(def.branch)
  const app = config.app_id ?? '<your-app-id>'
  const syncCmd = `nuon sync --app-id ${app} --force --branch ${def.branch}`
  const openPanel = panel ? panelById(panel) : undefined
  const closeDrawer = () => navigate(`/cases/${def.branch}`, { keepScroll: true })
  const prompt = def.prompt(config)

  return (
    <div className="casedetail">
      <BackLink to="/cases">Common requests</BackLink>
      <header className="page-header casedetail__head">
        <div>
          <div className="eyebrow eyebrow--accent">
            Kitchen sink demo · common requests · {index + 1} of {cases.length}
          </div>
          <h1>{def.title}.</h1>
        </div>
        <div className="casedetail__meta mono">
          <span>{repoName}</span>
          <span className="casedetail__branch">@{def.branch}</span>
          {ships && (
            <span>
              ships to <b>{ships.name}</b> · order {ships.order}
            </span>
          )}
        </div>
      </header>

      <div className="casedetail__wings">
        <section className="casedetail__card casedetail__card--picture">
          <CaseDiagram branch={def.branch} />
          <p className="casedetail__quote">
            &ldquo;{def.quote.text}&rdquo;{' '}
            <OutLink href={def.quote.url} variant="plain">
              <span className="mono">{def.quote.label}</span>
            </OutLink>
          </p>
        </section>

        <section className="casedetail__card delta">
          <div className="home__card-head">
            <h2 className="home__card-title">
              {data?.base ?? 'main'} → {def.branch}
            </h2>
            <span className="mono home__aside">
              {data ? `${data.files.length} file${data.files.length === 1 ? '' : 's'} · ${data.head}` : 'branch not found'}
            </span>
          </div>
          <div className="delta__rows">
            {(data?.files ?? []).map((f) => (
              <DeltaRow key={f.path} file={f} />
            ))}
          </div>
          <div className="delta__foot">
            <div className="home__cmd">
              <code className="mono">{syncCmd}</code>
              <CopyButton text={syncCmd} />
            </div>
            <div className="mono home__aside">
              from a clone checked out at {def.branch} · plan → approve →{' '}
              {(data?.groups ?? []).map((g, i) => (
                <span key={g.name}>
                  {i > 0 && ' → '}
                  <span className="casedetail__lit">{g.name}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <Strip def={def} config={config} open={panel} />

      <section className="agentask">
        <div className="section__head">
          <h2 className="section__title">Ask your agent</h2>
          <div className="subtext muted">Nuon MCP server · read tools</div>
        </div>
        <div className="agent-prompt">
          <div className="cmd__head">
            <span className="cmd__label">this install&rsquo;s ids filled in</span>
            <CopyButton text={prompt} />
          </div>
          <pre className="cmd__pre agent-prompt__pre">{prompt}</pre>
        </div>
      </section>

      {openPanel && (
        <Drawer title={openPanel.title} aside={openPanel.source} onClose={closeDrawer}>
          <openPanel.Drawer config={config} />
        </Drawer>
      )}
    </div>
  )
}
