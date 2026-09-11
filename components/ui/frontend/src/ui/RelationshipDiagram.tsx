import {
  branchName,
  components,
  installGroups,
  repoName,
  type ComponentNode,
} from '../lib/config-data.gen'
import { GoldenPath } from './GoldenPath'

/* ============================================================
   One diagram, three bands, three states. The same repo-to-Nuon-to-clouds
   picture carries all three opener slides: stage 1 lights the repo and
   Nuon bands while the graph assembles, stage 2 zooms the highlighted
   install and nests the golden path inside it, stage 3 animates the
   reconcile edge out to every install group. Bands never unmount between
   stages — only emphasis, via the rel--stageN class, and the zoom.
   ============================================================ */

// Identifiers here are underscore_separated with no spaces, so a browser
// has nowhere to wrap them except mid-syllable. A zero-width space after
// each underscore gives it a real, readable break point instead — the
// characters shown are unchanged, only where a line may fold.
function softWrap(name: string): string {
  return name.replace(/_/g, '_​')
}

function groupByType(nodes: ComponentNode[]): Array<{ type: string; names: string[] }> {
  const order: string[] = []
  const byType = new Map<string, string[]>()
  for (const c of nodes) {
    if (!byType.has(c.type)) {
      byType.set(c.type, [])
      order.push(c.type)
    }
    byType.get(c.type)!.push(c.name)
  }
  return order.map((type) => ({ type, names: byType.get(type)! }))
}

const repoGroups = groupByType(components)

export function RelationshipDiagram({
  stage,
  cluster,
  region,
  podsReady,
  imageTags = [],
}: {
  stage: 1 | 2 | 3
  cluster?: string
  region?: string
  podsReady?: string
  imageTags?: string[]
}) {
  return (
    <div className={`rel rel--stage${stage}`}>
      <div className="rel__band rel__band--repo">
        <div className="rel__band-label">Your repo</div>
        <div className="rel__band-name mono">{repoName}</div>
        <div className="rel__band-facts">
          <span className="chip">{components.length} components</span>
          <span className="chip">branch {branchName}</span>
        </div>
        <div className="rel__groups">
          {repoGroups.map((g) => (
            <div className="rel__group" key={g.type}>
              <div className="rel__group-type mono">
                {softWrap(g.type)} · {g.names.length}
              </div>
              <div className="rel__group-names mono">
                {g.names.map(softWrap).join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rel__edge rel__edge--repo-nuon" aria-hidden="true">
        <span className="rel__edge-label">reads</span>
        <span className="rel__edge-line" />
      </div>

      <div className="rel__band rel__band--nuon">
        <div className="rel__band-label">Nuon</div>
        <div className="rel__band-name">dependency graph</div>
        <div className="rel__band-sub">templatized per environment</div>
      </div>

      <div className="rel__edge rel__edge--nuon-clouds" aria-hidden="true">
        <span className="rel__edge-label">push</span>
        <span className="rel__edge-line" />
      </div>

      <div className="rel__band rel__band--clouds">
        <div className="rel__band-label">Customer clouds</div>
        <div className="rel__installs">
          {/* No data ties this install to any one of installGroups — the
              app has no route to group-membership at all — so the
              highlighted node claims only what is true: it is an install
              of the template, full stop. The dimmed nodes are the rollout
              groups the template fans out to, tagged as groups so nobody
              reads "customers" as a second install's name. */}
          <div className="rel__install rel__install--this">
            <div className="rel__install-top">
              <span className="rel__install-tag">this install</span>
            </div>
            <div className="rel__install-facts">
              {cluster && <span className="chip">{cluster}</span>}
              {region && <span className="chip">{region}</span>}
              {podsReady && <span className="chip">{podsReady} pods ready</span>}
              {stage === 3 && imageTags.length > 0 && (
                <span className="chip">running {imageTags.join(' · ')}</span>
              )}
            </div>
            {stage === 2 && (
              // inert: this GoldenPath is a static illustration, not a second
              // navigator — it takes its buttons out of the tab order and
              // hides them from assistive tech without changing GoldenPath
              // itself, which stays fully operable wherever else it's used.
              <div className="rel__zoom" inert>
                <GoldenPath stage="branch" onPick={() => {}} />
              </div>
            )}
          </div>
          {installGroups.map((g) => (
            <div className="rel__install rel__install--sibling" key={g.name}>
              <span className="rel__install-group-tag">group</span>
              <span className="rel__install-label">{g.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
