# SECURITY.md

Security rules for this project. These are non-negotiable.

## Secrets
- NEVER put API keys, passwords, tokens, or secrets in code files.
- ALWAYS load sensitive data from environment variables.
- Keep real values in a local `.env` file (gitignored). Commit only `.env.example`
  with empty placeholders.
- If you discover an exposed secret, STOP and report it immediately. Treat it as
  compromised: rotate the key and purge it from history.

## Version control
- `.env` and any `*.local.*` files must be gitignored before the first commit.
- Never commit credentials, private keys, or `.pem` / `.key` files.
- Review diffs before committing — no secrets, no large binaries.

## Dependencies
- Don't add dependencies without a reason; prefer the standard library.
- Pin versions. Review new packages before adding them.

## Data handling
- Don't log secrets, tokens, or personal data.
- Validate and sanitize all external input.
- Use least-privilege credentials; scope tokens to what's actually needed.

## Network & external calls
- Use HTTPS for all outbound requests.
- Set timeouts on network calls; fail closed on auth errors.

## When in doubt
- Ask before doing anything that touches credentials, production data, or auth.
