import { branchName, installGroups } from '../lib/config-data.gen'

/* ============================================================
   The golden-path diagram, revealed one part at a time. Parts the tour has
   not reached yet render as ghosts, so each step stays one idea while still
   hinting at the shape of the whole. Revealed parts are clickable and jump
   the tour to that part's step. The fourth part sits outside the customer's
   account: the app branch everything inside it ships from.
   ============================================================ */

type PartKey = 'sandbox' | 'components' | 'runner' | 'branch'

const partOrder: PartKey[] = ['sandbox', 'components', 'runner', 'branch']

export function GoldenPath({
  stage,
  onPick,
}: {
  stage: PartKey
  onPick: (part: PartKey) => void
}) {
  const revealed = partOrder.indexOf(stage)

  const nodeClass = (part: PartKey) => {
    const i = partOrder.indexOf(part)
    if (i > revealed) return 'arch__node arch__node--ghost'
    if (part === stage) return 'arch__node arch__node--active'
    return 'arch__node'
  }

  const fleetGhost = revealed < partOrder.indexOf('branch')

  return (
    <div className="arch">
      <div
        className={
          stage === 'sandbox' ? 'arch__sandbox arch__sandbox--active' : 'arch__sandbox'
        }
      >
        <button
          type="button"
          className="arch__boundary"
          onClick={() => onPick('sandbox')}
        >
          <span className="arch__num">01</span>
          <span className="arch__name">Sandbox</span>
          <span className="arch__hint">VPC · EKS · DNS</span>
        </button>
        <div className="arch__nodes">
          <button
            type="button"
            className={nodeClass('components')}
            disabled={revealed < 1}
            onClick={() => onPick('components')}
          >
            <span className="arch__num">02</span>
            <span className="arch__name">Components</span>
            <span className="arch__hint">kitchen_sink chart</span>
          </button>
          <div
            className={revealed < 2 ? 'arch__edge arch__edge--ghost' : 'arch__edge'}
            aria-hidden="true"
          >
            <span className="arch__edge-label">deploys</span>
            <span className="arch__edge-line" />
          </div>
          <button
            type="button"
            className={nodeClass('runner')}
            disabled={revealed < 2}
            onClick={() => onPick('runner')}
          >
            <span className="arch__num">03</span>
            <span className="arch__name">Runner</span>
            <span className="arch__hint">deploys here</span>
          </button>
        </div>
      </div>
      <div className={fleetGhost ? 'arch__fleet arch__fleet--ghost' : 'arch__fleet'}>
        <div className="arch__edge arch__edge--up" aria-hidden="true">
          <span className="arch__edge-line" />
          <span className="arch__edge-label">shipped from</span>
        </div>
        <button
          type="button"
          className={`${nodeClass('branch')} arch__node--fleet`}
          disabled={fleetGhost}
          onClick={() => onPick('branch')}
        >
          <span className="arch__num">04</span>
          <span className="arch__name">Branch {branchName}</span>
          <span className="arch__hint">
            {installGroups.map((g) => g.name).join(' → ')}
          </span>
        </button>
      </div>
    </div>
  )
}
