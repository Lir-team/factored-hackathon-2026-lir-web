/*
 * Runtime configuration. Loaded as a classic script before the app module,
 * so a deployment can replace this file without rebuilding anything.
 *
 * Values set earlier in window.LIR_CONFIG win: index.html loads the untracked
 * js/config.local.js first (copy js/config.local.example.js), so a local run
 * can point at the deployed API Gateway without editing this file. When that
 * file is missing, the browser skips it and these defaults apply.
 *
 * casesEndpoint: the URL of POST /v1/cases (see docs/case-contract.md). The
 *   default is the local lir-agent API; deployments point it at the API Gateway.
 *   null -> demo mode: the request is simulated and nothing leaves the browser.
 * apiKey: the API Gateway key, sent as the `key` query parameter on the cases
 *   request. null -> no key (the local lir-agent API needs none).
 * transactionsEndpoint: the URL of GET /v1/me/transactions; with authToken set, the
 *   page shows the signed-in customer's statement from the API. null -> demo customer.
 * approvalsEndpoint: the base URL of /v1/approvals, used by the approval card
 *   (aprobar.html). The agent's link to the card carries the request id and a
 *   single-use token.
 * authToken: the customer JWT the gateway checks when customer sign-in is on,
 *   sent as "Authorization: Bearer <token>". Sign-in is mocked in this demo, so
 *   the token is issued outside this repo. null -> no Authorization header.
 * signInEndpoint: the URL of the bank sign-in (the demo one: POST /v1/demo/sign-in).
 *   When set, the page asks it for a short-lived token instead of using authToken.
 */
window.LIR_CONFIG = Object.assign(
  {
    casesEndpoint: "http://localhost:8080/v1/cases",
    apiKey: null,
    approvalsEndpoint: "http://localhost:8080/v1/approvals",
    transactionsEndpoint: "http://localhost:8080/v1/me/transactions",
    authToken: null,
    signInEndpoint: null,
  },
  window.LIR_CONFIG,
);
