/*
 * Local override for js/config.js, for pointing the pages at the deployed
 * API Gateway. Copy it to js/config.local.js (git-ignored) and fill in the
 * values from `terraform output` in lir-infra:
 *
 *   cp js/config.local.example.js js/config.local.js
 *   terraform output                      # the gateway URL
 *   terraform output -raw cases_api_key   # the API key
 *
 * Never commit js/config.local.js: the API key is a secret.
 */
window.LIR_CONFIG = {
  casesEndpoint: "https://<gateway-host>/v1/cases",
  apiKey: "<cases_api_key>",
  approvalsEndpoint: "https://<gateway-host>/v1/approvals",
};
