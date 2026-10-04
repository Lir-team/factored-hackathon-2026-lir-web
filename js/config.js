/*
 * Runtime configuration. Loaded as a classic script before the app module,
 * so a deployment can replace this file without rebuilding anything.
 *
 * casesEndpoint: the URL of POST /v1/cases (see docs/case-contract.md). The
 *   default is the local lir-agent API; deployments point it at the API Gateway.
 *   null -> demo mode: the request is simulated and nothing leaves the browser.
 * authToken: the customer JWT the gateway checks, sent as
 *   "Authorization: Bearer <token>". Sign-in is mocked in this demo, so the
 *   token is issued outside this repo. null -> no Authorization header.
 */
window.LIR_CONFIG = Object.assign(
  {
    casesEndpoint: "http://localhost:8080/v1/cases",
    authToken: null,
  },
  window.LIR_CONFIG,
);
