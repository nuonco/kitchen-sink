import { branchName } from './config-data.gen'

/**
 * The copy-paste prompts for a visitor's coding agent (Claude Code, Codex).
 * One full prompt walks every proof on the checklist; each feature page also
 * carries a scoped prompt for just its own proof. All of them share the same
 * guardrails: scoped to this app and install, read-only reads, every command
 * shown, an explicit "yes" before anything mutates.
 *
 * One honest constraint runs through all of them: `nuon runbooks create-run`
 * is broken platform-side today (it sends an empty request body), so runbook
 * runs start from the dashboard and the agent reads the results. Actions,
 * sync, and the REST API are unaffected.
 */

function guardrails(install: string, app: string): string {
  return `You are operating the Nuon CLI against MY app and MY install, in my own Nuon org.
I have already run "nuon auth login" on this machine, so the CLI is authenticated
(session in ~/.nuon). Do not ask me for, print, or export any token.

Hard limits:
- Only this app and install: app conduit (${app}), install ${install}.
- NEVER create, delete, or tear down installs, apps, components, or branches.
- Add --output agent to every nuon command; prefix every read with NUON_READ_ONLY=1.
- Before EVERY mutating command: show me the exact command, say what it will change,
  and wait for my explicit "yes". After every command, show me the result.`
}

/** The full checklist prompt: every proof, in order, one run per flow. */
export function agentPrompt(install: string, app: string): string {
  return `${guardrails(install, app)}

Warm-up: NUON_READ_ONLY=1 nuon installs get -i ${install} --output agent

Then walk me through operating Conduit for real, in this order:

1. RUNBOOK — NUON_READ_ONLY=1 nuon runbooks list -i ${install} --output agent;
   confirm pipeline-health-sweep exists (read-only diagnostics, sync freshness
   included). "nuon runbooks create-run" is broken platform-side right now
   (empty request body; fix in flight), so tell me to start
   pipeline-health-sweep from my dashboard's runbooks page. Then poll get-run
   until it finishes and summarize each step.

2. ACTION + ROLE PROOF — NUON_READ_ONLY=1 nuon actions list -a ${app} --output agent;
   create-run needs the workflow ID (actw...), not the name — resolve
   pause_pipelines here. Warn me: it pauses every pipeline for about a minute,
   verifies no new runs start, then resumes — a drill in which every step is
   real. After my yes:
   nuon actions create-run -i ${install} -w <actw-id> --output agent
   (if overriding the role: the flag is --role-name, not --role). Fetch the run
   logs and point out the assumed role ARN (...-app-break-glass) and the
   expected Secrets Manager deny — that is the per-operation IAM proof. Then
   tell me to open my Conduit pipelines page and watch the paused badges flip
   on and back off.

3. BRANCH — my app config is cloned at <path-to-your-clone>. Help me make one small
   visible edit, then from that directory, after my yes:
   nuon sync --app-id ${app} --force --branch ${branchName} --output agent.
   This syncs my local files and triggers a real staged branch run — no push needed.
   Report each group's progress; if a group holds for approval, tell me and I will
   approve it in my dashboard.

4. ROLLBACK — API-only (no CLI command yet). Read my session credentials into shell
   variables without echoing them:
   TOK=$(awk '$1=="api_token:"{print $2}' ~/.nuon); ORG=$(awk '$1=="org_id:"{print $2}' ~/.nuon)
   GET https://api.nuon.co/v1/installs/${install}/app-config-versions
   (headers: Authorization: Bearer $TOK, X-Nuon-Org-ID: $ORG). Show me the versions,
   then POST /v1/installs/${install}/app-config-updates with
   {"app_config_id":"<previous>","plan_only":true} and show me the plan.
   Only after my yes, repeat with "plan_only": false, and tell me to watch the old
   image tags reappear on my pods page.

Budget: exactly one run per flow. Anything else requires my explicit request.`
}

/** A single-proof prompt: the same guardrails, one flow's proof, one run. */
function proofPrompt(install: string, app: string, body: string): string {
  return `${guardrails(install, app)}

Budget: exactly one run.

PROOF — ${body}`
}

/**
 * The pipelines page's proof needs no Nuon CLI at all: the bucket is the
 * reader's own, so plain aws CLI verifies the sync landed.
 */
export function pipelinesPrompt(bucket: string): string {
  return `Conduit is a data-sync product deployed into MY AWS account; it writes CSVs to
MY bucket ${bucket}. You have my normal AWS credentials. Read-only.

Run: aws s3 ls s3://${bucket}/ --recursive | sort | tail -20
Group the newest keys by prefix (orders/, events/, snapshots/) and read each
key's embedded timestamp. Confirm new objects keep arriving on each pipeline's
interval, and match the newest keys against the object keys shown on my
Conduit pipelines page. Do not download object contents unless I ask.`
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
Conduit branches page.`,
    ),
  runbooks: (install, app) =>
    proofPrompt(
      install,
      app,
      `NUON_READ_ONLY=1 nuon runbooks list -i ${install} --output agent;
confirm pipeline-health-sweep exists (read-only diagnostics). "nuon runbooks
create-run" is broken platform-side right now (empty request body; fix in
flight), so tell me to start pipeline-health-sweep from my dashboard's
runbooks page. Then poll get-run until it finishes and summarize each step,
sync freshness included.`,
    ),
  actions: (install, app) =>
    proofPrompt(
      install,
      app,
      `NUON_READ_ONLY=1 nuon actions list -a ${app} --output agent;
create-run needs the workflow ID (actw...), not the name — resolve debug here.
After my yes: nuon actions create-run -i ${install} -w <actw-id> --output agent.
Fetch the run logs and summarize the support bundle it collected: pod state,
warning events, recent API logs. Nothing in my cluster changes.`,
    ),
  health: (install, app) =>
    proofPrompt(
      install,
      app,
      `pipeline-health-sweep re-checks nodes, workloads, ingress, the public
endpoint, and sync freshness. "nuon runbooks create-run" is broken
platform-side right now (empty request body; fix in flight), so tell me to
start it from my dashboard's runbooks page. Poll
NUON_READ_ONLY=1 nuon runbooks get-run until it finishes, then read me its
pod checks next to the live table on my Conduit health page — both read the
same cluster.`,
    ),
  triggers: (install, app) =>
    proofPrompt(
      install,
      app,
      `NUON_READ_ONLY=1 nuon actions list -a ${app} --output agent;
resolve sync_heartbeat to its workflow ID (actw...). After my yes:
nuon actions create-run -i ${install} -w <actw-id> --output agent — the same
action its cron trigger has run hourly since this install provisioned.
Show me its structured outputs: pods_ready, pods_total,
syncs_succeeded_last_hour, syncs_failed_last_hour, checked_at.`,
    ),
  roles: (install, app) =>
    proofPrompt(
      install,
      app,
      `NUON_READ_ONLY=1 nuon actions list -a ${app} --output agent;
resolve pause_pipelines to its workflow ID (actw...). Warn me: it pauses every
pipeline for about a minute, verifies no new runs start, then resumes — a
drill in which every step is real. After my yes:
nuon actions create-run -i ${install} -w <actw-id> --output agent.
In the run logs, point out the assumed role ARN (${install}-app-break-glass)
and the denied Secrets Manager call, then tell me to watch the paused badges
flip on my Conduit pipelines page.`,
    ),
}
