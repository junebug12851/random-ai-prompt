---
date: 2026-07-02
procedure: roundup
node: random-ai-prompt
outcome: completed
hub_version: 0.11.0
hub_commit: 2ffe455
---

# Process Report — propose a supply-chain / OpenSSF-Scorecard hardening standard, 2026-07-02

> A new-standard proposal raised from a live hardening pass on `random-ai-prompt`. The measures are
> generic GitHub-repo hygiene, so they belong in the hub as a shared standard (+ a workflow template),
> not one-off in this repo. I can't push to the hub — this is for the owner to carry over.

## Outcome in one line

Raised `random-ai-prompt`'s OpenSSF Scorecard from **4.2** by fixing the real failing checks
(workflow permissions, SHA-pinned Actions, `SECURITY.md`, branch protection, signed releases, dev-dep
vulns); proposing the same set as a reusable **`supply-chain-hardening`** hub standard for every node.

## What was done

Pulled the live scan (`https://api.securityscorecards.dev/projects/github.com/junebug12851/random-ai-prompt`)
and worked each failing check on this repo:

- **Token-Permissions** — added top-level `permissions: contents: read` to every workflow that lacked one;
  pushed `release.yml`'s write down to job scope (+ `id-token`/`attestations: write` for signing).
- **Pinned-Dependencies** — pinned all 33 Action refs to full commit SHAs (`# vX` comments). Dependabot's
  `github-actions` ecosystem keeps them current.
- **Security-Policy** — added root `SECURITY.md` (private reporting).
- **Signed-Releases** — added `actions/attest-build-provenance` (keyless Sigstore SLSA provenance) to the
  release job.
- **Branch-Protection** — enabled on `main` via `gh api`: PR-required (0 approvals), strict status checks,
  enforce-admins, no force-push/deletion, linear history off.
- **Vulnerabilities** — cleared the dev-only OSV hits with `package.json` `overrides`.

Local docs reconciled in the same change: `CLAUDE.md`, `notes/reference/git-workflow.md`,
`notes/reference/deployment.md` (release flow moved to a PR because `main` is now protected).

## What went well

- The Scorecard JSON API gives an exact, per-check breakdown with remediation URLs — easy to prioritize
  by weight and turn into a checklist.
- Most checks are pure repo-config edits (workflow YAML, one policy file, one `gh api` call) — no app-code
  risk, and reversible.
- `gh api PUT …/branches/main/protection` + a read-back made the branch-protection change auditable.

## What went wrong / friction

- **Branch-Protection collides with the hub `git-workflow` release flow.** The standard releases by a
  local `git merge --no-ff dev && git push origin main`. With `enforce_admins` + require-PR, direct pushes
  to `main` are blocked, so the release must go through a PR (`gh pr merge --merge`). The two standards
  have to be reconciled — a node can't adopt both as currently written.
- **Code-Review is unreachable for solo maintainers.** It needs an *approved* PR review, and GitHub forbids
  self-approval. So a one-person repo is capped around **8/10** no matter what. The standard should say this
  plainly so solo nodes don't chase an impossible 10.
- **`required_approving_review_count: 0`** is the only way to require PRs without a second human — worth
  encoding as the canonical solo setting.
- **`gh api --input -` fails from PowerShell** (UTF-16 stdin → "Problems parsing JSON"). The reliable form
  is a UTF-8 (no BOM) temp file + `--input <file>`. Belongs in the runbook if the hub scripts a `gh api`.
- **The badge lags.** It only refreshes when `scorecard.yml` re-runs (weekly cron / `main` push), and
  Signed-Releases only flips after the *next* release — adopters will think nothing happened. Say so.

## Suggestions / feedback

Propose a new hub standard **`hub/standards/supply-chain-hardening.md`** (+ a `## Verify` slice for the
compliance audit), covering, as the mesh baseline:

1. **Least-privilege workflow permissions** — top-level `permissions: contents: read` in every workflow;
   elevate per-job only.
2. **SHA-pin all Actions** (`# vX` comment) and enable Dependabot's `github-actions` ecosystem to maintain
   them.
3. **`SECURITY.md`** with private reporting (template in `hub/templates/`).
4. **Signed releases** — `actions/attest-build-provenance` in the release workflow (`id-token`/
   `attestations: write` at job scope).
5. **Branch protection** on `main` — canonical **solo** config: require PR, **0 approvals**, strict status
   checks, enforce-admins, block force-push/deletion, linear-history **off** (so `--no-ff` release merges
   pass). Ship a `gh api` snippet (UTF-8-file `--input`, not `-`).
6. **Reconcile with `git-workflow`** — since (5) blocks direct pushes to `main`, update the release flow to
   the PR form (`gh pr create` → `gh pr checks --watch` → `gh pr merge --merge` → ff `dev` up to `main`).
   This supersedes the local-push commands for any node that adopts branch protection.
7. **State the solo ceiling** — Code-Review (and thus a perfect 10) needs a second approver; document ~8 as
   the solo maximum so nodes don't chase it.
8. **Note the lag** — badge refreshes on the scorecard workflow's schedule; Signed-Releases needs one real
   release.

Owner action: create the standard + `SECURITY.md`/`branch-protection` templates in the hub and reconcile
`git-workflow.md`'s release section; I can't push to the hub. The local changes here are flagged "pending
hub adoption" and will reconcile on the next sync.

## Environment

Solo maintainer (junebug12851), Windows + PowerShell + `gh` (authed, `repo` scope) + git 2.52, GitHub
Actions CI. Public repo (attestations + Scorecard are free). On arrival: Scorecard 4.2, no branch
protection, no `SECURITY.md`, Actions pinned by moving tag, `main` released by direct push. `main` is now
branch-protected; `release.yml` derives the tag from `VERSION` on the `main` push.
