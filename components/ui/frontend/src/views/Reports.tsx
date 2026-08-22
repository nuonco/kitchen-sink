import type { UIConfig } from '../lib/api'
import {
  adhocActions,
  postDeployRunbooks,
  runbooks,
} from '../lib/config-data.gen'
import {
  CommandBlock,
  EmptyByDesign,
  Mono,
  OutLink,
  PageHeader,
  Section,
} from '../ui/Primitives'
import { ProofPrompt, Tracks } from './Customize'

/* ============================================================
   The report archive, narrated honestly: the console holds no cloud
   credentials, so it never lists the bucket — it states what the archive
   holds by design (all of it config-derived) and hands the reader the two
   real ways to see the objects. No fabricated listing, ever.
   ============================================================ */

function PrefixCard({
  prefix,
  writer,
  cadence,
  object,
}: {
  prefix: string
  writer: React.ReactNode
  cadence: React.ReactNode
  object: React.ReactNode
}) {
  return (
    <div className="prefixcard">
      <div className="prefixcard__name mono">{prefix}</div>
      <dl className="prefixcard__facts">
        <div className="prefixcard__fact">
          <dt>writer</dt>
          <dd>{writer}</dd>
        </div>
        <div className="prefixcard__fact">
          <dt>cadence</dt>
          <dd>{cadence}</dd>
        </div>
        <div className="prefixcard__fact">
          <dt>object</dt>
          <dd>{object}</dd>
        </div>
      </dl>
    </div>
  )
}

export function Reports({ config }: { config: UIConfig }) {
  const install = config.install_id
  const installArg = install ?? '<your-install-id>'
  const bucket = install ? `periscope-reports-${install}` : undefined

  // Everything below renders from the generated app config, never hand-copied.
  const fullHealth = runbooks.find((r) => r.name === 'full-health-check')
  const archiveReport = fullHealth?.steps.find((s) => s.name === 'archive-report')
  const afterEveryDeploy = postDeployRunbooks.includes('full-health-check')
  const heartbeat = adhocActions.find((a) => a.name === 'uptime_heartbeat')
  const heartbeatCron = heartbeat?.triggers.find((t) => t.startsWith('cron'))
  const debugBundle = runbooks.find((r) => r.name === 'debug-bundle')
  const archiveBundle = debugBundle?.steps.find((s) => s.name === 'archive-bundle')

  return (
    <>
      <PageHeader
        title="Reports"
        lede={
          bucket ? (
            <>
              The runner archives this install&rsquo;s reports in{' '}
              <Mono>{bucket}</Mono> &mdash; encrypted, versioned.
            </>
          ) : (
            'The install’s report archive, written by the runner.'
          )
        }
      />

      <Section title="What the archive holds">
        <div className="prefixes">
          {fullHealth && archiveReport && (
            <PrefixCard
              prefix="health-reports/"
              writer={
                <>
                  the <Mono>{archiveReport.name}</Mono> step of{' '}
                  <Mono>{fullHealth.name}</Mono>
                </>
              }
              cadence={
                afterEveryDeploy ? (
                  <>
                    after every deploy (<Mono>post_deploy_runbooks</Mono>), so
                    the archive has held a real report since this
                    install&rsquo;s first deploy
                  </>
                ) : (
                  'on demand'
                )
              }
              object={
                <>
                  one timestamped report, <Mono>&lt;utc-timestamp&gt;.txt</Mono>
                </>
              }
            />
          )}
          {heartbeat && (
            <PrefixCard
              prefix="heartbeats/"
              writer={
                <>
                  the <Mono>{heartbeat.name}</Mono> action
                </>
              }
              cadence={
                heartbeatCron ? <Mono>{heartbeatCron}</Mono> : 'manual'
              }
              object={
                <>
                  one snapshot per run, <Mono>&lt;utc-timestamp&gt;.txt</Mono>
                </>
              }
            />
          )}
          {debugBundle && archiveBundle && (
            <PrefixCard
              prefix="debug-bundles/"
              writer={
                <>
                  the <Mono>{archiveBundle.name}</Mono> step of{' '}
                  <Mono>{debugBundle.name}</Mono>
                </>
              }
              cadence="on demand — the SOP you run when something's gone wrong"
              object={
                <>
                  one diagnostic tarball,{' '}
                  <Mono>&lt;utc-timestamp&gt;.tar.gz</Mono>
                </>
              }
            />
          )}
        </div>
      </Section>

      <Section title="List it">
        <EmptyByDesign>
          This console holds no cloud credentials, so it cannot list the
          bucket itself &mdash; writes happen on the runner under the{' '}
          <Mono>{installArg}-actions</Mono> role (put-and-list only).
        </EmptyByDesign>

        <Tracks
          agent={<ProofPrompt flow="reports" config={config} />}
          manual={
            <>
              <CommandBlock
                label="from the run transcript"
                command={`nuon runbooks create-run --install-id ${installArg} --runbook-id full-health-check`}
                note={
                  <>
                    Its final step lists the archive in the run transcript.
                    {config.links.runbooks && (
                      <>
                        {' '}
                        <OutLink href={config.links.runbooks} variant="plain">
                          Transcripts
                        </OutLink>
                      </>
                    )}
                  </>
                }
              />
              <CommandBlock
                label="from the bucket"
                command={`aws s3 ls s3://periscope-reports-${installArg}/ --recursive`}
                note="With credentials for the install account."
              />
            </>
          }
        />
      </Section>
    </>
  )
}
