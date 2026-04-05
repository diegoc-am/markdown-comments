# Contributor Setup

## 1) 5-minute local setup

1. Install prerequisites.

   - Ruby `3.4.4` (matches `.ruby-version`)
   - PostgreSQL 12+
   - Redis
   - Bundler

2. Clone and install dependencies.

   ```bash
   git clone <your-fork-or-repo-url>
   cd markdown-comments
   bundle install
   ```

3. Create a local env file named `.env` and add the variables listed in step 5.

4. Configure a GitHub OAuth app.

   In GitHub, go to **Settings -> Developer settings -> OAuth Apps -> New OAuth App** and use:

   - Application name: `Markdown Comments (local)`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/github/callback`

   Then copy the generated client ID and secret into `.env`.

5. Set environment variables.

   Required for local login + app boot:

   ```dotenv
   GITHUB_CLIENT_ID=replace_me
   GITHUB_CLIENT_SECRET=replace_me
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=postgres
   DB_NAME=markdown_comments_development
   DB_TEST_NAME=markdown_comments_test
   REDIS_URL=redis://localhost:6379/0
   ```

   Optional but commonly useful:

   ```dotenv
   PORT=3000
   RAILS_MAX_THREADS=5
   SOLID_QUEUE_IN_PUMA=true
   RAILS_LOG_LEVEL=debug
   ```

   Then load them in your current shell before starting Rails:

   ```bash
   set -a
   source .env
   set +a
   ```

6. Prepare database and run the app.

   ```bash
   bin/rails db:prepare
   bin/dev
   ```

7. Verify login callback.

   - Open `http://localhost:3000`
   - Click **Sign in with GitHub**
   - Complete GitHub consent
   - Confirm you briefly land on `/auth/success` with a `Welcome, @<github_login>` message
   - Confirm redirect back to `/` with signed-in state visible in the navbar

8. Verify core comment actions.

   - Create: in **New Comment**, save a comment for `README.md`
   - List/filter: click **Refresh** in **Stored Comments** and confirm the new comment appears
   - Reply: click **Reply** on a comment and post a reply
   - Resolve/reopen: click **Resolve**, then **Reopen** and confirm status chip changes
   - Delete: delete your own comment and confirm it disappears from the list

### Environment variable reference (what uses each value)

| Variable | Required | Used in | Purpose |
| --- | --- | --- | --- |
| `GITHUB_CLIENT_ID` | Yes | `config/initializers/omniauth.rb` | Enables GitHub OAuth provider configuration |
| `GITHUB_CLIENT_SECRET` | Yes | `config/initializers/omniauth.rb` | Enables GitHub OAuth provider configuration |
| `DB_HOST` | Yes (unless default `db` host exists) | `config/database.yml` | PostgreSQL host |
| `DB_PORT` | No (defaults to `5432`) | `config/database.yml` | PostgreSQL port |
| `DB_USERNAME` | No (defaults to `postgres`) | `config/database.yml` | PostgreSQL username |
| `DB_PASSWORD` | No (defaults to `postgres`) | `config/database.yml` | PostgreSQL password |
| `DB_NAME` | Yes for predictable local/prod setup | `config/database.yml` | Primary DB name (development/production) |
| `DB_TEST_NAME` | Yes for predictable test setup | `config/database.yml` | Test DB name |
| `RAILS_MAX_THREADS` | No (defaults to `5` in DB config, `3` in Puma) | `config/database.yml`, `config/puma.rb` | DB pool sizing and Puma thread count |
| `REDIS_URL` | Yes for cache/jobs in normal operation | `config/environments/development.rb`, `config/environments/production.rb` | Redis backing cache store |
| `PORT` | No (defaults to `3000`) | `config/puma.rb` | Puma listen port |
| `SOLID_QUEUE_IN_PUMA` | Optional | `config/puma.rb`, `config/deploy.yml` | Runs Solid Queue supervisor in Puma process |
| `RAILS_LOG_LEVEL` | Optional | `config/environments/production.rb`, `config/deploy.yml` | Production log verbosity |
| `RAILS_MASTER_KEY` | Yes in production | `config/deploy.yml`, runtime boot | Decrypts `config/credentials.yml.enc` |
| `PIDFILE` | Optional | `config/puma.rb` | Custom server PID file path |
| `CI` | Optional (CI only) | `config/environments/test.rb` | Enables eager loading in CI test runs |

## 2) Production readiness checklist

- [ ] **GitHub OAuth app (production) is configured correctly**
  - Homepage URL uses your real app URL (example: `https://comments.example.com`)
  - Callback URL is exactly `https://<your-domain>/auth/github/callback`
  - Production values for `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are stored as deployment secrets
- [ ] **Core production secrets and config are present**
  - `RAILS_MASTER_KEY` is present in your deploy secret store
  - Database variables (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`) point to production PostgreSQL
  - `REDIS_URL` points to production Redis
  - `RAILS_LOG_LEVEL` is set intentionally (`info` is a good default)
- [ ] **Infrastructure and runtime checks pass**
  - App boots cleanly in production mode
  - `/up` returns `200`
  - Background job adapter and Redis connectivity are healthy
- [ ] **Security and HTTP posture reviewed**
  - SSL termination is configured at proxy/load balancer
  - In-app SSL settings (`config.force_ssl`, `config.assume_ssl`) are enabled when your proxy setup is ready
  - Session cookies are verified as secure in production
- [ ] **Database and deploy safety checks are done**
  - `bin/rails db:prepare` (or migration equivalent in your deploy pipeline) runs successfully
  - Rollback plan exists for failed migrations/deploys
  - Backups and restore procedure for Postgres are tested
- [ ] **Functional smoke tests are confirmed after deploy**
  - Login flow reaches `/auth/github/callback` and signs in successfully
  - Create, reply, resolve/reopen, and delete comment flows all work against production data
  - Unauthorized API requests to `/api/v1/comments` return `401`
