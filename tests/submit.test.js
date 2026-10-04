import { test } from "node:test";
import assert from "node:assert/strict";

import { nextCaseId, partitionServerErrors, submitCase } from "../js/core/submit.js";

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
    telegram_start_url: null,
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
    telegram_start_url: null,
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

const FIELDS = ["description", "contact_value"];

test("a 4xx with only unknown error keys still asks for the generic rejection line", async () => {
  const { impl } = fakeFetch({ status: 422, body: { errors: { customer_id: "mismatch" } } });
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
  assert.deepEqual(partitionServerErrors(outcome.errors, FIELDS), { fields: {}, generic: true });
});

test("partitionServerErrors keeps the fields the form can show", () => {
  assert.deepEqual(partitionServerErrors({ description: "too_short" }, FIELDS), {
    fields: { description: "too_short" },
    generic: false,
  });
  assert.deepEqual(partitionServerErrors({ description: "too_short", foo: "bar" }, FIELDS), {
    fields: { description: "too_short" },
    generic: true,
  });
  assert.deepEqual(partitionServerErrors({}, FIELDS), { fields: {}, generic: true });
  assert.deepEqual(partitionServerErrors(null, FIELDS), { fields: {}, generic: true });
  assert.deepEqual(partitionServerErrors({ description: 42 }, FIELDS), { fields: {}, generic: true });
});

test("nextCaseId rotates the Idempotency-Key only after a rejection", () => {
  const makeId = () => "new-id";
  assert.equal(nextCaseId({ ok: false, kind: "rejected", status: 422, errors: {} }, "old-id", makeId), "new-id");
  assert.equal(nextCaseId({ ok: false, kind: "network" }, "old-id", makeId), "old-id");
  assert.equal(nextCaseId({ ok: false, kind: "server", status: 503 }, "old-id", makeId), "old-id");
  assert.equal(nextCaseId({ ok: true, mode: "live" }, "old-id", makeId), "old-id");
});

const START_URL = "https://t.me/lir_bank_bot?start=c2luZ2xlLXVzZS10b2tlbg";

function liveAccepted(extra) {
  return fakeFetch({
    status: 202,
    body: { case_id: payload.case_id, folio: "LB-2026-SERVER", status: "received", ...extra },
  });
}

test("a 202 with a t.me Start link passes it through unchanged", async () => {
  const { impl } = liveAccepted({ telegram_start_url: START_URL });
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
  assert.equal(outcome.telegram_start_url, START_URL);
});

test("a 202 without a Start link yields telegram_start_url null", async () => {
  for (const extra of [{}, { telegram_start_url: null }]) {
    const { impl } = liveAccepted(extra);
    const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
    assert.equal(outcome.telegram_start_url, null);
  }
  const { impl } = fakeFetch({ status: 202 });
  const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
  assert.equal(outcome.telegram_start_url, null);
});

test("a Start link that is not https://t.me/ is dropped", async () => {
  const hostile = [
    "http://t.me/lir_bank_bot?start=abc",
    "https://evil.com/lir_bank_bot?start=abc",
    "https://t.me.evil.com/lir_bank_bot?start=abc",
    "https://evil.com/?u=https://t.me/x",
    "https://user@evil.com/t.me/",
    "javascript:alert(1)//https://t.me/",
    "//t.me/lir_bank_bot",
    "not a url",
    42,
    { href: START_URL },
  ];
  for (const telegram_start_url of hostile) {
    const { impl } = liveAccepted({ telegram_start_url });
    const outcome = await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl });
    assert.equal(outcome.telegram_start_url, null, String(telegram_start_url));
  }
});

test("demo mode never offers a Start link", async () => {
  const outcome = await submitCase(payload, { endpoint: null, demoDelayMs: 0 });
  assert.equal(outcome.telegram_start_url, null);
});

test("a configured authToken is sent as a Bearer Authorization header", async () => {
  const { impl, calls } = liveAccepted({});
  await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl, authToken: "jwt.value.sig" });
  assert.equal(calls[0].init.headers.Authorization, "Bearer jwt.value.sig");
});

test("without an authToken no Authorization header is sent", async () => {
  for (const authToken of [undefined, null, ""]) {
    const { impl, calls } = liveAccepted({});
    await submitCase(payload, { endpoint: "/v1/cases", fetchImpl: impl, authToken });
    assert.equal("Authorization" in calls[0].init.headers, false, String(authToken));
  }
});
