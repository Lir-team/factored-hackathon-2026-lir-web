/*
 * Runtime configuration. Loaded as a classic script before the app module,
 * so a deployment can replace this file without rebuilding anything.
 *
 * casesEndpoint: URL that accepts POST /v1/cases (see docs/case-contract.md).
 *   null -> demo mode: the request is simulated and nothing leaves the browser.
 *   Prefer a same-origin path such as "/v1/cases" to avoid CORS.
 */
window.LIR_CONFIG = Object.assign(
  {
    casesEndpoint: null,
  },
  window.LIR_CONFIG,
);
