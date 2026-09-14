/**
 * The three common requests, each one app branch of this repo. The
 * branch-derived facts (files, delta lines, groups) arrive with the case
 * screens; this module holds what the request is.
 */

export interface CaseSummary {
  /** Also the git branch and the Nuon app branch name. */
  branch: 'no-egress' | 'byo-vpc' | 'single-tenant'
  title: string
}

export const cases: CaseSummary[] = [
  { branch: 'no-egress', title: 'No egress' },
  { branch: 'byo-vpc', title: 'Existing VPC' },
  { branch: 'single-tenant', title: 'Single-tenant, vendor-run' },
]

export const caseByBranch = (branch: string): CaseSummary | undefined =>
  cases.find((c) => c.branch === branch)
