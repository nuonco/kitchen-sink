import type { UIConfig } from '../lib/api'

/* ============================================================
   The golden-path diagram, static and complete: sandbox as the containing
   boundary, components and runner as nodes inside it. No tour staging, no
   clicks — the product-inside-product picture on #/nuon. The drawer keeps
   its own smaller variant.
   ============================================================ */

export function GoldenPathStatic({ config }: { config: UIConfig }) {
  return (
    <>
      <div className="arch arch--static" aria-label="What Nuon put in the account">
        <div className="arch__sandbox">
          <span className="arch__boundary">
            <span className="arch__num">01</span>
            <span className="arch__name">Sandbox</span>
            <span className="arch__hint">VPC · EKS · DNS</span>
          </span>
          <div className="arch__nodes">
            <span className="arch__node">
              <span className="arch__num">02</span>
              <span className="arch__name">Components</span>
              <span className="arch__hint">periscope chart</span>
            </span>
            <div className="arch__edge" aria-hidden="true">
              <span className="arch__edge-label">deploys</span>
              <span className="arch__edge-line" />
            </div>
            <span className="arch__node">
              <span className="arch__num">03</span>
              <span className="arch__name">Runner</span>
              <span className="arch__hint">builds &amp; deploys here</span>
            </span>
          </div>
        </div>
      </div>
      {(config.cluster_name || config.region) && (
        <div className="row" style={{ marginTop: 16 }}>
          {config.cluster_name && (
            <span className="chip">cluster {config.cluster_name}</span>
          )}
          {config.region && <span className="chip">{config.region}</span>}
        </div>
      )}
    </>
  )
}
