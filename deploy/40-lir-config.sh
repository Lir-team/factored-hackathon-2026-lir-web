#!/bin/sh
# Writes js/config.js from the environment at start-up, so one image serves every deployment.
# Unset LIR_CASES_ENDPOINT keeps demo mode (the request is simulated in the browser).
set -eu
json() { if [ -n "${1:-}" ]; then printf '"%s"' "$1"; else printf 'null'; fi; }
cat > /usr/share/nginx/html/js/config.js <<CONFIG
window.LIR_CONFIG = Object.assign(
  {
    casesEndpoint: $(json "${LIR_CASES_ENDPOINT:-}"),
    apiKey: $(json "${LIR_API_KEY:-}"),
    approvalsEndpoint: $(json "${LIR_APPROVALS_ENDPOINT:-}"),
    transactionsEndpoint: $(json "${LIR_TRANSACTIONS_ENDPOINT:-}"),
    authToken: $(json "${LIR_AUTH_TOKEN:-}"),
    signInEndpoint: $(json "${LIR_SIGN_IN_ENDPOINT:-}"),
  },
  window.LIR_CONFIG,
);
CONFIG
