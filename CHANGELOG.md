# Changelog

## v1.1.0

- **Sign-in:** the page gets a short-lived customer token from the bank sign-in
  (`LIR_SIGN_IN_ENDPOINT`, the demo one on the agent) and renews it before it expires,
  instead of carrying a fixed token. When the sign-in or the statement fails, the page says
  so and does not send the case as the demo customer.
- **Approval card:** a failed sign-in shows a clear message instead of staying on
  "Loading…", and a failed decision can be retried.
- **Security headers:** strict Content-Security-Policy, HSTS and `Permissions-Policy` on
  every response, `config.js` included; `server_tokens off`, gzip and revalidated caching.
- **CI:** pull requests run a syntax check, the tests, the shell script check and
  `nginx -t` on the built image; the deploy checks the image with `nginx -t` first.
- **Docs:** links to the agent and infra repositories, the API key documented as public by
  design, the Lir mascot; internal task notes removed.

## v1.0.0

First release for the Factored AI & Data Hackathon 2026: the LATAM Bank support form with
the live statement, the case slip, the Telegram hand-off with a QR code, the approval card,
and Spanish, Portuguese and English.
