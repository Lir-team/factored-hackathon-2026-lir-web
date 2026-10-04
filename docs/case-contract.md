# Case contract

What a backend must accept from `lir-web`, and how it should hand the case to
the Lir agent. The frontend defines this contract; the backend does not exist
yet.

- Payload schema: [`schema/case.schema.json`](../schema/case.schema.json)
  (JSON Schema 2020-12, `schema_version` `"1.0"`).
- Payload builder: `buildCasePayload` in `js/core/case-payload.js`.
- Pub/Sub attributes: `pubsubAttributesFor` in the same module.

## Endpoint: `POST /v1/cases`

Request headers:

| Header            | Value                                              |
|-------------------|----------------------------------------------------|
| `Content-Type`    | `application/json`                                 |
| `Accept`          | `application/json`                                 |
| `Idempotency-Key` | the payload's `case_id` (a client UUID v4)         |

The client keeps the same `case_id` across retries until it gets a success,
so the backend must treat a repeated `Idempotency-Key` as the same case and
answer with the original response.

Responses:

| Status | Body                                                        | Client behavior                          |
|--------|-------------------------------------------------------------|------------------------------------------|
| `202`  | `{"case_id": "…", "folio": "LB-2026-3F2A9C", "status": "received"}` | stamps the slip, shows the folio |
| `422`  | `{"errors": {"description": "too_short"}}`                  | shows each error next to its field       |
| other 4xx | any                                                      | "the bank rejected the report", retry    |
| 5xx, network, 15 s timeout | any                                     | keeps the answers, offers a retry        |

Error codes are field-scoped. The client already translates `required`,
`too_short`, `too_long`, `too_many`, `unknown`, `invalid`, `in_future`,
`invalid_phone`, `invalid_email` and `invalid_telegram`; any other code shows
a generic "check this answer" message. Field names match the form:
`category`, `transaction_ids`, `card_last4`, `incident_occurred_at`,
`card_in_possession`, `shared_credentials`, `description`, `contact_channel`,
`contact_value`, `declaration`.

`folio` is optional. Without it, the client derives one as
`LB-<year>-<first 6 hex of case_id>`.

The backend must re-validate everything. In particular, it must check that
`customer.customer_id` matches the authenticated session and that every
`transaction_id` belongs to that customer.

## Categories

| `category`            | `intent_hint`         | `fraud_suspected` | Transactions        | Card     |
|-----------------------|-----------------------|-------------------|---------------------|----------|
| `unrecognized_charge` | `cargo_no_reconocido` | `true`            | 1 or more, required | from the first charge |
| `card_lost_stolen`    | `cargo_no_reconocido` | `true`            | optional (used after the loss) | required |
| `improper_fee`        | `cobro_indebido`      | `false`           | exactly 1           | from the charge |
| `transaction_inquiry` | `consulta_movimiento` | `false`           | exactly 1           | from the charge |
| `app_issue`           | `otra_queja`          | `false`           | none                | `null`   |
| `service_complaint`   | `otra_queja`          | `false`           | none                | `null`   |
| `other_request`       | `fuera_de_alcance`    | `false`           | none                | `null`   |

Fraud categories carry an `incident` object and may set
`freeze_card_requested`; other categories send `incident: null` and
`freeze_card_requested: false`.

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
    "schema_version": "1.0"
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
