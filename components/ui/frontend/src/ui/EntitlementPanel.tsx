import type { ReactNode } from 'react'
import { Badge, CommandBlock, OutLink } from './Primitives'

/* ============================================================
   An entitlement at its point of use, shared by Events and Settings: the
   live state (read from the toggleable component's marker Service), the
   dashboard toggle and the CLI at equal billing while it is off, and the
   proof line once it is on. The real control lives in the Nuon dashboard;
   this panel is a readout that flips itself when the deploy lands.
   ============================================================ */

export function EntitlementPanel({
  title,
  componentName,
  on,
  justEnabled = false,
  waiting = false,
  onDashboardOpen,
  dashboardHref,
  cli,
  pitch,
  proof,
  pollSeconds,
}: {
  title: string
  /** The toggleable component's name, as the config spells it. */
  componentName: string
  on: boolean
  /** The component flipped on while this panel was on screen. */
  justEnabled?: boolean
  /** The visitor opened the dashboard toggle from here. */
  waiting?: boolean
  onDashboardOpen?: () => void
  dashboardHref?: string
  /** The CLI path to the same toggle, equal billing with the dashboard. */
  cli?: string
  /** One sentence shown while the entitlement is off. */
  pitch: ReactNode
  /** The marker-Service proof line shown once it is on. */
  proof: ReactNode
  /** How often the owning view re-reads the namespace while off. */
  pollSeconds: number
}) {
  return (
    <div className={on ? 'ent ent--on ent--panel' : 'ent ent--panel'}>
      {justEnabled && (
        <div className="ttt-unlocked-note">
          <Badge tone="positive" dot>
            just deployed
          </Badge>
          <span>
            The component deployed, its Service appeared in the namespace, and
            this panel noticed. No reload.
          </span>
        </div>
      )}
      <div className="ent__head">
        <span className="ent__plan">{title}</span>
        <span className="entstat mono" role="status">
          <span
            className={on ? 'entstat__dot entstat__dot--on' : 'entstat__dot'}
            aria-hidden="true"
          />
          {on ? 'on' : 'off · watching'}
        </span>
      </div>
      <div className="ent__name mono">{componentName}</div>
      {on ? (
        <>
          <div className="ent__foot">
            <Badge tone="positive" dot>
              Enabled on this install
            </Badge>
          </div>
          <p className="ent__pitch">{proof}</p>
        </>
      ) : (
        <>
          <p className="ent__pitch">{pitch}</p>
          <div className="ent__foot">
            {dashboardHref && (
              <OutLink href={dashboardHref} onClick={onDashboardOpen}>
                Turn it on in Nuon
              </OutLink>
            )}
          </div>
          {cli && (
            <CommandBlock
              label="or from your terminal"
              command={cli}
              note="The same toggle, through the CLI."
            />
          )}
          <div className="ttt-watch">
            {waiting ? (
              <>
                <Badge tone="warning" dot>
                  waiting for the deploy
                </Badge>
                <span>
                  Toggle the component on in the dashboard tab and deploy it;
                  this panel switches over when the Service appears.
                </span>
              </>
            ) : (
              <>
                <Badge tone="accent" dot>
                  watching live
                </Badge>
                <span>
                  Checking this namespace for the marker Service every{' '}
                  {pollSeconds} seconds.
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
