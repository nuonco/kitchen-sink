import { branchName } from './config-data.gen'

/**
 * Everything the app hands to a visitor's coding agent (Claude Code, Cursor,
 * Amp), in one place so the agent page, the hub, and every feature page say
 * the same thing.
 *
 * The prompts assume the Nuon MCP server is connected through the CLI's stdio
 * proxy (`nuon agents mcp`). They mirror two rules the CLI's own
 * `nuon agents context` prints: prefer MCP tools for reads and use
 * `--allow-writes` only when mutating; resolve names with list_* and get_*
 * tools, never invent ids. Where a step has no MCP tool (running a runbook,
 * syncing local config, config versions) the prompt says so and names the
 * CLI or API command instead.
 */

/* ---------- Setup ---------- */

export const setup = {
  /** Writes a project-scoped .mcp.json in the current directory. */
  claudeCode: 'nuon agents mcp setup --platform claude-code',
  cursor: 'nuon agents mcp setup --platform cursor',
  amp: 'nuon agents mcp setup --platform amp',
  /** The client-side equivalent, if you would rather not touch the repo. */
  claudeMcpAdd: 'claude mcp add --transport stdio nuon -- nuon agents mcp',
  /** Same, with writes visible to the agent. */
  claudeMcpAddWrites:
    'claude mcp add --transport stdio nuon -- nuon agents mcp --allow-writes',
  verify: 'nuon agents context',
} as const

/* ---------- Guardrails ---------- */

function guardrails(install: string, app: string): string {
  return `You are driving Nuon for MY app and MY install, in my own Nuon org, through the
"nuon" MCP server (the Nuon CLI's stdio proxy). The CLI is already authenticated on
this machine; do not ask me for, print, or export any token.

Hard limits:
- Only this app and install: app kitchen-sink (${app}), install ${install}.
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
  /** The feature page that also carries this prompt, if any. */
  page?: string
  prompt: (install: string, app: string) => string
}

export const useCases: UseCase[] = [
  {
    id: 'orient',
    title: 'Where am I, and what installs do I have?',
    tools: ['whoami', 'list_installs', 'get_install'],
    write: false,
    answer:
      'Your org, every install in it, and this one’s sandbox, runner, and component status.',
    prompt: (install) => `Call whoami, then list_installs, then get_install for install ${install}.
Tell me which org I am in, which installs exist, and this install's sandbox, runner,
and component status, in three sentences. Read-only.`,
  },
  {
    id: 'rollout',
    title: 'Did the last rollout succeed, and what changed?',
    tools: ['list_app_branches', 'get_app_branch'],
    write: false,
    answer:
      'The branch’s last run, whether it succeeded, and the config sections and git files that changed.',
    page: '/customize/branches',
    prompt: (_install, app) => `Call list_app_branches for app ${app}, then get_app_branch for its "${branchName}" branch.
Report answers.last_run_succeeded, answers.change_summary, and answers.deployment_summary
in plain words: did it succeed, what changed, and how far did each group get. Read-only.`,
  },
  {
    id: 'group',
    title: 'Which group is this install in, and how far has the rollout gotten?',
    tools: ['get_app_branch'],
    write: false,
    answer:
      'The install group this install belongs to and its per-install deploy status from the last run.',
    page: '/customize/branches',
    prompt: (install, app) => `Call get_app_branch for app ${app}, branch "${branchName}". Look through
install_groups and the latest run's per-install deployment status for install ${install}.
Tell me which group it is in and where the last rollout got for it. If it is in no
group, say so plainly. Read-only.`,
  },
  {
    id: 'preview',
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
    page: '/customize/branches',
    prompt: (install, app) => `Call list_app_branch_preview_sources for app ${app}, branch "${branchName}", and show me
the open pull requests. I will pick one. Then, only after my "yes", call
preview_app_branch with that pr_number, install ${install}, and mode plan-only.
Never use mode apply unless I ask for it in a separate message. Follow the run with
watch_workflow and get_app_branch, and tell me what it would change. This needs the
proxy started with --allow-writes.`,
  },
  {
    id: 'approve',
    title: 'Is anything waiting on me? Approve the held group.',
    tools: ['get_pending_approvals', 'approve_step'],
    write: true,
    answer:
      'Each step waiting for a person, what it would apply, and one approval when you say so.',
    page: '/customize/branches',
    prompt: (install) => `Call get_pending_approvals and list every step waiting on a person for install
${install} or its app branch, with what each one would apply. Approve nothing yet.
When I say "yes" for a specific step, call approve_step for that step only. This
needs the proxy started with --allow-writes.`,
  },
  {
    id: 'debug',
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
    page: '/customize/health',
    prompt: (install) => `Call list_workflows for install ${install} and find the most recent failed or
stuck workflow. Call get_workflow, then get_workflow_step for the failing step, then
the matching logs tool (get_workflow_step_logs, get_deploy_logs, or get_build_logs).
Explain the failure in three lines and the most likely fix. Read-only. If nothing has
failed, say so and show me the last successful one instead.`,
  },
  {
    id: 'action',
    title: 'Run the debug action and summarize what it found.',
    tools: ['list_install_actions', 'get_action', 'run_action', 'watch_workflow'],
    write: true,
    answer:
      'Pod state, warning events, and recent logs from inside the cluster, collected by the runner.',
    page: '/customize/actions',
    prompt: (install) => `Call list_install_actions for install ${install} and find the action named
"debug". Show me what it does (get_action). After my "yes", call run_action for it,
follow with watch_workflow, and summarize the diagnostic bundle: pod state, warning
events, recent API logs. It is read-only inside the cluster, but starting a run is a
write, so this needs the proxy started with --allow-writes.`,
  },
  {
    id: 'inputs',
    title: 'Show me this install’s inputs; change one and redeploy.',
    tools: ['get_install_inputs', 'update_install_inputs', 'deploy_install_components', 'watch_workflow'],
    write: true,
    answer:
      'The current input values, one change applied, and the components that redeployed because of it.',
    page: '/customize/roles',
    prompt: (install) => `Call get_install_inputs for install ${install} and show me every input with its
current value. Propose one small, reversible change and say which components it
affects. Only after my "yes": update_install_inputs, then deploy_install_components,
then watch_workflow until it finishes. This needs the proxy started with
--allow-writes.`,
  },
  {
    id: 'runbooks',
    title: 'Which runbooks exist here, and what do they do?',
    tools: ['list_runbooks', 'get_runbook'],
    write: false,
    answer:
      'Four procedures with their steps, split into read-only diagnostics and the ones that apply changes.',
    page: '/customize/runbooks',
    prompt: (install, app) => `Call list_runbooks for app ${app}, then get_runbook for each one. Tell me which
are read-only diagnostics and which apply changes, and what each step does. Running one
has no MCP tool yet; if I want to, give me the CLI command:
nuon runbooks create-run --install-id ${install} --runbook-id <name> --output agent`,
  },
  {
    id: 'watch',
    title: 'Watch this run until it finishes.',
    tools: ['list_workflows', 'watch_workflow'],
    write: false,
    answer: 'A live tail of the run’s steps and a one-line verdict when it ends.',
    prompt: (install) => `Call list_workflows for install ${install}, pick the most recent running workflow
(or the one you just started), and call watch_workflow on it. Tell me each step as it
completes and, when it ends, whether it succeeded. Read-only.`,
  },
]

export const useCaseById = (id: string): UseCase | undefined =>
  useCases.find((u) => u.id === id)

/** A single use case with the guardrails on top: what a card's Copy button hands over. */
export function useCasePrompt(useCase: UseCase, install: string, app: string): string {
  return `${guardrails(install, app)}

${useCase.prompt(install, app)}`
}

/* ---------- The full checklist prompt (hub) ---------- */

export function agentPrompt(install: string, app: string): string {
  return `${guardrails(install, app)}

Warm-up: whoami, then get_install for ${install}. Tell me what you see.

Then walk me through this install, one step at a time, waiting for my "yes" before
each write:

1. ROLLOUT — list_app_branches for ${app}, then get_app_branch for "${branchName}".
   Did the last run succeed, what changed, and which group is ${install} in?

2. HEALTH — list_workflows for ${install}; if anything failed, get_workflow and the
   step logs, and explain it. Otherwise show me the last successful run.

3. RUNBOOKS — list_runbooks for ${app} and get_runbook for full-health-check. It is
   read-only diagnostics. Running it is a CLI step; after my yes:
   nuon runbooks create-run --install-id ${install} --runbook-id full-health-check --output agent
   then watch_workflow on the run it created and summarize each step.

4. ACTION — list_install_actions for ${install}, find "debug", and after my yes call
   run_action, then watch_workflow, and summarize the diagnostic bundle.
   (Starting a run is a write: the proxy needs --allow-writes.)

5. SHIP — my app config is cloned at <path-to-your-clone>. Help me make one small
   visible edit; then, from that directory and after my yes:
   nuon sync --app-id ${app} --force --branch ${branchName} --no-wait --output agent
   Syncing local files has no MCP tool. Follow the run with watch_workflow and
   get_app_branch; when a group holds for approval, get_pending_approvals shows it,
   and I approve it myself.

Budget: exactly one run per step. Anything else requires my explicit request.`
}

/* ---------- Per-page proof prompts ---------- */

function fromUseCase(id: string) {
  return (install: string, app: string): string => {
    const useCase = useCaseById(id)
    if (!useCase) return guardrails(install, app)
    return `${useCasePrompt(useCase, install, app)}

Budget: exactly one run.`
  }
}

export const proofPrompts: Record<string, (install: string, app: string) => string> = {
  branches: fromUseCase('group'),
  runbooks: fromUseCase('runbooks'),
  actions: fromUseCase('action'),
  health: fromUseCase('debug'),
  roles: fromUseCase('inputs'),
  triggers: (install) => `${guardrails(install, '<your-app-id>')}

Budget: exactly one run.

PROOF — call list_install_actions for install ${install} and find "cron_status",
the action its cron trigger has run hourly since this install provisioned. Show me
what it does (get_action). After my "yes", call run_action, then watch_workflow, and
show me its structured outputs: pods_ready, pods_total, checked_at. Starting a run
is a write: the proxy needs --allow-writes.`,
}
