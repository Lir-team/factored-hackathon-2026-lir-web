# Case contract

What a backend must accept from `lir-web`, and how it should hand the case to
the Lir agent. The frontend defines this contract; the backend does not exist
yet.

- Payload schema: [`schema/case.schema.json`](../schema/case.schema.json)
  (JSON Schema 2020-12, `schema_version` `"1.1"`).
- Payload builder: `buildCasePayload` in `js/core/case-payload.js`.
- Pub/Sub attributes: `pubsubAttributesFor` in the same module.

## Endpoint: `POST /v1/cases`

Request headers:

| Header            | Value                                              |
|-------------------|----------------------------------------------------|
| `Content-Type`    | `application/json`                                 |
| `Accept`          | `application/json`                                 |
| `Idempotency-Key` | the payload's `case_id` (a client UUID v4)         |

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
| `202`  | `{"case_id": "…", "folio": "LB-2026-3F2A9C", "status": "received"}` | stamps the slip, shows the folio |
| `422`  | `{"errors": {"description": "too_short"}}`                  | shows each error next to its field; new `case_id` |
| other 4xx | any                                                      | "the bank rejected the report", retry with a new `case_id` |
| 5xx, network, 15 s timeout | any                                     | keeps the answers, offers a retry        |

Error codes are field-scoped. The client already translates `required`,
`too_short`, `too_long`, `too_many`, `unknown`, `invalid`, `in_future`,
`invalid_phone`, `invalid_email` and `invalid_telegram`; any other code shows
a generic "check this answer" message. Unknown field names, or a 4xx without
an `errors` map, show the "the bank rejected the report" line instead. Field
names match the form:
`category`, `transaction_ids`, `card_last4`, `incident_occurred_at`,
`card_in_possession`, `shared_credentials`, `description`, `contact_channel`,
`contact_value`, `declaration`.

`folio` is optional. Without it, the client derives one as
`LB-<year>-<first 6 hex of case_id>`.

The backend must re-validate everything. In particular, it must check that
`customer.customer_id` matches the authenticated session and that every
`transaction_id` belongs to that customer.

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

## Publishing to Pub/Sub

- Topic: `lir-cases`.
- Message data: the payload JSON, UTF-8, unchanged.
- Attributes: `pubsubAttributesFor(payload)`, all strings:

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

- Ordering key: `customer.customer_id`, so one customer's cases arrive in
  order (the subscription needs message ordering enabled).
- Publish only after the payload passes the schema, then answer `202`.
- A fraud-only subscription can filter on attributes:
  `attributes.fraud_suspected = "true"`. Another example:
  `attributes.priority_hint = "critical" AND attributes.country = "MX"`.

## CORS and IAP

- Serve the page and the API from the same origin (for example, a load
  balancer routing `/v1/*` to the API and `/` to the static files). Then no
  CORS is needed and `casesEndpoint` can be the relative path `/v1/cases`.
- If the API must live on another origin, allow only the page's origin, the
  `POST` method and the `Content-Type` and `Idempotency-Key` headers.
  `Idempotency-Key` makes the request non-simple, so the API must answer the
  `OPTIONS` preflight.
- Behind Identity-Aware Proxy, same origin matters even more: browsers send
  the `OPTIONS` preflight without credentials, and IAP rejects it unless its
  "allow HTTP OPTIONS" setting is on. Keeping the page and the API behind the
  same IAP-protected origin avoids both the preflight and the setting.
