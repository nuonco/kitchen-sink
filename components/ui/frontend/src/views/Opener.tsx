import { useEffect, useState, type ReactNode } from 'react'
import {
  runningImageTags,
  useIntrospectPoll,
  type NamespaceResponse,
  type UIConfig,
} from '../lib/api'
import { Icon, OutLink } from '../ui/Primitives'
import { InputsFlow, SourceFork, VersionTimeline } from '../ui/RelationshipDiagram'

/* ============================================================
   The opener: three slides shown on a first visit, before Home. The
   position is remembered in localStorage so a reload resumes; once the
   third slide is passed (or skipped) the key reads "done" and "/" opens
   Home. "/intro" replays the slides from the first.
   ============================================================ */

export const TOUR_KEY = 'kitchen-sink-tour'

const slides = ['source', 'inputs', 'versions'] as const
type Slide = (typeof slides)[number]

const APP_BRANCHES_DOCS = 'https://docs.nuon.co/concepts/app-branches'

/** True once a visitor has passed or skipped the opener in this browser.
    Older builds stored their own step names; any of those counts as done
    only if it was the tour's finish state. */
export function openerDone(): boolean {
  try {
    const value = window.localStorage.getItem(TOUR_KEY)
    // 'explore', 'toggle' and 'day2' were the finish states of earlier builds.
    return value === 'done' || value === 'explore' || value === 'toggle' || value === 'day2'
  } catch {
    return false
  }
}

export function markOpenerDone() {
  try {
    window.localStorage.setItem(TOUR_KEY, 'done')
  } catch {
    // No storage: the opener shows again next load.
  }
}

function storedSlide(): Slide {
  try {
    const value = window.localStorage.getItem(TOUR_KEY)
    if (value && (slides as readonly string[]).includes(value)) return value as Slide
  } catch {
    // Storage can be unavailable (private mode); start at the first slide.
  }
  return 'source'
}

function rememberSlide(slide: Slide) {
  try {
    window.localStorage.setItem(TOUR_KEY, slide)
  } catch {
    // Without storage the opener still works, it just forgets its place.
  }
}

function SlideHeader({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <header className="step-header">
      <div className="eyebrow eyebrow--accent">Kitchen sink demo</div>
      <h2>{title}</h2>
      {lede && <p className="step-header__lede">{lede}</p>}
    </header>
  )
}

export function Opener({
  config,
  onDone,
  fromStart = false,
}: {
  config: UIConfig
  onDone: () => void
  /** Ignore the remembered position and start at the first slide. */
  fromStart?: boolean
}) {
  const [slide, setSlide] = useState<Slide>(fromStart ? 'source' : storedSlide)

  // A replay from /intro keeps the stored marker as it is; only a first pass
  // records its position.
  useEffect(() => {
    if (!fromStart) rememberSlide(slide)
  }, [slide, fromStart])

  const namespace = config.namespace ?? 'kitchen-sink'
  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    20_000,
    true,
  )
  const runningTags = ns.state === 'ok' ? runningImageTags(ns.value.response.pods ?? []) : []

  const idx = slides.indexOf(slide)
  const go = (next: Slide) => {
    setSlide(next)
    window.scrollTo({ top: 0 })
  }
  const finish = () => {
    markOpenerDone()
    onDone()
  }
  const next = () => (idx === slides.length - 1 ? finish() : go(slides[idx + 1]))
  const back = () => go(slides[Math.max(idx - 1, 0)])

  // Arrow keys page the slides.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="tour__step opener" key={slide}>
      <div className="tour__topline">
        <span className="tour__progress">
          slide {idx + 1} of {slides.length}
        </span>
        <span className="tour__dots">
          {slides.map((s, i) => (
            <button
              key={s}
              type="button"
              className={
                i === idx
                  ? 'tour__dot tour__dot--active'
                  : i < idx
                    ? 'tour__dot tour__dot--done'
                    : 'tour__dot'
              }
              disabled={i > idx}
              aria-label={`slide ${i + 1} of ${slides.length}`}
              {...(i === idx ? { 'aria-current': 'step' as const } : {})}
              onClick={() => go(s)}
            />
          ))}
        </span>
        <button className="tour__skip" onClick={finish}>
          Skip <Icon name="arrow-right" />
        </button>
      </div>

      {slide === 'source' && (
        <>
          <SlideHeader title="Translating 1 pipeline into N customer deployments" />
          <SourceFork />
        </>
      )}

      {slide === 'inputs' && (
        <>
          <SlideHeader
            title="Support any customer environment with Nuon Apps"
            lede="The parts of your stack that will change between customers are what you need to templatize."
          />
          <InputsFlow />
        </>
      )}

      {slide === 'versions' && (
        <>
          <SlideHeader
            title="One config. Many customer environments, running updates they control"
            lede={
              <OutLink href={APP_BRANCHES_DOCS} variant="plain">
                Nuon app branches documentation
              </OutLink>
            }
          />
          <VersionTimeline
            installName={config.install_name}
            installId={config.install_id}
            runningTags={runningTags}
          />
        </>
      )}

      <div className="tour__actions">
        {idx > 0 && (
          <button className="btn btn--ghost" onClick={back}>
            <Icon name="arrow-left" /> Back
          </button>
        )}
        <button className="btn btn--primary" onClick={next}>
          {idx === slides.length - 1 ? 'Home' : 'Next'} <Icon name="arrow-right" />
        </button>
      </div>
    </div>
  )
}
