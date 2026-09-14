/**
 * The proof-panel registry. A panel is one live widget from the old step
 * pages with two renderings: a tile (one value and a label) for a case
 * screen's "On this install" strip, and a drawer holding the full widget.
 */
import type { ComponentType } from 'react'
import type { UIConfig } from './api'
import type { PanelId } from './cases'
import { PoliciesDrawer, PoliciesTile } from '../ui/panels/PoliciesPanel'
import { StackInputsDrawer, StackInputsTile } from '../ui/panels/StackInputsPanel'

export interface PanelProps {
  config: UIConfig
}

export interface ProofPanel {
  id: PanelId
  title: string
  /** What the drawer's header names as the source: a file or an endpoint. */
  source: string
  Tile: ComponentType<PanelProps>
  Drawer: ComponentType<PanelProps>
}

export const panels: Partial<Record<PanelId, ProofPanel>> = {
  policies: {
    id: 'policies',
    title: 'Policies',
    source: 'policies/*.toml',
    Tile: PoliciesTile,
    Drawer: PoliciesDrawer,
  },
  'stack-inputs': {
    id: 'stack-inputs',
    title: 'Stack and inputs',
    source: 'stack.toml · sandbox.toml · inputs/',
    Tile: StackInputsTile,
    Drawer: StackInputsDrawer,
  },
}

export const panelById = (id: string): ProofPanel | undefined =>
  (panels as Record<string, ProofPanel | undefined>)[id]
