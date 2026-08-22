import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Loadable } from '../lib/api'
import { useNavigate } from '../lib/router'
import { iconPaths } from './icons'

/** The Nuon mark's outline, shared with the boot loader's 3D rendition. */
export const nuonMarkPath =
  'M 16.994 0 L 10.87 3.537 L 10.87 9.263 L 5.912 6.398 L 5.91 6.398 L 0 9.811 L 0 28.588 L 5.907 32 L 5.91 32 L 12.251 28.336 L 12.251 22.862 L 16.994 25.599 L 23.119 22.062 L 23.119 3.537 L 16.994 0 Z M 1.384 10.61 L 5.907 8 L 5.91 8 L 10.867 10.862 L 10.867 20.463 L 1.384 14.989 L 1.384 10.61 Z M 10.867 27.537 L 5.907 30.398 L 1.384 27.788 L 1.384 16.588 L 10.867 22.062 L 10.867 27.537 L 10.867 27.537 Z M 21.734 21.26 L 16.994 23.997 L 12.254 21.263 L 12.254 11.661 L 21.737 17.136 L 21.737 21.26 L 21.734 21.26 Z M 21.734 15.537 L 12.251 10.062 L 12.251 4.336 L 16.994 1.599 L 21.734 4.336 L 21.734 15.537 Z'

/** The Nuon mark. currentColor, so it is white on these dark surfaces. */
export function NuonMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={(size * 23.119) / 32}
      height={size}
      viewBox="0 0 23.119 32"
      fill="none"
      aria-hidden="true"
    >
      <path d={nuonMarkPath} fill="currentColor" fillRule="nonzero" />
    </svg>
  )
}

export function Icon({ name }: { name: string }) {
  const path = iconPaths[name]
  if (!path) return null
  return (
    <svg className="icon" viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

/** @deprecated Product pages carry no kickers; the guide index keeps plain
 * numerals via the class directly. Left for the pages not yet migrated. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>
}

/** Every product page opens the same way: a 24px h1 and one sentence. */
export function PageHeader({
  title,
  lede,
}: {
  title: string
  lede?: ReactNode
}) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </header>
  )
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="mono">{children}</span>
}

/**
 * A dashboard stat tile: label over a hero number over a note, live counts
 * only. A missing value renders an em-dash (the read has not resolved), never
 * a spinner. Status is never color-alone: `warn` pairs the warning color with
 * a drawn dot, and the label carries the word.
 */
export function StatTile({
  label,
  value,
  note,
  href,
  external = false,
  warn = false,
}: {
  label: string
  value?: ReactNode
  note?: ReactNode
  href?: string
  external?: boolean
  warn?: boolean
}) {
  const pending = value === null || value === undefined || value === ''
  const cls = ['stat', href ? 'stat--link' : ''].filter(Boolean).join(' ')
  const valueCls = [
    'stat__value',
    pending ? 'stat__value--pending' : '',
    warn && !pending ? 'stat__value--warn' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const body = (
    <>
      <span className="stat__label">{label}</span>
      <span className={valueCls}>
        {warn && !pending && <span className="stat__dot" aria-hidden="true" />}
        {pending ? '—' : value}
      </span>
      {note && <span className="stat__note">{note}</span>}
    </>
  )
  if (href) {
    return (
      <a
        className={cls}
        href={href}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {body}
      </a>
    )
  }
  return <div className={cls}>{body}</div>
}

type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'accent'

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode
  tone?: Tone
  dot?: boolean
}) {
  const cls = tone === 'neutral' ? 'badge' : `badge badge--${tone}`
  return (
    <span className={cls}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  )
}

/** Maps a pod / namespace / release phase onto the status palette. */
export function PhaseBadge({ phase }: { phase?: string }) {
  const value = phase ?? 'unknown'
  const lower = value.toLowerCase()
  const tone: Tone =
    lower === 'running' || lower === 'active' || lower === 'deployed' || lower === 'succeeded'
      ? 'positive'
      : lower === 'failed' || lower === 'terminating'
        ? 'negative'
        : lower === 'pending'
          ? 'warning'
          : 'neutral'
  return (
    <Badge tone={tone} dot>
      {value}
    </Badge>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <button className="backlink" onClick={() => navigate(to)}>
      <Icon name="arrow-left" />
      {children}
    </button>
  )
}

/** An external link out to the Nuon dashboard or docs. */
export function OutLink({
  href,
  children,
  variant = 'primary',
  onClick,
}: {
  href?: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'plain'
  /** Fires alongside the navigation (the link still opens in a new tab). */
  onClick?: () => void
}) {
  if (!href) return null
  if (variant === 'plain') {
    return (
      <a href={href} target="_blank" rel="noreferrer" onClick={onClick}>
        {children} <Icon name="arrow-up-right" />
      </a>
    )
  }
  return (
    <a
      className={`btn btn--${variant}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
    >
      {children}
      <Icon name="arrow-square-out" />
    </a>
  )
}

export function Section({
  title,
  aside,
  children,
  id,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
  id?: string
}) {
  return (
    <section className="section" id={id}>
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        {aside && <div className="subtext muted">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

/* ============================================================
   Every feature page runs the same three beats: Problem (where this bites),
   Solution (the config that answers it), Proof (test it on this install,
   right now). The tags make the pattern visible without a paragraph.
   ============================================================ */

export type PspKind = 'problem' | 'solution' | 'proof'

export function PspTag({ kind }: { kind: PspKind }) {
  return <span className={`psp-tag psp-tag--${kind}`}>{kind}</span>
}

export function PspSection({
  kind,
  title,
  aside,
  children,
}: {
  kind: PspKind
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="section">
      <div className="section__head">
        <PspTag kind={kind} />
        <h2 className="section__title">{title}</h2>
        {aside && <div className="subtext muted">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

export function Callout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="callout">
      <div className="callout__label">{label}</div>
      {children}
    </div>
  )
}

/**
 * The second and last disclosure level in any view: a collapsed pane holding
 * the raw response, or the real config, behind one click.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string
  children: ReactNode
  /** Start expanded (e.g. when a deep link targets what's inside). */
  defaultOpen?: boolean
}) {
  return (
    <details className="disclosure" open={defaultOpen || undefined}>
      <summary>
        <Icon name="caret-right" />
        {summary}
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  )
}

export function RawJSON({ value, label }: { value: unknown; label?: string }) {
  return (
    <Disclosure summary={label ?? 'Raw JSON response'}>
      <pre className="raw">{JSON.stringify(value, null, 2)}</pre>
    </Disclosure>
  )
}

export function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <Disclosure summary={label}>
      <pre className="raw">{code}</pre>
    </Disclosure>
  )
}

/** Puts `text` on the clipboard, with a fallback for older browsers. */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

export function CopyButton({
  text,
  label = 'Copy',
  doneLabel = 'Copied',
  big = false,
}: {
  text: string
  label?: string
  doneLabel?: string
  big?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const cls = [
    'copy-btn',
    copied ? 'copy-btn--done' : '',
    big ? 'copy-btn--big' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      className={cls}
      onClick={() => {
        void copyText(text).then(() => {
          setCopied(true)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setCopied(false), 1800)
        })
      }}
    >
      {copied ? doneLabel : label}
    </button>
  )
}

/**
 * A real command to run in the reader's own terminal: shown in full, with a
 * copy button. The command text is exactly what gets copied.
 */
export function CommandBlock({
  label,
  command,
  note,
}: {
  label?: string
  command: string
  note?: ReactNode
}) {
  return (
    <div className="cmd">
      <div className="cmd__head">
        {label && <span className="cmd__label">{label}</span>}
        <CopyButton text={command} />
      </div>
      <pre className="cmd__pre">{command}</pre>
      {note && <div className="cmd__note">{note}</div>}
    </div>
  )
}

/**
 * Renders the loading and failure states for a live introspection call. The
 * failure copy distinguishes "the API answered with an error" from "the API
 * never answered", because in this app those have different causes.
 */
export function LoadState({
  result,
  what,
}: {
  result: Loadable<unknown>
  what: string
}) {
  if (result.state === 'loading') {
    return (
      <div className="status">
        <div className="stack" style={{ maxWidth: 360 }}>
          <div className="skeleton" style={{ width: '70%' }} />
          <div className="skeleton" style={{ width: '90%' }} />
          <div className="skeleton" style={{ width: '45%' }} />
        </div>
      </div>
    )
  }

  if (result.state === 'error') {
    return (
      <div className="status status--error">
        <div className="status__title">Could not read {what}.</div>
        {result.unreachable ? (
          <p className="small">
            This app could not get an answer out of the introspection API at all.
            The API runs as a single pod with a 256Mi memory limit, so the usual
            causes are the pod restarting or a large introspection call
            exhausting that limit. Everything else on this page still works.
          </p>
        ) : (
          <p className="small">
            The introspection API answered with an error. Its handlers surface
            the underlying failure directly, so the detail below is the real
            cause, usually a missing Kubernetes permission.
          </p>
        )}
        <p className="status__detail" style={{ marginTop: 8 }}>
          {result.message}
        </p>
      </div>
    )
  }

  return null
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="status">{children}</div>
}
