# GitHub OAuth: Plug-and-Play Setup

This app enables OAuth only when both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are present.

## 1) Create GitHub OAuth App

In GitHub Developer Settings, create an OAuth App with:

- Application name: any name (for example `markdown-comments-local`)
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/auth/github/callback`

## 2) Export Credentials

```bash
export GITHUB_CLIENT_ID=your_client_id
export GITHUB_CLIENT_SECRET=your_client_secret
```

## 3) Start App

```bash
bin/rails db:prepare
bin/dev
```

## 4) Verify End-to-End

1. Open `http://localhost:3000`.
2. Click `Sign in with GitHub` (or hit `/login`).
3. Approve GitHub consent.
4. Confirm redirect to `/auth/success` and then dashboard.
5. Confirm signed-in UI shows your `@github_login`.

## OAuth Routes Used

- `/login` -> redirects to `/auth/github`
- `/auth/github/callback` -> handled by `SessionsController#create`
- `/auth/failure` -> handled by `SessionsController#failure`
- `/logout` -> clears session

## Troubleshooting

- `GitHub OAuth is disabled` in logs:
  - `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` is missing.
- Redirect mismatch error from GitHub:
  - Callback URL in GitHub app must exactly match `http://localhost:3000/auth/github/callback`.
- Successful GitHub login but app not signed in:
  - Check callback request reaches `/auth/github/callback` and returns non-empty `omniauth.auth`.
- API returns `401 Authentication required`:
  - Sign in first; API is session-protected via `authenticate_user!`.

## Security and Ops Notes

- Do not commit OAuth secrets.
- For production, create a separate OAuth app with production callback URL.
- If app domain changes, update callback URL in GitHub settings before deploy.
