# Goal: connect the form to the real backend and hand off to Telegram

A task brief for an AI agent working in this repo. Read `README.md`,
`docs/case-contract.md` and `schema/case.schema.json` first. Keep the
project's rules: plain HTML, CSS and ES modules, no npm dependencies, pure
logic in `js/core/` covered by `node --test tests/`, and the three i18n
dictionaries (`es`, `pt`, `en`) with identical keys.

## Why this change

The backend now exists as a design (the `lir-agent` repo, feature
`case-intake-telegram`). Two facts change what the form must do:

1. **Telegram bots cannot message a user first.** A bot can only write to a
   person who has already opened a chat with it and pressed **Start**, and it
   cannot find anyone by `@username` or phone number. The current success copy
   ("Lir ... messages you on Telegram ({value})", `success.next.contact.telegram`)
   promises something that cannot happen.
2. **The API sits behind Google API Gateway**, which requires a customer JWT
   and lives on another origin. The contract's "CORS and IAP" section no longer
   applies.

## Target flow

1. The customer fills the form and submits.
2. The page sends `POST /v1/cases` to the API Gateway URL with
   `Authorization: Bearer <customer JWT>` (plus the existing headers).
3. The backend answers `202`:

   ```json
   {
     "case_id": "6f1c...",
     "folio": "LB-2026-3F2A9C",
     "status": "received",
     "telegram_start_url": "https://t.me/<lir_bot>?start=<single-use token>"
   }
   ```

   `telegram_start_url` is present when `preferred_contact.channel` is
   `telegram`, and may be absent or `null` otherwise.
4. The success screen shows a primary **Continue on Telegram** button that
   opens `telegram_start_url` (new tab). On wide screens it also shows the same
   URL as a QR code so the customer can scan it with their phone.
5. The customer presses **Start** in Telegram; from then on Lir can ask
   follow-up questions there. The page does nothing else.

The token inside the URL is opaque and single use. Never show it as text,
never log it, never store it in `localStorage`.

## Changes

### Success screen (main deliverable)

- When the outcome carries `telegram_start_url`: render the button, the QR
  (wide screens only) and a short explanation, for example "To receive updates,
  open Telegram and press Start. Lir will message you there about this case."
  Replace the `success.next.contact.telegram` copy accordingly in all three
  languages.
- When the channel is `telegram` but no URL came back (older backend, or
  demo mode): show a neutral line saying the bank will contact them, without
  promising a Telegram message.
- Other channels keep their current copy.
- Accessibility: the button is a real link (`<a href>`), the QR has a text
  alternative pointing to the button, and focus moves to the success heading
  as it does today.

### Submit

- `js/core/submit.js`: pass `telegram_start_url` through in the `ok` outcome
  (`null` when absent). Accept only `https://t.me/` URLs; anything else becomes
  `null` (defense against a misconfigured or hostile response).
- Send `Authorization: Bearer <token>` when a token is configured.

### Config (`js/config.js`)

- `casesEndpoint`: the API Gateway URL of `POST /v1/cases`.
- `authToken`: the customer JWT for the demo (the bank's sign-in and the
  biometric check are mocked; the token is issued outside this repo).
  `null` sends no `Authorization` header.
- Demo mode (`casesEndpoint: null`) stays as it is, with no Telegram button.

### QR code

Optional. If you add it, vendor one small MIT-licensed QR generator under
`js/vendor/` with its license file and a note in the README credits. Do not add
npm dependencies. If it costs too much, ship the button alone.

### Contract doc (`docs/case-contract.md`)

- Add `telegram_start_url` to the `202` row and example, and explain the
  Start-link rule above.
- Replace "Publishing to Pub/Sub": the backend now stores each accepted case
  in Cloud Storage (`cases-inbox`); the bucket notification feeds Pub/Sub,
  which pushes it to the agent. The case attributes travel as object metadata.
  Keep `pubsubAttributesFor` (it still describes those attributes), but drop
  the ordering-key and direct-publish guidance.
  **Superseded (2026-10-04):** the agent publishes each case to Pub/Sub itself
  (ordering key `customer_id`) and the bucket copy is an archive only; there is
  no bucket notification. See `docs/case-contract.md`.
- Replace "CORS and IAP" with "CORS and API Gateway": cross-origin request,
  the gateway/backend must answer the `OPTIONS` preflight and allow the page's
  origin, `POST`, and the `Content-Type`, `Idempotency-Key` and `Authorization`
  headers.
- `customer.customer_id` must match the JWT's customer, as today.
- `preferred_contact.value` for `telegram` is informational only; say so.

The request payload does not change, so `schema_version` stays `"1.1"`.

## Out of scope

- Removing or redesigning the contact channels (WhatsApp, email and phone
  stay; only Telegram is live in the demo).
- Making the Telegram handle field optional (would change the schema).
- Real sign-in, token refresh, or any backend code.

## Acceptance criteria

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
