import { branchName, runbooks } from './config-data.gen'

/**
 * Everything the app hands to a visitor's coding agent (Claude Code, Cursor,
 * Amp), in one place so Home, the case screens and the proof panels say the
 * same thing.
 *
 * The prompts assume the Nuon MCP server is connected through the CLI's stdio
 * proxy (`nuon agents mcp`). They mirror two rules the CLI's own
 * `nuon agents context` prints: prefer MCP tools for reads and use
 * `--allow-writes` only when mutating; resolve names with list_* and get_*
 * tools, never invent ids. Where a step has no MCP tool (syncing local config,
 * config versions) the prompt says so and names the CLI command instead.
 */

/* ---------- Setup ---------- */

export const setup = {
  /** Registers the CLI's stdio proxy with Claude Code (`nuon agents mcp --help`). */
  claudeCode: 'claude mcp add --transport stdio nuon -- nuon agents mcp',
  /** Same, with the write tools visible to the agent. */
  claudeCodeWrites: 'claude mcp add --transport stdio nuon -- nuon agents mcp --allow-writes',
  /** Cursor has no add command: this goes in ~/.cursor/mcp.json (or .cursor/mcp.json). */
  cursor: `{
  "mcpServers": {
    "nuon": { "command": "nuon", "args": ["agents", "mcp"] }
  }
}`,
  amp: 'amp mcp add nuon -- nuon agents mcp',
  verify: 'nuon agents context',
} as const

/* ---------- Guardrails ---------- */

export function guardrails(install: string, app: string): string {
  return `You are driving Nuon for MY app and MY install, in my own Nuon org, through the
"nuon" MCP server (the Nuon CLI's stdio proxy). The CLI is already authenticated on
this machine; do not ask me for, print, or export any token.

Hard limits:
- Only this app and install: app ${app}, install ${install}.
- Prefer MCP tools for reads. Tools whose description starts with "WRITE OPERATION:"
  are hidden unless the proxy runs with --allow-writes; if one is missing, say so
  instead of working around it.
- Resolve names with list_* and get_* tools first. Never invent an id.
- NEVER create, delete, deprovision, or tear down installs, apps, components, or
  branches.
- Before EVERY write: show me exactly what will change and wait for my explicit
  "yes". After every call, show me the result in plain words.
- If a step has no MCP tool, fall back to the Nuon CLI with --output agent and
  --read-only, and tell me that is what you are doing.`
}

/* ---------- The use-case gallery ---------- */

export interface UseCase {
  id: string
  /** The question, in the visitor's words. */
  title: string
  /** MCP tools the prompt exercises, in order. */
  tools: string[]
  /** True when a tool in the chain is a write (needs --allow-writes). */
  write: boolean
  /** What the answer looks like on this install. */
  answer: string
  /** The proof panel whose drawer carries this prompt. */
  panel: string
  prompt: (install: string, app: string) => string
}

export const useCases: UseCase[] = [
  {
    id: 'orient',
    panel: 'workloads',
    title: 'Where am I, and what installs do I have?',
    tools: ['whoami', 'list_installs', 'get_install'],
    write: false,
    answer:
      'Your org, every install in it, and this one’s sandbox, runner, and component status, in three sentences.',
    prompt: (install) => `Call whoami, then list_installs, then get_install for install ${install}.
Tell me which org I am in, which installs exist, and this install's sandbox, runner,
and component status, in three sentences. Read-only.`,
  },
  {
    id: 'rollout',
    panel: 'rollout',
    title: 'Did the last rollout succeed, and what changed?',
    tools: ['list_app_branches', 'get_app_branch'],
    write: false,
    answer:
      'The branch’s last run, whether it succeeded, and the config sections and git files that changed.',
    prompt: (_install, app) => `Call list_app_branches for app ${app}, then get_app_branch for its "${branchName}" branch.
Report answers.last_run_succeeded, answers.change_summary, and answers.deployment_summary
in plain words: did it succeed, what changed, and how far did each group get. Read-only.`,
  },
  {
    id: 'group',
    panel: 'rollout',
    title: 'Which group is this install in, and how far has the rollout gotten?',
    tools: ['get_app_branch'],
    write: false,
    answer:
      'The install group this install belongs to and its per-install deploy status from the last run.',
    prompt: (install, app) => `Call get_app_branch for app ${app}, branch "${branchName}". Look through
install_groups and the latest run's per-install deployment status for install ${install}.
Tell me which group it is in and where the last rollout got for it. If it is in no
group, say so plainly. Read-only.`,
  },
  {
    id: 'preview',
    panel: 'rollout',
    title: 'Preview a pull request against my install before anyone merges it.',
    tools: [
      'list_app_branch_preview_sources',
      'preview_app_branch',
      'watch_workflow',
      'get_app_branch',
    ],
    write: true,
    answer:
      'A plan-only run of that pull request’s config against this install, and what it would change.',
    prompt: (install, app) => `Call list_app_branch_preview_sources for app ${app}, branch "${branchName}", and show me
the open pull requests. I will pick one. Then, only after my "yes", call
preview_app_branch with that pr_number, install ${install}, and mode plan-only.
Never use mode apply unless I ask for it in a separate message. Follow the run with
watch_workflow and get_app_branch, and tell me what it would change. This needs the
proxy started with --allow-writes.`,
  },
  {
    id: 'approve',
    panel: 'rollout',
    title: 'Is anything waiting on me? Approve the held group.',
    tools: ['get_pending_approvals', 'approve_step'],
    write: true,
    answer:
      'Each step waiting for a person, what it would apply, and one approval when you say so.',
    prompt: (install) => `Call get_pending_approvals and list every step waiting on a person for install
${install} or its app branch, with what each one would apply. Approve nothing yet.
When I say "yes" for a specific step, call approve_step for that step only. This
needs the proxy started with --allow-writes.`,
  },
  {
    id: 'debug',
    panel: 'health',
    title: 'Why did that deploy fail?',
    tools: [
      'list_workflows',
      'get_workflow',
      'get_workflow_step',
      'get_workflow_step_logs',
      'get_deploy_logs',
      'get_build_logs',
    ],
    write: false,
    answer:
      'The failing step, its logs, and a three-line explanation with the likely fix.',
    prompt: (install) => `Call list_workflows for install ${install} and find the most recent failed or
stuck workflow. Call get_workflow, then get_workflow_step for the failing step, then
the matching logs tool (get_workflow_step_logs, get_deploy_logs, or get_build_logs).
Explain the failure in three lines and the most likely fix. Read-only. If nothing has
failed, say so and show me the last successful one instead.`,
  },
  {
    id: 'action',
    panel: 'runbooks',
    title: 'Run the debug action and summarize what it found.',
    tools: ['list_install_actions', 'get_action', 'run_action', 'watch_workflow'],
    write: true,
    answer:
      'Pod state, warning events, and API logs from inside the cluster, collected by the runner.',
    prompt: (install) => `Call list_install_actions for install ${install} and find the action named
"debug". Show me what it does (get_action). After my "yes", call run_action for it,
follow with watch_workflow, and summarize the diagnostic bundle: pod state, warning
events, API logs. It is read-only inside the cluster, but starting a run is a
write, so this needs the proxy started with --allow-writes.`,
  },
  {
    id: 'inputs',
    panel: 'stack-inputs',
    title: 'Show me this install’s inputs; change one and redeploy.',
    tools: ['get_install_inputs', 'update_install_inputs', 'deploy_install_components', 'watch_workflow'],
    write: true,
    answer:
      'The current input values, one change applied, and the components that redeployed because of it.',
    prompt: (install) => `Call get_install_inputs for install ${install} and show me every input with its
current value. Propose one reversible change and say which components it
affects. Only after my "yes": update_install_inputs, then deploy_install_components,
then watch_workflow until it finishes. This needs the proxy started with
--allow-writes.`,
  },
  {
    id: 'runbooks',
    panel: 'runbooks',
    title: 'Which runbooks exist here, and what do they do?',
    tools: ['list_runbooks', 'get_runbook'],
    write: false,
    answer:
      `${runbooks.length} procedures with their steps, split into read-only diagnostics and the ones that apply changes.`,
    prompt: (install, app) => `Call list_runbooks for app ${app}, then get_runbook for each one. Tell me which
are read-only diagnostics and which apply changes, and what each step does. run_runbook
is a write tool, hidden unless the proxy runs with --allow-writes; if it is not listed and I
want to run one, give me the CLI command:
nuon runbooks create-run --install-id ${install} --runbook-id <name> --output agent`,
  },
  {
    id: 'watch',
    panel: 'health',
    title: 'Watch this run until it finishes.',
    tools: ['list_workflows', 'watch_workflow'],
    write: false,
    answer: 'A live tail of the run’s steps and a one-line verdict when it ends.',
    prompt: (install) => `Call list_workflows for install ${install}, pick the most recent running workflow
(or the one you just started), and call watch_workflow on it. Tell me each step as it
completes and, when it ends, whether it succeeded. Read-only.`,
  },
]

/** A single use case with the guardrails on top: what a card's Copy button hands over. */
export function useCasePrompt(useCase: UseCase, install: string, app: string): string {
  return `${guardrails(install, app)}

${useCase.prompt(install, app)}`
}
