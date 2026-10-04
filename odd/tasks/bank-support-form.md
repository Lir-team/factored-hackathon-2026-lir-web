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
- [ ] T1, scaffold: `index.html` shell, design tokens, base CSS, top bar,
  README. Route: delegated writer (2+ non-trivial files).
- [ ] T2, form: the categories, the statement picker for charges, conditional
  steps, and the live case slip. Route: delegated writer.
- [ ] T3, behavior: a pure `case-payload.js` with `node --test` tests (RED
  first), validation, submission to the configurable endpoint, demo mode, and
  the confirmation state. Route: delegated writer.
- [ ] T4, i18n: ES/PT/EN dictionaries, a language switch, and `lang` set on
  `<html>`. Route: delegated writer.
- [ ] T5, contract and polish: `docs/case-contract.md`,
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

## Next step

T1.
