#!/usr/bin/env bash
#
# Lands the image-tag stamp on the tracked branch from CI.
#
# Two of main's protection rules make a plain `git commit && git push` from a
# runner impossible, and neither has a workaround on the settings side:
#
#   1. "Require signed commits" has no bypass list at all, and a commit made
#      with git on a runner is unsigned. Commits created through the GitHub API
#      are signed by GitHub, so the stamp is built with the GraphQL
#      createCommitOnBranch mutation instead of git.
#   2. "Require a pull request" can only be bypassed by an actor in the branch's
#      bypass allowances, and GITHUB_TOKEN cannot be added to that list. So the
#      commit goes onto a ci/ branch and arrives via a squash-merged PR, which
#      GitHub also signs.
#
# Auto-merge is enabled on the PR: the stamp lands the moment the review
# requirement is satisfied, and until then it sits as an open PR instead of
# failing the workflow and silently leaving the config pinned to a stale tag.
set -euo pipefail

: "${TAG:?}" "${BASE_OID:?}" "${BASE_BRANCH:?}" "${GITHUB_REPOSITORY:?}" "${GH_TOKEN:?}"

BRANCH="ci/stamp-${TAG}"
FILES=(components/images/api.toml components/images/ui.toml components/chart/nuon.toml)

if gh api "repos/${GITHUB_REPOSITORY}/git/refs/heads/${BRANCH}" >/dev/null 2>&1; then
  gh api -X DELETE "repos/${GITHUB_REPOSITORY}/git/refs/heads/${BRANCH}" >/dev/null
fi
gh api -X POST "repos/${GITHUB_REPOSITORY}/git/refs" \
  -f "ref=refs/heads/${BRANCH}" -f "sha=${BASE_OID}" >/dev/null

additions=$(
  for f in "${FILES[@]}"; do
    jq -n --arg path "$f" --arg contents "$(base64 -w0 "$f")" \
      '{path: $path, contents: $contents}'
  done | jq -s .
)

payload=$(jq -n \
  --arg repo "$GITHUB_REPOSITORY" \
  --arg branch "$BRANCH" \
  --arg oid "$BASE_OID" \
  --arg headline "chore: stamp image tags to ${TAG}" \
  --argjson additions "$additions" \
  '{
     query: "mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }",
     variables: {
       input: {
         branch: { repositoryNameWithOwner: $repo, branchName: $branch },
         expectedHeadOid: $oid,
         message: { headline: $headline },
         fileChanges: { additions: $additions }
       }
     }
   }')

response=$(curl -sS -X POST https://api.github.com/graphql \
  -H "Authorization: bearer ${GH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload")

if ! oid=$(jq -er '.data.createCommitOnBranch.commit.oid' <<<"$response"); then
  echo "createCommitOnBranch failed: ${response}" >&2
  exit 1
fi
echo "created signed commit ${oid} on ${BRANCH}"

gh pr create \
  --base "$BASE_BRANCH" \
  --head "$BRANCH" \
  --title "chore: stamp image tags to ${TAG}" \
  --body "Pins \`${TAG}\` in \`components/images/*.toml\` and the chart's \`image_stamp\`, published by [run ${GITHUB_RUN_ID}](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}). Squash-merging this is what starts the staged rollout."

gh pr merge "$BRANCH" --auto --squash \
  || echo "::warning::could not enable auto-merge; merge ${BRANCH} manually to roll out ${TAG}"
