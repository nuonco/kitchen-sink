import { branchName, repoName } from '../lib/config-data.gen'
import { caseBranch, cases, shipsTo } from '../lib/cases'
import { CaseDiagram } from '../ui/CaseDiagrams'

/* ============================================================
   The gallery: one tile per common request, each an app branch of this
   repo. Files and groups come from the branch's diff against main.
   ============================================================ */

export function Cases() {
  return (
    <div className="cases">
      <header className="page-header cases__head">
        <div>
          <div className="eyebrow eyebrow--accent">Kitchen sink demo · common requests</div>
          <h1>
            One repo. {cases.length} branches. {cases.length} requests.
          </h1>
        </div>
        <div className="mono cases__repo">
          <span className="cases__repo-name">{repoName}</span> @{branchName}{' '}
          <span className="cases__repo-accent">→ {cases.length} branches</span>
        </div>
      </header>

      <div className="casegrid">
        {cases.map((c, i) => {
          const branch = caseBranch(c.branch)
          const ships = shipsTo(c.branch)
          return (
            <a key={c.branch} className="casetile" href={`#/cases/${c.branch}`}>
              <div className="casetile__head">
                <span className="casetile__n mono">{i + 1}</span>
                <span className="casetile__name">{c.title}</span>
              </div>
              <span className="casetile__branch mono">@{c.branch}</span>
              <CaseDiagram branch={c.branch} />
              <div className="casetile__files">
                {(branch?.files ?? []).map((f) => (
                  <span
                    key={f.path}
                    className={f.status === 'A' ? 'casetile__file casetile__file--add mono' : 'casetile__file mono'}
                  >
                    {f.status === 'A' ? '+ ' : ''}
                    {f.path}
                  </span>
                ))}
              </div>
              <div className="casetile__foot mono">
                {ships ? (
                  <>
                    ships to <b>{ships.name}</b> · order {ships.order}
                  </>
                ) : (
                  'branch not found'
                )}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
