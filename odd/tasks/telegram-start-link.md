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

- [ ] T1, plan: this document and the brief. Commit `docs(odd)`.
- [ ] T2, submit: test-first `telegram_start_url` pass-through and validation,
  and the `Authorization` header; `casesEndpoint`/`authToken` in config.
- [ ] T3, success screen: Telegram button, explanation, neutral fallback, i18n
  in three languages.
- [ ] T4, QR: vendor one small MIT QR generator under `js/vendor/`, render on
  wide screens only, credit in README.
- [ ] T5, contract: `docs/case-contract.md` per the brief.
- [ ] T6, screenshots and README: success screen with the Telegram button.

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

- T1: in progress.

## Next step

T2, submit (test-first).
