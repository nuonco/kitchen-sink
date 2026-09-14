/**
 * The proof-panel registry. A panel is one live widget from the old step
 * pages with two renderings: a tile (one value and a label) for a case
 * screen's "On this install" strip, and a drawer holding the full widget.
 */
import type { ComponentType } from 'react'
import type { UIConfig } from './api'
import type { PanelId } from './cases'
import { ComponentsDrawer, ComponentsTile } from '../ui/panels/ComponentsPanel'
import { HealthDrawer, HealthTile } from '../ui/panels/HealthPanel'
import { PoliciesDrawer, PoliciesTile } from '../ui/panels/PoliciesPanel'
import { RolesDrawer, RolesTile } from '../ui/panels/RolesPanel'
import { RolloutDrawer, RolloutTile } from '../ui/panels/RolloutPanel'
import { RunbooksDrawer, RunbooksTile } from '../ui/panels/RunbooksPanel'
import { StackInputsDrawer, StackInputsTile } from '../ui/panels/StackInputsPanel'
import { TogglesDrawer, TogglesTile } from '../ui/panels/TogglesPanel'
import { WorkloadsDrawer, WorkloadsTile } from '../ui/panels/WorkloadsPanel'

export interface PanelProps {
  config: UIConfig
  /** The case screen the panel is mounted on, when it is. */
  caseBranch?: string
}

export interface ProofPanel {
  id: PanelId
  title: string
  /** What the drawer's header names as the source: a file or an endpoint. */
  source: string
  Tile: ComponentType<PanelProps>
  Drawer: ComponentType<PanelProps>
}

export const panels: Record<PanelId, ProofPanel> = {
  workloads: {
    id: 'workloads',
    title: 'Workloads',
    source: 'GET /api/introspect/namespace · /api/introspect/kube',
    Tile: WorkloadsTile,
    Drawer: WorkloadsDrawer,
  },
  components: {
    id: 'components',
    title: 'Components',
    source: 'components/*.toml',
    Tile: ComponentsTile,
    Drawer: ComponentsDrawer,
  },
  rollout: {
    id: 'rollout',
    title: 'Rollout',
    source: 'branch.toml',
    Tile: RolloutTile,
    Drawer: RolloutDrawer,
  },
  health: {
    id: 'health',
    title: 'Health',
    source: '[health] blocks · GET /api/introspect/namespace',
    Tile: HealthTile,
    Drawer: HealthDrawer,
  },
  runbooks: {
    id: 'runbooks',
    title: 'Runbooks',
    source: 'runbooks/*.toml · actions/*/nuon.toml',
    Tile: RunbooksTile,
    Drawer: RunbooksDrawer,
  },
  roles: {
    id: 'roles',
    title: 'Roles',
    source: 'permissions/*.toml · break_glass.toml',
    Tile: RolesTile,
    Drawer: RolesDrawer,
  },
  toggles: {
    id: 'toggles',
    title: 'Toggles',
    source: 'components/{audit_log_exporter,tictactoe}.toml · marker Services',
    Tile: TogglesTile,
    Drawer: TogglesDrawer,
  },
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

export const panelIds = Object.keys(panels) as PanelId[]

export const panelById = (id: string): ProofPanel | undefined =>
  (panels as Record<string, ProofPanel | undefined>)[id]
