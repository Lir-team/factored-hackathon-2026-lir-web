# Case contract

What a backend must accept from `lir-web`, and how it should hand the case to
the Lir agent. The frontend defines this contract; the backend that implements
it is the `lir-agent` repo (feature `case-intake-telegram`), behind Google API
Gateway.

- Payload schema: [`schema/case.schema.json`](../schema/case.schema.json)
  (JSON Schema 2020-12, `schema_version` `"1.1"`).
- Payload builder: `buildCasePayload` in `js/core/case-payload.js`.
- Case attributes (Pub/Sub message attributes, and the archived object's
  metadata): `pubsubAttributesFor` in the same module.
- A transaction's `merchant` is `null` when the charge has none (a bank
  transfer). The key is always present; the client never invents a merchant.

## Endpoint: `POST /v1/cases`

Request headers:

| Header            | Value                                              |
|-------------------|----------------------------------------------------|
| `Content-Type`    | `application/json`                                 |
| `Accept`          | `application/json`                                 |
| `Idempotency-Key` | the payload's `case_id` (a client UUID v4)         |
| `Authorization`   | `Bearer <customer JWT>`, from the sign-in (`signInEndpoint`) or a local `authToken` |

Through API Gateway the request also carries the gateway's API key as the
`key` query parameter (`POST /v1/cases?key=<apiKey>`), only when `apiKey` is
set in the config. The local lir-agent API needs no key.

The client keeps the same `case_id` when it retries after a network error, a
timeout or a 5xx, so the backend must treat a repeated `Idempotency-Key` as
the same case and answer with the original successful response. Replay applies
only to that same key:

- After a 4xx the client rotates the key: the corrected answers go out with a
  new `case_id`, so they are never answered with the replayed rejection.
- The backend should store only successful (2xx) responses for replay. A key
  whose earlier attempt failed is processed again as a fresh request.

Responses:

| Status | Body                                                        | Client behavior                          |
|--------|-------------------------------------------------------------|------------------------------------------|
| `202`  | `{"case_id": "…", "folio": "LB-2026-3F2A9C", "status": "received", "telegram_start_url": "https://t.me/…?start=…"}` | stamps the slip, shows the folio; a Telegram Start link adds a "Continue on Telegram" button |
| `422`  | `{"errors": {"description": "too_short"}}`                  | shows each error next to its field; new `case_id` |
| other 4xx | any                                                      | "the bank rejected the report", retry with a new `case_id` |
| 5xx, network, 15 s timeout | any                                     | keeps the answers, offers a retry        |

Error codes are field-scoped. The client already translates `required`,
`too_short`, `too_long`, `too_many`, `unknown`, `invalid`, `in_future`,
`invalid_phone`, `invalid_email` and `invalid_telegram` (for `transaction_ids`:
`required`, `too_many`, `unknown` and `invalid`); any other code shows
a generic "check this answer" message. Unknown field names, or a 4xx without
an `errors` map, show the "the bank rejected the report" line instead. Field
names match the form:
`category`, `transaction_ids`, `card_last4`, `incident_occurred_at`,
`card_in_possession`, `shared_credentials`, `description`, `contact_channel`,
`contact_value`, `declaration`.

`folio` is optional. Without it, the client derives one as
`LB-<year>-<first 6 hex of case_id>`.

A full `202` body:

```json
{
  "case_id": "6f1c…",
  "folio": "LB-2026-3F2A9C",
  "status": "received",
  "telegram_start_url": "https://t.me/<lir_bot>?start=<single-use token>"
}
```

The backend must re-validate everything. In particular, it checks that every
`transaction_id` belongs to the customer and, when it requires a customer
identity (`REQUIRE_IDENTITY=true`), that `customer.customer_id` matches the
customer in the JWT. Customer sign-in is a lir-infra toggle (`customer_sign_in`,
off by default). Off, the cases service runs with `REQUIRE_IDENTITY=false`: it
trusts the payload's `customer_id`, and the API key is what keeps strangers out.
On, the gateway also requires the customer JWT on `POST /v1/cases` and on the
approval routes, and the service runs with `REQUIRE_IDENTITY=true`.

## Telegram Start link

A Telegram bot cannot write to someone first: it can only message a person who
has opened a chat with it and pressed **Start**, and it cannot find anyone by
`@username` or phone number. So the backend does not message the handle the
customer typed; it hands the page a deep link instead.

- `telegram_start_url` is present when `preferred_contact.channel` is
  `telegram`, and may be absent or `null` otherwise.
- It must be an `https://t.me/` URL. The client keeps it only when it parses
  with protocol `https:` and host exactly `t.me`; anything else becomes `null`
  and the page shows no button and makes no Telegram promise.
- The `start` parameter is an opaque, single-use token that ties the chat to
  the case. The page never shows it as text, never logs it and never stores it
  in `localStorage`; it only lives in the button's `href` (and its QR code).
- When the customer presses **Start**, the bot links the chat to the case and
  Lir continues there. The page does nothing else.
- `preferred_contact.value` for `telegram` (the `@username` or number) is
  informational only: the bot cannot reach it, and the Start link is the only
  way the conversation begins.
- Without a link (an older backend, or demo mode) the page says the bank will
  get in touch, without promising a Telegram message.

## Categories

| `category`            | `intent_hint`         | `fraud_suspected` | Transactions        | `cards`  |
|-----------------------|-----------------------|-------------------|---------------------|----------|
| `unrecognized_charge` | `cargo_no_reconocido` | `true`            | 1 or more, required | every card behind the charges |
| `card_lost_stolen`    | `cargo_no_reconocido` | `true`            | optional (used after the loss) | the picked card (exactly 1) |
| `improper_fee`        | `cobro_indebido`      | `false`           | exactly 1           | the charge's card |
| `transaction_inquiry` | `consulta_movimiento` | `false`           | exactly 1           | the charge's card |
| `app_issue`           | `otra_queja`          | `false`           | none                | `[]`     |
| `service_complaint`   | `otra_queja`          | `false`           | none                | `[]`     |
| `other_request`       | `fuera_de_alcance`    | `false`           | none                | `[]`     |

`cards` lists each card once, in statement order. Fraud categories carry an
`incident` object and may set `freeze_card_requested`, which applies to every
card in `cards` (charges on two cards freeze both); other categories send
`incident: null` and `freeze_card_requested: false`.

Version 1.1 replaced the single `card` object (or `null`) of 1.0 with the
`cards` array, so a report with charges on several cards no longer drops all
but the first.

`intent_hint` and `priority_hint` are hints. The agent re-classifies the
intent, and the server owns priority. The client rule is: `critical` for a
lost or stolen card, or for a fraud report with a foreign charge or a total of
about USD 1,000 or more; `high` for other fraud; `medium` for a fee, app or
service problem; `low` otherwise.

`language` is `es`, `pt` or `en`. The agent speaks `es` and `pt`, so a backend
should map `en` to `es` (or reply in English if the agent learns it).

## Handing the case to the agent

The backend publishes each accepted case to Pub/Sub itself. There is no Cloud
Storage bucket notification:

1. After the payload passes validation, the backend archives it in the cases
   inbox bucket as `cases/<case_id>.json` (the payload JSON, unchanged), with
   the case attributes as the object's custom metadata. The archive is a
   record only; nothing is triggered by it.
2. It publishes the payload JSON to the Pub/Sub topic `lir-cases`, with the
   case attributes as message attributes and the ordering key
   `customer.customer_id`, so one customer's cases arrive in order.
3. It answers `202`. A push subscription then delivers the message to the
   agent, which works the case straight from the message.

The case attributes, `pubsubAttributesFor(payload)`, are all strings:

  ```json
  {
    "category": "unrecognized_charge",
    "intent_hint": "cargo_no_reconocido",
    "fraud_suspected": "true",
    "priority_hint": "critical",
    "country": "MX",
    "language": "es",
    "schema_version": "1.1"
  }
  ```

They let a subscriber route on the case without parsing the payload; for
example, fraud cases have `fraud_suspected` = `"true"`.

## CORS and API Gateway

- `casesEndpoint` is the API Gateway URL of `POST /v1/cases`, on another
  origin than the page, so every request is cross-origin.
- `Content-Type: application/json` and `Idempotency-Key` make the request
  non-simple, so the browser sends an `OPTIONS` preflight first, without
  credentials and without the API key. The gateway passes the preflight
  through to the cases service, which answers it from `CORS_ORIGINS`.
- Allow only the page's origin (`http://localhost:5500` for the local page),
  the `POST` method, and the `Content-Type`, `Idempotency-Key` and
  `Authorization` headers.
- The gateway checks the API key on `POST /v1/cases`. When customer sign-in
  is enabled it also checks the customer JWT, and the backend checks that
  `customer.customer_id` matches the JWT's customer.
