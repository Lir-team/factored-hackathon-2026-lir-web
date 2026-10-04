# Feature: bank-support-form

Repository: `lir-web` (local, not pushed). Locator: `odd/tasks/bank-support-form.md`.
Engram mirror: `odd/bank-support-form/tasks`.

## Objective

A sample LATAM Bank customer frontend, built with plain HTML, CSS and JS and no
build step or framework. A signed-in customer fills a support form, and the
form produces a case payload that a future backend can publish to Pub/Sub.

## Problem and why

- The hackathon requires a deployed, working tool and a demo video. The
  evaluation scores the frontend under AI Engineering.
- The Lir agent (`factored-hackathon-2026-lir-agent`) has no web entry point.
  Its README plans `POST /v1/cases`, but that route is not implemented
  (explorer finding, `README.md:28-38`).
- The highest-value path is "No reconozco este cargo" (unrecognized charge or
  fraud). It must be a first-class category.

## Scope

- In scope:
  - the form UI
  - the categories, mapped to agent intents
  - a pure payload builder
  - a configurable POST endpoint with a demo fallback
  - ES/PT/EN copy
  - the contract docs and a JSON Schema for the future backend
- Out of scope:
  - the backend, Pub/Sub and infra (the user said "do not write the backend yet")
  - real authentication
  - pushing to GitHub

## Constraints

- Vanilla HTML/CSS/JS only: no framework, no bundler, no npm dependencies.
  Native ES modules are fine. Tests use the built-in `node --test` (Node 18).
- Follow `.claude/skills/frontend-design/SKILL.md` and `docs/design-plan.md`.
- Spanish and Portuguese are required by the hackathon FAQ. English is added
  for the judges.

## Category contract (summary)

| `category`            | Agent intent hint      | Fraud flag |
|-----------------------|------------------------|------------|
| `unrecognized_charge` | `cargo_no_reconocido`  | yes        |
| `card_lost_stolen`    | `cargo_no_reconocido`  | yes        |
| `improper_fee`        | `cobro_indebido`       | no         |
| `transaction_inquiry` | `consulta_movimiento`  | no         |
| `app_issue`           | `otra_queja`           | no         |
| `service_complaint`   | `otra_queja`           | no         |
| `other_request`       | `fuera_de_alcance`     | no         |

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: about 1,300 authored lines (mostly CSS, copy and markup). This is
  over the 400-line budget, so the work goes in per-stage work-unit commits on
  `feat/bank-support-form`. The user asked for stages, so each stage is one
  commit and one slice. The PR strategy is decided when pushing.

## Tasks

- [x] T0: Bootstrap. Create the repo, vendor the frontend-design skill
  (Apache-2.0), and write the design plan. Route: inline.
- [x] T1, scaffold: `index.html` shell, design tokens, base CSS, top bar,
  README. Route: delegated writer (2+ non-trivial files).
- [x] T2, form: the categories, the statement picker for charges, conditional
  steps, and the live case slip. Route: delegated writer.
- [x] T3, behavior: a pure `case-payload.js` with `node --test` tests (RED
  first), validation, submission to the configurable endpoint, demo mode, and
  the confirmation state. Route: delegated writer.
- [x] T4, i18n: ES/PT/EN dictionaries, a language switch, and `lang` set on
  `<html>`. Route: delegated writer.
- [x] T5, contract and polish: `docs/case-contract.md`,
  `schema/case.schema.json`, a11y and responsive passes, and a screenshot
  critique. Route: delegated writer, then a parent screenshot check.

## Acceptance criteria

- Opening `index.html` through any static server shows the form. No build step
  is needed.
- Picking "I don't recognize a charge" requires choosing a transaction and
  raises the card-freeze offer.
- Submitting produces a payload that is valid against
  `schema/case.schema.json`. It is POSTed when an endpoint is configured;
  otherwise demo mode shows a reference and the payload.
- `node --test` passes, and the keyboard alone can complete the form.

## Checks

- `node --test tests/`
- A headless Firefox screenshot at desktop and mobile widths.

## Progress and evidence

- T0: done. Engram mirror: PENDING (ambiguous_project: the MCP cwd is the parent folder, which holds several repos).
- T1: `a9f5ac9` feat(scaffold). Route: delegated writer. Shell, tokens, base
  layout, README.
- T2: `ef69da2` feat(form). Route: delegated writer. Categories, statement
  picker, card and incident step, conditional steps with renumbering, fraud
  block with freeze toggle, live slip. Checked with a headless Firefox
  screenshot of `?reason=unrecognized_charge`. Added a root `package.json`
  with only `"type": "module"` and a `test` script so Node loads the ES
  modules. About 1,650 lines, mostly markup, CSS and copy.
- T3: `cd2f10a` feat(form). Route: delegated writer. Test-first: RED was
  `node --test tests/` failing both files with `ERR_MODULE_NOT_FOUND`
  (`case-payload.js`, `submit.js` missing); GREEN was 24/24 passing. Error
  summary, inline errors, demo mode, retry with a stable Idempotency-Key, and
  the stamped confirmation were checked in headless Firefox with a throwaway
  driver script in a scratch copy (not committed).
- T4: `b882b6b` feat(i18n). Route: delegated writer. `node --test tests/`:
  28/28. A live switch to EN kept the answers and set `<html lang="en">`, the
  title, the Intl formats and localStorage (headless Firefox check).
- T5: feat(contract), the last commit on the branch. Route: delegated writer.
  Schema, schema test with a small hand-written checker, contract doc, focus
  polish. `node --test tests/`: 37/37. Screenshots in `docs/screenshots/`
  (desktop 1440, mobile 390, lost-card path at 360); one critique pass moved
  the slip stamp off the folio.

## Next step

Parent screenshot check, then decide the PR strategy (the branch is about
3,900 authored lines over five work-unit commits) and the native review.
