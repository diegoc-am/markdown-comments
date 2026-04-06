---
project_name: "markdown-comments"
user_name: "dcamargo"
date: "2026-04-06"
sections_completed: ["technology_stack", "critical_implementation_rules", "architecture_and_patterns", "workflow"]
existing_patterns_found: 16
---

# Project Context for AI Agents

This file captures implementation rules and existing patterns that AI agents should follow when making changes in this repository.

## Technology Stack & Versions

- Ruby `3.4.4` (`.ruby-version`)
- Rails `8.1.3` (`Gemfile`)
- PostgreSQL via `pg`
- Redis + Sidekiq
- Dotenv for local environment loading (`dotenv-rails`)
- Importmap + Turbo + Stimulus
- Tailwind via CDN in layout (no npm build step)
- Markdown rendering client-side with `marked` + `DOMPurify`
- Mermaid diagram rendering client-side with `mermaid`
- CI entrypoint: `bin/ci`

## Critical Implementation Rules

- Keep the API namespaced under `Api::V1`; do not introduce non-versioned API controllers.
- Preserve session-based authentication with GitHub OAuth (`SessionsController`, `ApplicationController#authenticate_user!`).
- For source-file comments, prefer `Comment.create_for_source_url!` so source metadata and commit SHA tracking remain consistent.
- Maintain `MarkdownDocument` path normalization (`normalize_path_value`) when touching document-path logic.
- Preserve user-scoped GitHub access token flow (`User.from_github_auth` stores token/scopes) for private/org repository reads.
- Keep OAuth scope behavior aligned with private repo support (`GITHUB_OAUTH_SCOPE`, default includes `repo`).
- Preserve comment authorization rules:
  - Only owners can destroy comments.
  - Non-owners can only perform status-only updates.
- Keep `Comment#status` enum semantics (`open`, `resolved`) aligned with `resolved_by` and `resolved_at` handling in controller updates.
- Keep deep-link query param conventions stable: `repo`, `source_url`, `comment_id` (and optional `lines`).

## Architecture & Existing Patterns

- Models are thin and focused on domain invariants; controller handles request authorization and serialization.
- Serialization is currently inline in `Api::V1::CommentsController#serialize_comment` (no dedicated serializer layer yet).
- Root route is the interactive dashboard UI (`DashboardController#index`).
- OAuth behavior is env-driven. If `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are missing, login is intentionally disabled.
- GitHub integration is split between:
  - `GithubFileReference` URL parsing and canonicalization
  - `GithubFileClient` file/commit fetch
  - `GithubRepoClient` visible repository listing
- Dashboard UX pattern is GitHub-PR-like inline review:
  - repository-first list grouped by relevance
  - raw/rendered file review modes
  - inline threaded comments anchored by source lines
  - markdown comment editor with Raw/Preview tabs
  - shareable app permalinks to file/comment context
- Database schema currently centers on these domain entities:
  - `users`
  - `markdown_documents`
  - `comments` (threaded via self-reference)
- Source metadata fields are important invariants:
  - `markdown_documents.source_url`, `repository_name`, `repository_ref`, `content_sha`, `content_cache`
  - `comments.source_commit_sha`

## Testing & Verification Expectations

- Preferred local validation sequence:
  1. `bin/rails test`
  2. `bin/rubocop`
  3. `bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error`
- For frontend-only Stimulus changes, run `node --check app/javascript/controllers/comments_ui_controller.js` as a quick syntax gate.
- `bin/ci` is the authoritative all-in-one check.

## BMad Workflow Context

- BMad configs live in `_bmad/`.
- Default generated output folder is `_bmad-output/`.
- Useful workflow starters for this repo state:
  - `bmad-document-project` (`DP`) to deepen brownfield documentation.
  - `bmad-generate-project-context` (`GPC`) to regenerate this file after major architecture changes.
  - `bmad-help` (`BH`) whenever you need the next recommended step.
