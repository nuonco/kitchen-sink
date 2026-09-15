import type { UIConfig } from '../lib/api'
import { repoName } from '../lib/config-data.gen'
import {
  conditionalStops,
  itNever,
  neverMechanism,
  paste,
  pastePlain,
  pasteSource,
  prerequisites,
  runs,
  turnLimit,
  youDo,
  youGet,
} from '../lib/nuon-loop-paste'
import { BackLink, CopyButton, Disclosure, NoBreakHyphens, OutLink } from '../ui/Primitives'

/* ============================================================
   Connect your app: two paths from a repository to a first install. Path A
   hands the work to a coding agent with the nuon-loop paste (PASTE.md and
   README.md at one commit); path B is the same trip by hand, one CLI
   command per step, each verified against the installed CLI.
   ============================================================ */

const DOCS_FIRST_APP = 'https://docs.nuon.co/get-started/create-your-first-app'

/** The hand-run path. `<app>` is the reader's app name; the region is this
    install's when the server serves it. */
function manualSteps(region: string): Array<{ label: string; cmd?: string; doc?: { href: string; text: string } }> {
  return [
    { label: 'sign in', cmd: 'nuon auth login' },
    {
      label: 'write the config',
      doc: { href: DOCS_FIRST_APP, text: 'docs.nuon.co/get-started/create-your-first-app' },
    },
    { label: 'check it, from the config directory', cmd: 'nuon apps validate' },
    { label: 'upload it, creating the app', cmd: 'nuon sync --create --app-id <app>' },
    { label: 'create the first install', cmd: `nuon installs create -a <app> -n <app>-first -r ${region}` },
    { label: 'get the CloudFormation link', cmd: 'nuon installs stacks latest -i <app>-first' },
  ]
}

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

export function TryYourApp({ config }: { config: UIConfig }) {
  const min = Math.min(...runs.map((r) => r.toHandoff))
  const max = Math.max(...runs.map((r) => r.toHandoff))
  const steps = manualSteps(config.region ?? '<region>')
  const commands = steps.filter((s) => s.cmd).length
  return (
    <div className="try">
      <BackLink to="/home">Home</BackLink>
      <header className="page-header try__head">
        <div className="eyebrow eyebrow--accent">Kitchen sink demo · connect your app</div>
        <h1>Connect your app: your agent, or your terminal.</h1>
      </header>

      <div className="try__paths">
        <section className="try__path try__path--agent">
          <div className="try__path-head">
            <span className="try__path-n mono">A</span>
            <h2 className="try__path-title">Let your agent set it up</h2>
            <span className="mono home__aside">one paste · {pasteSource.spec}</span>
          </div>
          <div className="try__paste">
            <div className="try__paste-text mono">
              <span className="home__goal">{paste.slice(0, 5)}</span>
              {paste.slice(5)}
              <span className="try__fade" aria-hidden="true" />
            </div>
            <CopyButton text={paste} label="Copy prompt" doneLabel="Copied" big />
          </div>
          <div className="try__alt">
            <span className="mono try__alt-text">
              Claude Code runs it under <b>/goal</b>. Without /goal (Cursor, Amp) the same text runs as a plain
              prompt, with no gate evaluator.
            </span>
            <CopyButton text={pastePlain} label="Copy without /goal" doneLabel="Copied" />
          </div>
          <Disclosure summary={`before you paste · ${prerequisites.length} requirements`} defaultOpen>
            <ul className="try__reqs mono">
              <li>{prerequisites[0]}, open in the directory that holds your app</li>
              {prerequisites.slice(1).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Disclosure>
        </section>

        <section className="try__path">
          <div className="try__path-head">
            <span className="try__path-n mono">B</span>
            <h2 className="try__path-title">Set it up yourself</h2>
            <span className="mono home__aside">nuon CLI · {commands} commands</span>
          </div>
          <ol className="try__steps">
            {steps.map((step, i) => (
              <li key={step.label} className="try__step">
                <span className="try__step-n mono">{i + 1}</span>
                <span className="try__step-body">
                  <span className="mono try__step-label">{step.label}</span>
                  {step.cmd ? (
                    <span className="try__cmd">
                      <code className="mono">{step.cmd}</code>
                      <CopyButton text={step.cmd} />
                    </span>
                  ) : (
                    step.doc && (
                      <span className="try__cmd try__cmd--doc">
                        <OutLink href={step.doc.href} variant="plain">
                          <span className="mono">{step.doc.text}</span>
                        </OutLink>
                      </span>
                    )
                  )}
                </span>
              </li>
            ))}
          </ol>
          <div className="mono try__path-foot">
            or start from this app&rsquo;s config:{' '}
            <OutLink href={`https://github.com/${repoName}`} variant="plain">
              {repoName}
            </OutLink>
          </div>
        </section>
      </div>

      <div className="section__head try__cols-head">
        <h2 className="section__title">When your agent runs the paste</h2>
        <div className="subtext muted">from nuon-loop&rsquo;s README</div>
      </div>
      <div className="try__cols">
        <section className="try__col">
          <h2 className="try__col-title">You get</h2>
          {youGet.map((item) => (
            <div key={item.text} className="try__item">
              <Check />
              <span className="try__item-text">
                <NoBreakHyphens text={item.text} />
              </span>
              <span className="mono try__item-aside">{item.aside}</span>
            </div>
          ))}
          <div className="mono try__note">
            TOML you own · one commit per plan item · pasting again resumes
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
            stops at <b>{turnLimit} turns</b> · {min} to {max} turns to the handoff in {runs.length} runs
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

      <div className="mono try__source">
        {pasteSource.spec} · {pasteSource.file} @ {pasteSource.commit.slice(0, 7)} · {pasteSource.date}
      </div>
    </div>
  )
}
