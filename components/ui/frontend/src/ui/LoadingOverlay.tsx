import { useEffect, useState, useSyncExternalStore } from 'react'
import { bootSettled, endBoot, subscribeBoot } from '../lib/boot'
import { nuonMarkPath } from './Primitives'
// The white Nuon wordmark PNG, transparent padding trimmed. Vite inlines it
// as a data URI (see assetsInlineLimit in vite.config.ts).
import logoWhite from './nuon-logo-white.png'

/* ============================================================
   Boot loading overlay, ported from labs.nuon.co (nuonco/mono,
   services/nuon-labs): a Nuon-blue glow that rises out of black while the
   first API fetches are in flight, plus the rotating 3D rendition of the
   Nuon mark that labs shows off to the side. The labs original drives a
   Paper shader (StaticRadialGradient, #006CFF on black, grain 0.37) and a
   hosted Unicorn Studio WebGL scene; this is a dependency-free recreation:
   a CSS radial gradient with an SVG-noise grain for the glow, and a stack
   of dot-matrix SVG slices spun with CSS 3D transforms for the logo.
   ============================================================ */

/** The glow's intro runs 200ms delay + 1800ms rise, like the labs intro. */
const MIN_SHOW_MS = 2400
/** Give up waiting on fetches after this long; the views show their own
    pending states anyway. */
const MAX_SHOW_MS = 8000
/** Matches the .loading opacity transition in app.css. */
const FADE_MS = 700

const SLICES = 14
const SLICE_GAP = 3.2

/**
 * The CSS-3D dot-matrix rendition of the Nuon mark: one dot-pattern SVG per
 * slice, fanned out along Z. Shared between the boot overlay and the ambient
 * mark docked on the right of the app itself, so the art exists once. The
 * pattern id is a parameter because both can be mounted at the same time
 * during boot.
 */
export function MarkStack({
  patternId,
  sliceClassName,
}: {
  patternId: string
  sliceClassName: string
}) {
  const slices = []
  for (let i = 0; i < SLICES; i++) {
    const z = (i - (SLICES - 1) / 2) * SLICE_GAP
    const face = i === 0 || i === SLICES - 1
    slices.push(
      <svg
        key={i}
        className={sliceClassName}
        viewBox="0 0 23.119 32"
        style={{ transform: `translateZ(${z}px)` }}
        aria-hidden="true"
      >
        <path
          d={nuonMarkPath}
          fill={`url(#${patternId})`}
          fillRule="nonzero"
          opacity={face ? 1 : 0.3}
        />
      </svg>,
    )
  }

  return (
    <>
      {/* Dot-matrix fill shared by every slice. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <pattern
            id={patternId}
            width="0.55"
            height="0.55"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0.275" cy="0.275" r="0.16" fill="#4c9fff" />
          </pattern>
        </defs>
      </svg>
      {slices}
    </>
  )
}

export function LoadingOverlay() {
  const [gone, setGone] = useState(false)
  const [fading, setFading] = useState(false)
  const [waited, setWaited] = useState(false)
  const settled = useSyncExternalStore(subscribeBoot, bootSettled)

  useEffect(() => {
    const min = setTimeout(() => setWaited(true), MIN_SHOW_MS)
    const max = setTimeout(() => setFading(true), MAX_SHOW_MS)
    return () => {
      clearTimeout(min)
      clearTimeout(max)
    }
  }, [])

  useEffect(() => {
    if (waited && settled) setFading(true)
  }, [waited, settled])

  useEffect(() => {
    if (!fading) return
    const done = setTimeout(() => {
      endBoot()
      setGone(true)
    }, FADE_MS)
    return () => clearTimeout(done)
  }, [fading])

  if (gone) return null

  return (
    <div
      className={fading ? 'loading loading--done' : 'loading'}
      role="status"
      aria-label="Loading the install"
    >
      <div className="loading__glow" />
      <div className="loading__grain" />
      <div className="loading__stage">
        <div className="loading__logo">
          <MarkStack patternId="loading-dots" sliceClassName="loading__slice" />
        </div>
      </div>
      <div className="loading__center">
        <img className="loading__mark" src={logoWhite} alt="Nuon" />
        <div className="loading__title">Periscope</div>
        {/* Name the work, not just the app: the overlay is literally waiting
            on the first introspection reads. */}
        <div className="loading__sub">Reading your install&hellip;</div>
      </div>
    </div>
  )
}
