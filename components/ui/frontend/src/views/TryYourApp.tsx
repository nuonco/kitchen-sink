import {
  conditionalStops,
  itNever,
  neverMechanism,
  paste,
  pasteSource,
  prerequisites,
  runs,
  turnLimit,
  youDo,
  youGet,
} from '../lib/nuon-loop-paste'
import { BackLink, CopyButton, Disclosure } from '../ui/Primitives'

/* ============================================================
   The exit to the doing path: the nuon-loop paste with a copy button, and
   what it produces, what it stops for, and what it never does, all taken
   from nuonco/nuon-loop's PASTE.md and README.md at one commit.
   ============================================================ */

function Check() {
  return (
    <span className="try__chk" aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M2 6.5 L4.8 9 L10 3.5" />
      </svg>
    </span>
  )
}

function Cross() {
  return (
    <span className="try__x" aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.8">
        <path d="M2 2 L10 10 M10 2 L2 10" />
      </svg>
    </span>
  )
}

export function TryYourApp() {
  const min = Math.min(...runs.map((r) => r.toHandoff))
  const max = Math.max(...runs.map((r) => r.toHandoff))
  return (
    <div className="try">
      <BackLink to="/home">Home</BackLink>
      <header className="page-header try__head">
        <div className="eyebrow eyebrow--accent">Kitchen sink demo · doing path</div>
        <h1>Your app on Nuon. One paste.</h1>
      </header>

      <section className="try__paste">
        <div className="try__paste-text mono">
          <span className="home__goal">{paste.slice(0, 5)}</span>
          {paste.slice(5)}
          <span className="try__fade" aria-hidden="true" />
        </div>
        <CopyButton text={paste} label="Copy prompt" doneLabel="Copied" big />
      </section>
      <div className="mono try__prereqs">
        paste into Claude Code, in the directory that holds your app · {prerequisites.join(' · ')}
      </div>
      <div className="mono try__source">
        {pasteSource.repo} · {pasteSource.file} @ {pasteSource.commit.slice(0, 7)} · {pasteSource.date}
        {pasteSource.private && ' · private repo: the clone needs credentials with access'}
      </div>

      <div className="try__cols">
        <section className="try__col">
          <h2 className="try__col-title">You get</h2>
          {youGet.map((item) => (
            <div key={item.text} className="try__item">
              <Check />
              <span className="try__item-text">{item.text}</span>
              <span className="mono try__item-aside">{item.aside}</span>
            </div>
          ))}
          <div className="mono try__note">
            TOML you own · one commit per plan item · pasting again resumes, never restarts
          </div>
        </section>

        <section className="try__col">
          <h2 className="try__col-title">
            You do <span className="try__col-sub">· {youDo.length} stops</span>
          </h2>
          {youDo.map((item, i) => (
            <div key={item.text} className={i === youDo.length - 1 ? 'try__item try__item--last' : 'try__item'}>
              <span className="try__num mono">{i + 1}</span>
              <span className="try__item-text">{item.text}</span>
              <span className="mono try__item-aside">{item.aside}</span>
            </div>
          ))}
          <Disclosure summary={`${conditionalStops.length} conditional stops`}>
            <ul className="try__cond">
              {conditionalStops.map((c) => (
                <li key={c.text}>
                  <span>{c.text}</span>
                  <span className="mono try__cond-when">{c.when}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
          <div className="mono try__note">
            everything else runs unattended · stops at <b>{turnLimit} turns</b> · {min} to {max} turns to
            the handoff in {runs.length} runs
          </div>
        </section>

        <section className="try__col">
          <h2 className="try__col-title">It never</h2>
          {itNever.map((item) => (
            <div key={item} className="try__item try__item--never">
              <Cross />
              <span className="try__item-text">{item}</span>
            </div>
          ))}
          <div className="mono try__note">
            denied in <b>{neverMechanism}</b>
          </div>
        </section>
      </div>
    </div>
  )
}
