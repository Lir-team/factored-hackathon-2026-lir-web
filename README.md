# lir-web

The customer-facing support form of **LATAM Bank**, the synthetic bank of the
Factored AI & Data Hackathon 2026. A signed-in customer reports a problem
(an unrecognized charge, a lost or stolen card, a wrong fee, and so on), and
the page builds a versioned case payload that a backend can publish to
Pub/Sub for the Lir agent.

It is plain HTML, CSS and JavaScript: no framework, no bundler, no npm
dependencies. The backend does not exist yet; this repo defines the contract
it should accept.

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

## Configure it

`js/config.js` sets `window.LIR_CONFIG`. With `casesEndpoint: null` (the
default) the page runs in demo mode: it simulates the request and shows a
reference number and the payload. Set it to a URL to POST real cases.

## Folder layout

```
index.html          page shell
css/                tokens, base layout, form and slip styles
js/                 app entry, config, UI modules, pure core logic, i18n
tests/              node --test suites for the pure modules
docs/               design plan and backend contract
schema/             JSON Schema for the case payload
odd/tasks/          feature task document
```

## Credits

The visual direction follows Anthropic's `frontend-design` skill, vendored
under `.claude/skills/frontend-design/` and licensed under Apache-2.0 (see
the `LICENSE.txt` next to it). The design decisions for this page are in
[`docs/design-plan.md`](docs/design-plan.md).
