---
project_name: "markdown-comments"
user_name: "dcamargo"
date: "2026-04-05"
sections_completed: ["technology_stack", "critical_implementation_rules", "architecture_and_patterns", "workflow"]
existing_patterns_found: 8
---

# Project Context for AI Agents

This file captures implementation rules and existing patterns that AI agents should follow when making changes in this repository.

## Technology Stack & Versions

- Ruby `3.4.4` (`.ruby-version`)
- Rails `8.1.3` (`Gemfile`)
- PostgreSQL via `pg`
- Redis + Sidekiq
- Importmap + Turbo + Stimulus
- CI entrypoint: `bin/ci`

## Critical Implementation Rules

- Keep the API namespaced under `Api::V1`; do not introduce non-versioned API controllers.
- Preserve session-based authentication with GitHub OAuth (`SessionsController`, `ApplicationController#authenticate_user!`).
- For comment creation, continue routing through `Comment.create_for_path!` so path tracking and normalization stay consistent.
- Maintain `MarkdownDocument` path normalization (`normalize_path_value`) when touching document-path logic.
- Preserve comment authorization rules:
  - Only owners can destroy comments.
  - Non-owners can only perform status-only updates.
- Keep `Comment#status` enum semantics (`open`, `resolved`) aligned with `resolved_by` and `resolved_at` handling in controller updates.

## Architecture & Existing Patterns

- Models are thin and focused on domain invariants; controller handles request authorization and serialization.
- Serialization is currently inline in `Api::V1::CommentsController#serialize_comment` (no dedicated serializer layer yet).
- Root route is a health endpoint (`rails/health#show`); this app currently behaves as a backend-first service.
- OAuth behavior is env-driven. If `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are missing, login is intentionally disabled.
- Database schema currently centers on three domain entities:
  - `users`
  - `markdown_documents`
  - `comments` (threaded via self-reference)

## Testing & Verification Expectations

- Preferred local validation sequence:
  1. `bin/rails test`
  2. `bin/rubocop`
  3. `bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error`
- `bin/ci` is the authoritative all-in-one check.

## BMad Workflow Context

- BMad configs live in `_bmad/`.
- Default generated output folder is `_bmad-output/`.
- Useful workflow starters for this repo state:
  - `bmad-document-project` (`DP`) to deepen brownfield documentation.
  - `bmad-generate-project-context` (`GPC`) to regenerate this file after major architecture changes.
  - `bmad-help` (`BH`) whenever you need the next recommended step.
