# lir-web

The customer-facing support form of **LATAM Bank**, the synthetic bank of the
Factored AI & Data Hackathon 2026. A signed-in customer reports a problem
(an unrecognized charge, a lost or stolen card, a wrong fee, and so on), and
the page builds a versioned case payload that a backend can publish to
Pub/Sub for the Lir agent.

It is plain HTML, CSS and JavaScript: no framework, no bundler, no npm
dependencies. The backend does not exist yet; this repo defines the contract
it should accept.

![Desktop, unrecognized-charge path](docs/screenshots/desktop-fraud.png)

More screenshots: [desktop](docs/screenshots/desktop.png),
[mobile](docs/screenshots/mobile.png),
[mobile, lost card](docs/screenshots/mobile-lost-card.png).

## Run it

ES modules do not load from `file://`, so serve the folder with any static
server:

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080/>.

## Test it

The pure logic modules do not touch the DOM, so Node's built-in test runner
covers them (Node 18 or later, nothing to install):

```sh
node --test tests/
```

Useful links while demoing: `?reason=unrecognized_charge` preselects a reason,
and `?lang=pt` or `?lang=en` picks the language (the switch in the top bar
remembers the choice).

## Configure it

`js/config.js` sets `window.LIR_CONFIG`. With `casesEndpoint: null` (the
default) the page runs in demo mode: it simulates the request and shows a
reference number and the payload. Set it to a URL to POST real cases.

## Backend contract

The page sends a versioned JSON case to `POST /v1/cases` with an
`Idempotency-Key`. The endpoint, error shape, category-to-intent mapping and
the Pub/Sub publishing guidance are in
[`docs/case-contract.md`](docs/case-contract.md); the payload schema is
[`schema/case.schema.json`](schema/case.schema.json).

## Languages

Spanish (default), Brazilian Portuguese and English live in `js/i18n/`. A test
checks that the three dictionaries have the same keys and placeholders.

## Folder layout

```
index.html          page shell
css/                tokens, base layout, form and slip styles
js/                 app entry, config, UI modules, pure core logic, i18n
tests/              node --test suites for the pure modules
docs/               design plan, backend contract, screenshots
schema/             JSON Schema for the case payload
odd/tasks/          feature task document
```

## Credits

The visual direction follows Anthropic's `frontend-design` skill, kept
under `.claude/skills/frontend-design/` and licensed under Apache-2.0 (see
the `LICENSE.txt` next to it). The design decisions for this page are in
[`docs/design-plan.md`](docs/design-plan.md).
