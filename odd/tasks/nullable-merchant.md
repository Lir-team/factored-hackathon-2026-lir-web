# Nullable merchant and API channel labels

## Objective

A customer can report charges that have no merchant (bank transfers), and the
statement shows readable channel names for the live bank API.

## Problem

- The bank API (`GET /v1/me/transactions`) returns `merchant: null` for transfers.
  The web form copies it into the case payload, the case schema requires a
  non-empty string, and the backend answers `422 {"errors": {"transaction_ids": "invalid"}}`.
- `error.transaction_ids.invalid` has no translation, so the form shows the
  generic "Revisa este dato." and the customer cannot tell what is wrong.
- The API sends channels as `ATM`, `POS`, `App`, `Transfer`, `Web`; the
  dictionaries only know `atm`, `pos`, `online`, so the page shows raw keys
  such as `channel.ATM`.

## Why

A real transfer has no merchant: the contract must say so instead of the web
inventing one. Unknown error codes must still tell the customer what to fix.

## Scope (authorized: contract change, web + backend)

- `lir-web`: `schema/case.schema.json`, `js/core/statement.js`,
  `js/core/case-payload.js` (only if needed), `js/i18n/{es,pt,en}.js`,
  `js/ui/render.js` (only if needed), `docs/case-contract.md`, tests.
- `factored-hackathon-2026-lir-agent` (`app/lir-agent`): its copy of
  `case.schema.json`, any code that reads `merchant` from a case payload, tests.

## Constraints

- Both schema copies stay byte-identical.
- No invented merchant in the payload.

## Tasks

- [x] T1 (web, delegated): `merchant` nullable in the schema, `error.transaction_ids.invalid`
      in es/pt/en, channels normalized to lowercase with labels for `app`, `transfer`, `web`;
      tests; contract doc.
- [x] T2 (backend, delegated): same schema change; null `merchant` handled wherever the case
      payload is read; tests.

## Acceptance criteria

- A case whose transactions have `merchant: null` passes the backend schema.
- Every `transaction_ids` code the backend can send has a translation.
- The statement shows translated channel names for every API channel value.

## Checks

- `lir-web`: `npm test`.
- backend: `uv run pytest` in `app/lir-agent`.

## Route

Delegated direct: two repos and several non-trivial files (writer trigger).

## Progress

- Branches `fix/nullable-merchant` created from `origin/main` in both repos.
- T1 done in `lir-web` `724e7c7` (`fix(case): accept charges without a merchant`): schema
  `merchant` is `string | null`; channels lowercased in `toCustomer`; `channel.app|transfer|web`
  and `error.transaction_ids.invalid` in es/pt/en; render omits a channel without a label.
  `npm test`: 78 pass, 0 fail (3 new tests seen RED first).
- T2 done in the backend `4931340` (`fix(cases): accept charges without a merchant`): schema copy
  byte-identical (`cmp`); no backend code reads `merchant` from a case payload (only
  `transaction_id`, `description`, incident fields). `uv run pytest -q`: 432 passed, 17 skipped.
- Open: the backend maps `minLength`/`maxLength` under `transactions` to `transaction_ids`
  `too_short`/`too_long`, which the web has no copy for (generic message). Only a broken client
  can trigger them.
