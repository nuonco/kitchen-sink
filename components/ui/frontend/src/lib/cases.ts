/**
 * The three common requests, each one app branch of this repo. What the
 * request is lives here; what the branch changes comes from git through
 * case-deltas.gen.ts, so the screens can only show lines a branch contains.
 */
import type { UIConfig } from './api'
import { caseBranches, type CaseBranch } from './case-deltas.gen'
import { runbooks } from './config-data.gen'
import { guardrails } from './prompts'

export type CaseId = 'no-egress' | 'byo-vpc' | 'single-tenant'

export type PanelId =
  | 'workloads'
  | 'components'
  | 'rollout'
  | 'health'
  | 'runbooks'
  | 'roles'
  | 'toggles'
  | 'policies'
  | 'stack-inputs'

export interface CaseDef {
  /** Also the git branch and the Nuon app branch name. */
  branch: CaseId
  title: string
  /** Proof panels mounted under the diagram, in strip order. */
  panels: PanelId[]
  /** One sentence from docs.nuon.co under the diagram, with its page. Quotation
      marks appear only when the text is the page's, character for character. */
  quote: { text: string; url: string; label: string; verbatim: boolean }
  /** The one prompt for a coding agent, this install's ids filled in. */
  prompt: (config: UIConfig) => string
  /** What this request changes in the account picture; Home shows it while
      the request's tile or number is hovered. */
  difference: string
}

const installOf = (c: UIConfig) => c.install_id ?? '<your-install-id>'
const appOf = (c: UIConfig) => c.app_id ?? '<your-app-id>'

const healthSteps = runbooks.find((r) => r.name === 'full-health-check')?.steps.length ?? 0

export const cases: CaseDef[] = [
  {
    branch: 'no-egress',
    title: 'No egress',
    panels: ['policies', 'roles', 'workloads'],
    quote: {
      text: 'The Control Plane cannot push commands or open connections into customer accounts.',
      url: 'https://docs.nuon.co/security',
      label: 'docs.nuon.co/security',
      verbatim: true,
    },
    difference:
      'Outbound only: one HTTPS connection from the runner to Nuon, nothing inbound. The branch sets the EKS endpoint private and adds deny-nat.rego to the sandbox plan.',
    prompt: (c) => `${guardrails(installOf(c), appOf(c))}

Call get_install for install ${installOf(c)}, then list_install_components and get_component for each component. List every network path out of this install's AWS account and name the component that owns it: the runner's outbound connection to the Nuon API, image pulls, the public load balancer, and any URL a component's config reaches. One line per path. Read-only.`,
  },
  {
    branch: 'byo-vpc',
    title: 'Existing VPC',
    panels: ['stack-inputs', 'workloads', 'rollout', 'components'],
    quote: {
      text: 'The byo-vpc/default template accepts existing VPC and subnet IDs as parameters instead of creating them.',
      url: 'https://docs.nuon.co/concepts/stacks/customer-vpc',
      label: 'docs.nuon.co/concepts/stacks/customer-vpc',
      verbatim: false,
    },
    difference:
      'Their VPC: the stack takes VpcID and subnet ids from the customer and creates 0 VPCs. Runner and cluster land in their subnets, behind their routes and NAT.',
    prompt: (c) => `${guardrails(installOf(c), appOf(c))}

Call get_install for install ${installOf(c)} and get_install_inputs. The install stack created VPC ${c.vpc_id ?? '(read it from install_stack.outputs.vpc_id)'}. List what changes if this install moves into an existing VPC instead: the stack.toml template line (byo-vpc/default) and the Quick Create parameters the customer supplies (VpcID, PublicSubnetIDs, PrivateSubnetIDs, RunnerSubnetID). Show the plan as file edits. Apply nothing. Read-only.`,
  },
  {
    branch: 'single-tenant',
    title: 'Single-tenant, vendor-run',
    panels: ['health', 'runbooks', 'roles', 'toggles', 'rollout'],
    quote: {
      text: 'No cross-account access is required.',
      url: 'https://docs.nuon.co/architecture/platform',
      label: 'docs.nuon.co/architecture/platform',
      verbatim: true,
    },
    difference:
      'One AWS account per customer, one install each. You operate every install through runbooks and actions on its runner: no ssh, no kubeconfig, no credentials handed out.',
    prompt: (c) => `${guardrails(installOf(c), appOf(c))}

run_runbook is a write tool, hidden unless the proxy runs with --allow-writes. If it is listed, call it for full-health-check after my "yes"; if not, after my "yes" run:
nuon runbooks create-run --install-id ${installOf(c)} --runbook-id full-health-check --output agent
Then call list_workflows for install ${installOf(c)}, find that run, and watch_workflow until it ends. Summarize the transcript: each of its ${healthSteps} steps with its verdict, and the failing step if there is one.

Budget: exactly one run.`,
  },
]

/** The branch's diff against main and its own install groups, from git. */
export const caseBranch = (branch: string): CaseBranch | undefined => caseBranches[branch]

/** The group the branch ships to: the first group its branch.toml declares. */
export function shipsTo(branch: string): { name: string; order: number } | null {
  const g = caseBranch(branch)?.groups[0]
  return g ? { name: g.name, order: g.order } : null
}
