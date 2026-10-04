# Feature: telegram-start-link

Repository: `lir-web` (local, not pushed). Locator:
`odd/tasks/telegram-start-link.md`. Brief: `docs/goal-telegram-start-link.md`.
Engram mirror: `odd/telegram-start-link/tasks` (PENDING, written by the parent).

## Objective

Connect the form to the real backend (Google API Gateway in front of
`POST /v1/cases`) and hand the customer off to Telegram with the single-use
Start link the backend returns.

## Problem and why

- Telegram bots cannot message a user first. The current success copy promises
  "Lir messages you on Telegram", which cannot happen until the customer opens
  the bot and presses **Start**.
- The API now sits behind API Gateway on another origin and requires a customer
  JWT. The contract's "CORS and IAP" section no longer applies.

## Scope

- `js/core/submit.js`: pass `telegram_start_url` through (only `https://t.me/`
  URLs, otherwise `null`); send `Authorization: Bearer <token>` when configured.
- `js/config.js`: `casesEndpoint`, `authToken: null`.
- Success screen: a real link button "Continue on Telegram", explanation copy,
  a QR on wide screens (optional), a neutral line when Telegram has no URL.
- `docs/case-contract.md`: 202 body, Start-link rule, Cloud Storage inbox,
  CORS and API Gateway, JWT customer match, informational Telegram handle.
- README and screenshots.

Out of scope: channel redesign, optional Telegram handle (schema change), real
sign-in or token refresh, any backend code.

## Constraints

- Plain HTML, CSS and ES modules; no npm dependencies; Node 18 `node --test`.
- `es`, `pt` and `en` keep identical keys; neutral Spanish and Brazilian
  Portuguese.
- The Start token is never shown as text, logged, or stored in `localStorage`.
- The Telegram button uses the page's primary button style; marigold stays
  reserved for selection, focus and the stamp.
- `schema_version` stays `"1.1"` (the request payload does not change).

## Tasks

Route for every task: delegated writer (one bounded writer for 2+ non-trivial
files, parent orchestrates).

- [x] T1, plan: this document and the brief. Commit `docs(odd)`.
- [x] T2, submit: test-first `telegram_start_url` pass-through and validation,
  and the `Authorization` header; `casesEndpoint`/`authToken` in config.
- [x] T3, success screen: Telegram button, explanation, neutral fallback, i18n
  in three languages.
- [x] T4, QR: vendor one small MIT QR generator under `js/vendor/`, render on
  wide screens only, credit in README.
- [x] T5, contract: `docs/case-contract.md` per the brief.
- [x] T6, screenshots and README: success screen with the Telegram button.

## Acceptance criteria (from the brief)

- A live `202` with `telegram_start_url` shows the button (and the QR on wide
  screens); clicking it opens that exact URL.
- A `202` without it, or with a non-`https://t.me/` URL, shows no button and no
  Telegram promise.
- Requests carry `Authorization` only when `authToken` is set.
- `es`, `pt` and `en` have the same keys; the existing i18n test passes.
- New `node --test` cases cover the submit outcome (URL present, absent,
  rejected) and the Authorization header; `node --test tests/` is green.
- `docs/case-contract.md` matches the behavior above.
- Screenshots in `docs/screenshots/` updated if the success screen changed.

## Checks

- `node --test tests/` (RED before the submit change, GREEN after).
- Headless Firefox screenshot of the success state with a stubbed endpoint
  (scratch copy, not committed).

## Delivery

- Strategy: `ask-on-risk`. Forecast: about 350 authored lines plus the vendored
  QR file (excluded). One slice on `feat/bank-support-form`.

## Progress and evidence

- T1: `9cfc57f` docs(odd). Brief and this plan.
- T2: `5579405` feat(submit). Test-first: six new cases in
  `tests/submit.test.js`; RED was 5 failing of 50 (URL present, absent, hostile
  URLs, demo, Bearer header); GREEN 50/50. `telegramStartUrl` keeps a link only
  when `new URL()` gives protocol `https:` and host exactly `t.me` (and no
  credentials or port). `app.js` passes `authToken` from `LIR_CONFIG`.
- T3: `08a1488` feat(success). A real `<a target="_blank" rel="noopener
  noreferrer">` in the primary button style, only for the telegram channel with
  a link. Without one (older backend, demo), the contact and outcome lines are
  neutral (`telegram_unlinked`, `other_unlinked`). The URL lives only in the
  `href`; `view.success` is in memory and `localStorage` holds only the
  language. Focus still moves to `#success`.
- T4: `c462f48` feat(success). Vendored `kazuhikoarase/qrcode-generator`
  `js/dist/qrcode.js` (commit `64f5976`, byte-identical, MIT) as a classic
  `defer` script plus `js/vendor/qrcode.LICENSE`; pure `js/core/qr.js` draws an
  inline SVG path; shown only above 900px with an `aria-label` pointing to the
  button. `tests/qr.test.js` (3 cases) was written with the module, so no RED
  was observed for it. Not decoded with a scanner (no decoder installed); the
  test checks the matrix against the library.
- T5: `e88ba0d` docs(contract). 202 row and example, Start-link rule,
  Authorization header, Cloud Storage `cases-inbox` hand-off with attributes as
  object metadata, CORS and API Gateway, JWT customer match, informational
  Telegram handle. `schema_version` stays `"1.1"`.
- T6: `879121e` docs. `docs/screenshots/success-telegram.png` (1440 wide, EN,
  button and QR) and `success-telegram-mobile.png` (390 wide, ES, full-width
  button, no QR), from a scratch copy with a stubbed fetch (not committed).
  The demo-mode neutral path was checked the same way. README config and
  credits updated.
- Checks: `node --test tests/` 53/53 (i18n key parity included).

## Next step

Parent review. Possible follow-up: the technical view still labels the
metadata "Pub/Sub attributes" (`success.tech.attributes`).

## Native review (2026-10-04)

- Range `2c37e6e..1adbae6`. Assessed as medium (`slice_budget_reached`). The
  user granted consent.
- One lens (reliability): **approved**. Acknowledged; authority burned
  (lineage `review-e7b3d859d6d905af`).
- The parent decoded the QR in the success screenshot with OpenCV and got the
  stub `https://t.me/lir_bank_bot?start=...` URL.
- Advisory follow-ups (suggestions, not blocking):
  - [ ] R3-start-url-credential-port-untested (`js/core/submit.js:30-31`): add
    tests for credentials and for a non-default port on the exact `t.me` host.
  - [ ] R3-success-handoff-decision-untested (`js/ui/success.js:13-18`):
    extract the linked, unlinked and non-telegram decision into a pure
    `js/core` helper with tests.
