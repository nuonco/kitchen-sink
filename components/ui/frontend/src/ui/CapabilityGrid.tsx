import type { Capability, Category, Mode } from '../lib/taxonomy'
import { useNavigate } from '../lib/router'
import { Badge, Icon } from './Primitives'

/* ============================================================
   The capability hub grid, rendered from the one taxonomy in
   lib/taxonomy.ts. The hover treatment is ported from nuon.co/product's
   PixelCard: the card lifts, a cyan border snaps on, a dithered checkerboard
   shadow appears offset bottom-right, and the title turns cyan with a pixel
   arrow sliding in.
   ============================================================ */

/** nuon.co's pixel arrow (PixelArrow.astro, direction "right"). */
function PixelArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="0" y="0" width="3" height="3" fill="currentColor" />
      <rect x="3" y="3" width="3" height="3" fill="currentColor" />
      <rect x="6" y="6" width="3" height="3" fill="currentColor" />
      <rect x="3" y="9" width="3" height="3" fill="currentColor" />
      <rect x="0" y="12" width="3" height="3" fill="currentColor" />
    </svg>
  )
}

export function ModeBadge({ mode }: { mode: Mode }) {
  if (mode === 'live') {
    return (
      <Badge tone="positive" dot>
        live
      </Badge>
    )
  }
  if (mode === 'simulation') {
    return (
      <Badge tone="warning" dot>
        simulation
      </Badge>
    )
  }
  return <Badge>guide</Badge>
}

function CapabilityCard({
  item,
  tictactoe,
}: {
  item: Capability
  tictactoe?: boolean
}) {
  const navigate = useNavigate()
  return (
    <button className="action" onClick={() => navigate(item.to)}>
      <span className="action__mode">
        <ModeBadge mode={item.mode} />
      </span>
      <span className="action__icon">
        {item.icon === 'toggle' ? (
          <span
            className={
              tictactoe ? 'switch switch--sm switch--on' : 'switch switch--sm'
            }
            aria-hidden="true"
          />
        ) : (
          <Icon name={item.icon} />
        )}
      </span>
      <span className="action__title">
        <span className="action__arrow" aria-hidden="true">
          <PixelArrow />
        </span>
        {item.title}
      </span>
      <span className="action__desc">{item.desc}</span>
      <span className="action__shadow action__shadow--right" aria-hidden="true" />
      <span className="action__shadow action__shadow--bottom" aria-hidden="true" />
      <span className="action__shadow action__shadow--corner" aria-hidden="true" />
    </button>
  )
}

export function CapabilityGroups({
  categories,
  tictactoe,
}: {
  categories: Category[]
  tictactoe?: boolean
}) {
  return (
    <>
      {categories.map((category) => (
        <section className="hub-group" key={category.key}>
          <div className="hub-group__head">
            <h2 className="hub-group__title">{category.title}</h2>
            <p className="hub-group__blurb">{category.blurb}</p>
          </div>
          <div className="actions">
            {category.items.map((item) => (
              <CapabilityCard key={item.to} item={item} tictactoe={tictactoe} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
