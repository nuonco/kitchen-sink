import { useState } from 'react'
import {
  useIntrospectPoll,
  type Envelope,
  type Loadable,
  type NamespaceResponse,
  type UIConfig,
} from '../../lib/api'
import { useCasePrompt, useCases } from '../../lib/prompts'
import { CopyButton, Icon } from '../Primitives'

/* ============================================================
   Shared by the proof panels: the namespace poll, id fallbacks for
   commands, a pod-age formatter, and the agent prompts assigned to a panel.
   ============================================================ */

/** How often a drawer re-reads the namespace while open. */
export const PANEL_POLL_MS = 10_000

export const installIdOf = (config: UIConfig) => config.install_id ?? '<your-install-id>'
export const appIdOf = (config: UIConfig) => config.app_id ?? '<your-app-id>'

export function useNamespacePoll(
  config: UIConfig,
  intervalMs = PANEL_POLL_MS,
): { namespace: string; ns: Loadable<Envelope<NamespaceResponse>> } {
  const namespace = config.namespace ?? 'kitchen-sink'
  const ns = useIntrospectPoll<NamespaceResponse>(
    `/api/introspect/namespace/${namespace}`,
    intervalMs,
    true,
  )
  return { namespace, ns }
}

export function podAge(ts?: string): string {
  if (!ts) return 'n/a'
  const ms = Date.now() - new Date(ts).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'n/a'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d`
}

/** The use-case prompts that exercise this panel's widget, each with a copy
    button and the full text behind one click. */
export function PanelPrompts({ panel, config }: { panel: string; config: UIConfig }) {
  const install = installIdOf(config)
  const app = appIdOf(config)
  const list = useCases.filter((u) => u.panel === panel)
  if (list.length === 0) return null
  return (
    <section className="section">
      <div className="section__head">
        <h3 className="section__title">Agent prompts</h3>
        <div className="subtext muted">
          {list.length} prompt{list.length === 1 ? '' : 's'} ·{' '}
          {config.install_id ? 'ids filled in' : 'ids not served; placeholders shown'}
        </div>
      </div>
      <div className="promptlist">
        {list.map((u) => (
          <PromptRow key={u.id} title={u.title} write={u.write} text={useCasePrompt(u, install, app)} />
        ))}
      </div>
    </section>
  )
}

function PromptRow({ title, write, text }: { title: string; write: boolean; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="promptrow">
      <div className="promptrow__head">
        <button
          type="button"
          className="promptrow__toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={open ? 'promptrow__caret promptrow__caret--open' : 'promptrow__caret'} aria-hidden="true">
            <Icon name="caret-right" />
          </span>
          <span className="promptrow__title">{title}</span>
        </button>
        <span className="mono promptrow__mode">{write ? 'write · --allow-writes' : 'read-only'}</span>
        <CopyButton text={text} />
      </div>
      {open && <pre className="cmd__pre agent-prompt__pre">{text}</pre>}
    </div>
  )
}
