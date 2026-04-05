# Markdown Comments

Rails app for threaded comments on markdown files, authenticated with GitHub OAuth.

## Quick Start

1. Install dependencies:

   ```bash
   bundle install
   ```

2. Copy sample env vars and set GitHub OAuth credentials:

   ```bash
   cp .env.example .env
   # then update GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
   ```

3. Prepare DB and run server:

   ```bash
   bin/rails db:prepare
   bin/dev
   ```

4. Open `http://localhost:3000` and sign in via `/login`.

If OAuth env vars are missing, the app now shows an in-app warning banner and keeps GitHub sign-in disabled.

## Key Routes

- `GET /` dashboard UI
- `GET /up` health check
- `GET /login` GitHub OAuth entrypoint
- `GET /auth/github/callback` OAuth callback
- `DELETE /logout` session logout
- `GET /api/v1/comments` list comments (supports `?path=...`)
- `POST /api/v1/comments` create comment
- `PATCH /api/v1/comments/:id` update comment or status
- `DELETE /api/v1/comments/:id` delete own comment

All comment API routes require an authenticated session.

## Documentation

- Contributor setup and production checklist: `docs/contributor-setup.md`
- Onboarding and runtime operations: `docs/onboarding-and-operations.md`
- GitHub OAuth plug-and-play guide: `docs/github-oauth.md`

## Quality Checks

```bash
bin/rails test
bin/ci
```
