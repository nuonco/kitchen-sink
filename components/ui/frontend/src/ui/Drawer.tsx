import { useEffect, type ReactNode } from 'react'
import { Icon } from './Primitives'

/* ============================================================
   The drawer a proof tile opens: the old step page's live widget, over a
   backdrop. Escape or the backdrop closes it. Which drawer is open lives
   in the route (?panel=<id>), so a deep link opens straight into one.
   ============================================================ */

export function Drawer({
  title,
  aside,
  onClose,
  children,
}: {
  title: string
  aside?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel">
        <div className="drawer__head">
          <h2 className="drawer__title">{title}</h2>
          {aside && <div className="drawer__aside mono">{aside}</div>}
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            <Icon name="arrow-right" />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
      </div>
    </div>
  )
}
