import { useEffect, useRef, useState } from 'react'
import type { DeliveryEvent } from '../lib/api'
import { Disclosure } from './Primitives'

/* ============================================================
   Events per hour, computed client-side from the real events list. One
   series, so the section title names it and there is no legend; the y-axis
   ticks and the table view carry the values, the hover tooltip repeats the
   bar under the pointer.
   ============================================================ */

const HOUR = 3_600_000

interface Bucket {
  /** Start of the hour, ms. */
  t: number
  count: number
}

function hourFloor(ms: number): number {
  return Math.floor(ms / HOUR) * HOUR
}

function hourLabel(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:00`
}

/**
 * Hourly buckets over the last 24 hours. When the fetch hit the API's list
 * cap the fetched slice starts later than 24h ago; the window then starts at
 * the oldest fetched event so no hour reads as a false zero.
 */
export function bucketEvents(
  events: DeliveryEvent[],
  now: number,
  capped: boolean,
): Bucket[] {
  const nowHour = hourFloor(now)
  let startHour = nowHour - 23 * HOUR
  if (capped && events.length > 0) {
    const oldest = Date.parse(events[events.length - 1].created_at)
    if (!Number.isNaN(oldest)) startHour = Math.max(startHour, hourFloor(oldest))
  }
  const n = Math.floor((nowHour - startHour) / HOUR) + 1
  const buckets: Bucket[] = Array.from({ length: n }, (_, i) => ({
    t: startHour + i * HOUR,
    count: 0,
  }))
  for (const ev of events) {
    const t = Date.parse(ev.created_at)
    if (Number.isNaN(t) || t < startHour) continue
    const i = Math.floor((t - startHour) / HOUR)
    if (i >= 0 && i < n) buckets[i].count += 1
  }
  return buckets
}

/** The smallest clean axis ceiling at or above max. */
function niceCeil(max: number): number {
  if (max <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 2, 4, 5, 10]) {
    const c = m * pow
    if (c >= max && c % 2 === 0) return c
    if (c >= max && m === 5) return c
  }
  return 10 * pow
}

const PAD_LEFT = 36
const PAD_RIGHT = 8
const PAD_TOP = 10
const PAD_BOTTOM = 24
const HEIGHT = 200

export function VolumeChart({
  events,
  now,
  capped,
}: {
  events: DeliveryEvent[]
  now: number
  capped: boolean
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const buckets = bucketEvents(events, now, capped)
  const max = Math.max(...buckets.map((b) => b.count), 0)
  const yMax = niceCeil(max)
  const ticks = yMax % 2 === 0 ? [0, yMax / 2, yMax] : [0, yMax]

  const innerW = Math.max(0, width - PAD_LEFT - PAD_RIGHT)
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const baseY = PAD_TOP + innerH
  const band = buckets.length > 0 ? innerW / buckets.length : 0
  const barW = Math.max(2, Math.min(24, band * 0.7))
  const labelStep = Math.max(1, Math.ceil(buckets.length / 6))

  const yOf = (count: number) => baseY - (count / yMax) * innerH

  /** A bar with a 4px rounded data-end and a square baseline. */
  const barPath = (i: number, count: number): string => {
    const x = PAD_LEFT + i * band + (band - barW) / 2
    const top = yOf(count)
    const r = Math.min(4, barW / 2, (baseY - top) / 2)
    return [
      `M${x} ${baseY}`,
      `L${x} ${top + r}`,
      `Q${x} ${top} ${x + r} ${top}`,
      `L${x + barW - r} ${top}`,
      `Q${x + barW} ${top} ${x + barW} ${top + r}`,
      `L${x + barW} ${baseY}`,
      'Z',
    ].join(' ')
  }

  const activeBucket = active !== null ? buckets[active] : null
  const tooltipX =
    active !== null
      ? Math.min(Math.max(PAD_LEFT + active * band + band / 2, 60), Math.max(width - 60, 60))
      : 0

  return (
    <div>
      <div className="viz" ref={wrapRef}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Events per hour over the last ${buckets.length} hours`}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  className="viz__grid"
                  x1={PAD_LEFT}
                  x2={width - PAD_RIGHT}
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                />
                <text className="viz__tick" x={PAD_LEFT - 8} y={yOf(tick) + 3.5} textAnchor="end">
                  {tick}
                </text>
              </g>
            ))}
            <line
              className="viz__axis"
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={baseY}
              y2={baseY}
            />
            {buckets.map((b, i) =>
              b.count > 0 ? (
                <path
                  key={b.t}
                  className={active === i ? 'viz__bar viz__bar--active' : 'viz__bar'}
                  d={barPath(i, b.count)}
                />
              ) : null,
            )}
            {buckets.map((b, i) => {
              const last = i === buckets.length - 1
              // Modulo labels stop one step short of the end so the last
              // hour's label never collides with a neighbor.
              const show = last || (i % labelStep === 0 && buckets.length - 1 - i >= labelStep)
              if (!show) return null
              return (
                <text
                  key={`label-${b.t}`}
                  className="viz__tick"
                  x={last ? width - PAD_RIGHT : PAD_LEFT + i * band + band / 2}
                  y={HEIGHT - 6}
                  textAnchor={last ? 'end' : 'middle'}
                >
                  {hourLabel(b.t)}
                </text>
              )
            })}
            {buckets.map((b, i) => (
              <rect
                key={`hit-${b.t}`}
                className="viz__hit"
                x={PAD_LEFT + i * band}
                y={PAD_TOP}
                width={Math.max(band, 1)}
                height={innerH}
                tabIndex={0}
                aria-label={`${hourLabel(b.t)}: ${b.count} events`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((a) => (a === i ? null : a))}
              />
            ))}
          </svg>
        )}
        {activeBucket && (
          <div className="viz__tooltip" style={{ left: tooltipX }} role="status">
            <span className="viz__tooltip-value">{activeBucket.count}</span>
            <span className="viz__tooltip-label">
              {hourLabel(activeBucket.t)}–{hourLabel(activeBucket.t + HOUR)}
            </span>
          </div>
        )}
      </div>
      <Disclosure summary="Show as a table">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.t}>
                  <td className="mono subtext">{hourLabel(b.t)}</td>
                  <td className="mono">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </div>
  )
}
