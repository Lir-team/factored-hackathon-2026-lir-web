import { test } from "node:test";
import assert from "node:assert/strict";

import { submitCase } from "../js/core/submit.js";

const payload = {
  schema_version: "1.0",
  case_id: "3f2a9c1e-7b4d-4e8a-9c21-5d6e7f809a1b",
  submitted_at: "2026-10-04T16:00:00.000Z",
};

function fakeFetch(response) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => {
        if (response.body === undefined) throw new SyntaxError("no body");
        return response.body;
      },
    };
  };
  return { impl, calls };
}

test("demo mode answers with a folio without calling fetch", async () => {
  const { impl, calls } = fakeFetch({ status: 500 });
  const outcome = await submitCase(payload, { endpoint: null, fetchImpl: impl, demoDelayMs: 0 });
  assert.deepEqual(outcome, {
    ok: true,
    mode: "demo",
    case_id: payload.case_id,
    folio: "LB-2026-3F2A9C",
    status: "received",
  });
  assert.equal(calls.length, 0);
});

test("a configured endpoint gets a JSON POST with an Idempotency-Key", async () => {
  const { impl, calls } = fakeFetch({
    status: 202,
    body: { case_id: payload.case_id, folio: "LB-2026-SERVER", status: "received" },
  });
  const outcome = await submitCase(payload, { endpoint: "https://api.example/v1/cases", fetchImpl: impl });
  assert.equal(calls[0].url, "https://api.example/v1/cases");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.headers["Idempotency-Key"], payload.case_id);
  assert.deepEqual(JSON.parse(calls[0].init.body), payload);
  assert.deepEqual(outcome, {
    ok: true,
    mode: "live",
    case_id: payload.case_id,
    folio: "LB-2026-SERVER",
    status: "received",
  });
});

test("a 2xx without a body still yields a folio", async () => {
  const { impl } = fakeFetch({ status: 201 });
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.folio, "LB-2026-3F2A9C");
});

test("a 4xx returns the field errors from the server", async () => {
  const { impl } = fakeFetch({ status: 422, body: { errors: { description: "too_short" } } });
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
  assert.deepEqual(outcome, { ok: false, kind: "rejected", status: 422, errors: { description: "too_short" } });
});

test("a 5xx is reported as a server failure", async () => {
  const { impl } = fakeFetch({ status: 503 });
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
  assert.deepEqual(outcome, { ok: false, kind: "server", status: 503 });
});

test("a network error is reported so the form can offer a retry", async () => {
  const { impl } = fakeFetch(new TypeError("Failed to fetch"));
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
  assert.deepEqual(outcome, { ok: false, kind: "network" });
});

test("a 4xx without a JSON body is a rejection with no field errors", async () => {
  const { impl } = fakeFetch({ status: 400 });
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
  assert.deepEqual(outcome, { ok: false, kind: "rejected", status: 400, errors: {} });
});

const never = () => new Promise(() => {});

test("a request that never answers times out as a network failure", { timeout: 2000 }, async () => {
  // Ignores the abort signal on purpose: the timeout must not depend on fetch honoring it.
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: never, timeoutMs: 20 });
  assert.deepEqual(outcome, { ok: false, kind: "network" });
});

test("a body that never arrives times out too, and the request is aborted", { timeout: 2000 }, async () => {
  let signal;
  const impl = async (url, init) => {
    signal = init.signal;
    return { ok: true, status: 202, json: never };
  };
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl, timeoutMs: 20 });
  assert.deepEqual(outcome, { ok: false, kind: "network" });
  assert.equal(signal.aborted, true);
});
