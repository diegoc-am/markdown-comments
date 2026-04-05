# Onboarding and Operations

## What This App Is

- Rails 8 app with a server-rendered dashboard and JSON API.
- Core feature: threaded comments on markdown files (`path`), with status (`open` / `resolved`).
- Auth is session-based and backed by GitHub OAuth.

## Architecture at a Glance

- `app/controllers/dashboard_controller.rb`: dashboard page (`/`).
- `app/controllers/sessions_controller.rb`: GitHub OAuth callback and logout.
- `app/controllers/api/v1/comments_controller.rb`: authenticated comments API.
- `app/models/user.rb`: GitHub identity (`github_uid`, `github_login`).
- `app/models/markdown_document.rb`: normalized file path tracking.
- `app/models/comment.rb`: threaded comments (`parent_id`) and resolution metadata.

## Runtime Dependencies

- Ruby `3.4.4` (`.ruby-version`)
- PostgreSQL (required)
- Redis (required for configured cache, Action Cable, and Sidekiq adapter)

## Required Environment Variables

Minimum local setup:

```bash
export GITHUB_CLIENT_ID=your_client_id
export GITHUB_CLIENT_SECRET=your_client_secret

export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
export DB_NAME=markdown_comments_development

export REDIS_URL=redis://localhost:6379/0
```

Useful optional vars:

```bash
export RAILS_MAX_THREADS=5
export PORT=3000
```

## Local Boot Flow

```bash
bundle install
bin/rails db:prepare
bin/dev
```

Then open `http://localhost:3000`.

Notes:

- `bin/dev` only starts the Rails server in this repo.
- Background jobs use Sidekiq as adapter, but no separate Sidekiq process is started by default.

## Operating Checks

- Health check: `GET /up` should return `200`.
- Auth check: `GET /login` should redirect to GitHub OAuth.
- API check (signed in): `GET /api/v1/comments?path=README.md` should return JSON.

## Data Model Notes

- `users`: unique `github_uid`, unique `github_login`.
- `markdown_documents`: unique normalized `path` (leading slash removed).
- `comments`: belongs to `user` and `markdown_document`, optional `parent`, optional `resolved_by`, JSONB `anchor`.

## Deployment Snapshot

- Containerized production build via `Dockerfile`.
- `bin/docker-entrypoint` runs `db:prepare` when booting Rails server.
- Kamal config present at `config/deploy.yml`.
- Current deploy config values are placeholders and need real hosts/registry values.
