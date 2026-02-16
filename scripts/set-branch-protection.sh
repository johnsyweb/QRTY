#!/usr/bin/env bash
# Set branch protection on main so PRs (including Dependabot) only merge when CI passes.
# Requires: gh CLI, and repo admin (or sufficient permissions).
# Usage: ./scripts/set-branch-protection.sh

set -euo pipefail

BRANCH="${1:-main}"

# Status check contexts from .github/workflows/ci.yml (job names that run on PRs)
REQUIRED_CONTEXTS='["build","lint-test","lighthouse","validate-html"]'

# Optional: require branch to be up to date before merging
STRICT="${STRICT:-true}"

# Require a PR (with 0 approving reviews) so status checks apply to merges
BODY=$(jq -n \
  --argjson contexts "$REQUIRED_CONTEXTS" \
  --argjson strict "$STRICT" \
  '{
    required_status_checks: { strict: $strict, contexts: $contexts },
    enforce_admins: false,
    required_pull_request_reviews: { required_approving_review_count: 0 },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false
  }')

echo "Setting branch protection for $BRANCH (require: build, lint-test, lighthouse, validate-html)…"
gh api \
  -X PUT \
  "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/$BRANCH/protection" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  --input - <<< "$BODY"
echo "Done. Dependabot PRs will auto-merge only after those checks pass."
