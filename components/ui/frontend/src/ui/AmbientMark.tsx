import { MarkStack } from './LoadingOverlay'

/**
 * The rotating 3D dot-matrix Nuon mark from the boot overlay, docked
 * persistently on the right edge of the app. Purely decorative: it sits
 * behind the content layer, ignores the pointer, hides on narrow viewports,
 * and freezes under prefers-reduced-motion (all in app.css). The art itself
 * is the same MarkStack the overlay renders, so it exists in one place.
 */
export function AmbientMark() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__logo">
        <MarkStack patternId="ambient-dots" sliceClassName="ambient__slice" />
      </div>
    </div>
  )
}
