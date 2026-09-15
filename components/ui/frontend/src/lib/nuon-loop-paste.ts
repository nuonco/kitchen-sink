// The nuon-loop paste, vendored verbatim from PASTE.md in nuonco/nuon-loop.
// Regenerate by copying the fenced block from that file; the source line
// below records which commit it came from.

export const pasteSource = {
  repo: 'nuonco/nuon-loop',
  file: 'PASTE.md',
  commit: 'a446c31443c6e40ba0c8c313562585abba5d856d',
  /** On the local branch ms/readme-paste-flow; not on GitHub as of 2026-09-14. */
  pushed: false,
  date: '2026-09-10',
  /** The repo is private; cloning it needs git or gh credentials with access. */
  private: true,
  /** The spec's own version line (NUON_LOOP.md, line 3). */
  spec: 'nuon-loop 0.5',
} as const

export const paste = "/goal Set up this application on Nuon (nuon.co) so a customer can run it in their own AWS account, with no help from me unless a step truly needs a human. BOOTSTRAP FIRST, printing each result: (1) git clone --depth 1 https://github.com/nuonco/nuon-loop /tmp/nuon-loop (or gh repo clone nuonco/nuon-loop /tmp/nuon-loop if git prompts for credentials); mkdir -p .nuon-loop; copy NUON_LOOP.md and nuon-config-check.py into .nuon-loop/; read NUON_LOOP.md in full and print its Version line — it is the spec and overrides anything you assume about Nuon, and re-running it is safe. (2) Do its Phase 0 in order: locate the application (this directory if it is a git repo, else the repos/Dockerfiles/compose files/charts one level down, treated as one app unless the names clearly say otherwise — ask me only if two candidates are different products); write .claude/settings.local.json from Appendix F so nuon, python3, git and sleep never prompt me (if one still does, ask me once for \"always allow\"); make sure the nuon CLI and python3 >= 3.11 with jsonschema and pyyaml exist; nuon agents context, then nuon auth login if needed (tell me to finish the browser step), select the org if there is exactly one else ask me once, nuon apps deselect; add Appendix E to CLAUDE.md. (3) FOLLOW THE SPEC, Phases 1 through 6, under its §0.2 limits: I apply the CloudFormation stack; you never deprovision, delete or push. Infer every intake fact from the repo, its CI, its registries and this org's history; print the inferred-facts table and continue — ask me only for a fact you cannot determine and a gate depends on. THE GOAL IS MET when either (A) the transcript shows every §4 gate passing as command plus output — check script ending RESULT: PASS — 0 error(s); nuon apps validate exit 0; fresh-context review ending NO BLOCKING GAPS; nuon apps sync --no-wait with ok:true then a builds list where every component's newest build is active; an install named <app>-first (reused if it exists, else created) with an id starting inl; nuon installs stacks latest with a quick_link_url and composite_status.status awaiting-user-run; the provision workflow set to approve-all via nuon installs workflows set-approval-option (or that exact command printed in HANDOFF if you were not allowed to run it); the install's rendered readme fetched from https://api.nuon.co/v1/installs/<id>/readme returning HTTP 200 with a non-empty readme and empty warnings — and .nuon-loop/HANDOFF.md written and printed in full with no placeholders; or (B) .nuon-loop/BLOCKED.md written and printed, naming the item and gate you stopped on, every ask one that §6 allows, and the current check-script result shown. A gate counts only if its command and output are in the transcript. If I later paste a failed workflow or error, continue under Phase 7. Stop after 60 turns if neither A nor B is reached and write BLOCKED.md saying where you got stuck."

/** The same prompt without the /goal prefix. README.md: without /goal "the
    paste degrades into an ordinary chat message with no evaluator", so an
    agent that has no /goal (Cursor, Amp) gets the instructions but no gate
    evaluator and no 60-turn stop. */
export const pastePlain = paste.replace(/^\/goal\s+/, '')

/* ---------- From README.md at the same commit ---------- */

/** "Before you paste": the four prerequisites, plus the scope line. */
export const prerequisites = [
  'Claude Code with /goal',
  'a Nuon account',
  'Python 3.11 or newer',
  'git or gh credentials with access to the private nuonco/nuon-loop',
  'AWS EKS only',
] as const

/** "What lands in your repo" and "Reading HANDOFF.md". */
export const youGet = [
  { text: 'A Nuon app config in your repo', aside: 'nuon/<app>/' },
  { text: 'A first install, status awaiting-user-run', aside: '<app>-first · inl…' },
  { text: 'One CloudFormation Quick Create link to click', aside: 'HANDOFF.md' },
] as const

/** The stops every run hits: "What still needs you", minus the org pick. */
export const youDo = [
  { text: 'Approve "always allow" once', aside: 'first run: the bootstrap git clone' },
  { text: 'Finish the browser login', aside: 'nuon auth login' },
  { text: 'Click the Quick Create link in your AWS account', aside: 'the CloudFormation stack' },
] as const

/** The conditional rows of the same table. */
export const conditionalStops = [
  { text: 'Install Python 3.11+ yourself', when: 'if your interpreter is older' },
  { text: 'Say which directory is the app', when: 'only if two candidates are different products' },
  { text: 'Supply a 12-digit AWS account ID', when: 'only if your Nuon org has phone-home auth enabled' },
  { text: 'Finish nuon orgs connect-github in the browser', when: 'only if the chart or manifests live in a private GitHub repo' },
  { text: 'Answer one gate-critical fact', when: 'only if intake could not infer it' },
  { text: 'Run one approval command yourself', when: 'if the permission classifier refuses set-approval-option' },
  { text: 'Skip a stuck workflow in the dashboard', when: 'only after a Phase 7 fix' },
] as const

/** "What it will never do", denied in the .claude/settings.local.json it writes. */
export const itNever = [
  'deletes an app, or deprovisions or forgets an install',
  'runs git push or rm -rf',
  'runs aws, kubectl or terraform on your machine',
  'creates anything in AWS before you click',
] as const

export const neverMechanism = '.claude/settings.local.json, written before the first command runs'

/** The run log README reports: turns to the handoff, and the hard stop. */
export const runs = [
  { app: 'Convex', toHandoff: 15, total: 20 },
  { app: 'Logto', toHandoff: 14, total: 19 },
  { app: 'Saleor', toHandoff: 13, total: 18 },
] as const

export const turnLimit = 60
