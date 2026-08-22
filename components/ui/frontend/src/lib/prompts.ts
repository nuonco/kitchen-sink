import { branchName } from './config-data.gen'

/**
 * The copy-paste prompts for a visitor's coding agent (Claude Code, Codex),
 * one per operation the console offers to run. All share the same guardrails:
 * scoped to this app and install, read-only reads, every command shown, an
 * explicit "yes" before anything mutates.
 */

function guardrails(install: string, app: string): string {
  return `You are operating the Nuon CLI against MY app and MY install, in my own Nuon org.
I have already run "nuon auth login" on this machine, so the CLI is authenticated
(session in ~/.nuon). Do not ask me for, print, or export any token.

Hard limits:
- Only this app and install: app relay (${app}), install ${install}.
- NEVER create, delete, or tear down installs, apps, components, or branches.
- Add --output agent to every nuon command; prefix every read with NUON_READ_ONLY=1.
- Before EVERY mutating command: show me the exact command, say what it will change,
  and wait for my explicit "yes". After every command, show me the result.`
}

/** One guarded prompt for one operation, one run. */
function proofPrompt(install: string, app: string, body: string): string {
  return `${guardrails(install, app)}

Budget: exactly one run.

TASK — ${body}`
}

export const proofPrompts: Record<string, (install: string, app: string) => string> = {
  branches: (install, app) =>
    proofPrompt(
      install,
      app,
      `my app config is cloned at <path-to-your-clone>. Help me make one small
visible edit, then from that directory, after my yes:
nuon sync --app-id ${app} --force --branch ${branchName} --output agent.
This syncs my local files and triggers a real staged branch run — no push needed.
Report each group's progress; if a group holds for approval, tell me and I will
approve it in my dashboard. Then tell me to watch the image tags flip on my
Relay console's Infrastructure page.`,
    ),
  runbooks: (install, app) =>
    proofPrompt(
      install,
      app,
      `NUON_READ_ONLY=1 nuon runbooks list -i ${install} --output agent;
confirm full-health-check exists (read-only diagnostics). After my yes:
nuon runbooks create-run -i ${install} -r full-health-check --output agent.
Poll get-run until it finishes; summarize each step.`,
    ),
  export: (install, app) =>
    proofPrompt(
      install,
      app,
      `NUON_READ_ONLY=1 nuon actions list -a ${app} --output agent;
create-run needs the workflow ID (actw...), not the name — resolve
delivery_log_export here. After my yes:
nuon actions create-run -i ${install} -w <actw-id> --output agent.
Fetch the run logs and show me the S3 key it wrote
(delivery-logs/<timestamp>.json in the relay-${install} bucket).`,
    ),
}
