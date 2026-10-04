import { test } from "node:test";
import assert from "node:assert/strict";

import { approvalParams, decideApproval, errorMessage, loadApproval, outcomeMessage } from "../js/core/approval.js";

const ENDPOINT = "http://localhost:8080/v1/approvals";
const LINK = { id: "APR-ABC123", token: "tok_1-2" };
const CARD = {
  approval_id: "APR-ABC123",
  status: "pending",
  title: "Abrir una disputa por este cargo",
  details: [{ label: "Monto", value: "245.50 MXN" }],
  content_hash: "h1",
};

function fakeFetch(status, body) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body === undefined) throw new SyntaxError("no body");
        return body;
      },
    };
  };
  return { impl, calls };
}

test("the link gives the request id and its token", () => {
  assert.deepEqual(approvalParams("?id=APR-ABC123&t=tok_1-2"), LINK);
  assert.equal(approvalParams("?id=APR-ABC123"), null);
  assert.equal(approvalParams("?id=<script>&t=x"), null);
});

test("loading sends the token and returns the card", async () => {
  const { impl, calls } = fakeFetch(200, CARD);
  const result = await loadApproval(ENDPOINT, LINK, { fetchImpl: impl });
  assert.deepEqual(result, { ok: true, card: CARD });
  assert.equal(calls[0].url, `${ENDPOINT}/APR-ABC123`);
  assert.equal(calls[0].init.headers["X-Approval-Token"], "tok_1-2");
});

test("a decision is bound to the content that was shown", async () => {
  const { impl, calls } = fakeFetch(200, { ...CARD, status: "approved" });
  await decideApproval(ENDPOINT, LINK, CARD, true, { fetchImpl: impl });
  assert.equal(calls[0].url, `${ENDPOINT}/APR-ABC123/decision`);
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    decision: "approve",
    token: "tok_1-2",
    content_hash: "h1",
  });
});

test("API refusals become kinds the page explains", async () => {
  const cases = [
    [404, { detail: "not_found" }, "not_found"],
    [409, { detail: "not_pending" }, "decided"],
    [409, { detail: "content_changed" }, "changed"],
    [410, { detail: "expired" }, "expired"],
    [503, undefined, "server"],
  ];
  for (const [status, body, kind] of cases) {
    const { impl } = fakeFetch(status, body);
    const result = await decideApproval(ENDPOINT, LINK, CARD, false, { fetchImpl: impl });
    assert.deepEqual(result, { ok: false, kind, status }, `${status} ${body?.detail}`);
  }
});

test("a network failure is its own kind", async () => {
  const result = await loadApproval(ENDPOINT, LINK, {
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  assert.deepEqual(result, { ok: false, kind: "network" });
});

test("decided cards say what happened", () => {
  assert.equal(outcomeMessage(CARD), null);
  assert.deepEqual(outcomeMessage({ status: "approved", result: { dispute_case_id: "DSP-1" } }), {
    tone: "ok",
    title: "approval.outcome.approved.title",
    text: "approval.outcome.dispute.text",
    vars: { id: "DSP-1" },
  });
  assert.equal(outcomeMessage({ status: "rejected" }).tone, "neutral");
});

test("every error kind has its own screen, unknown ones fall back to server", () => {
  assert.deepEqual(errorMessage("expired"), {
    title: "approval.error.expired.title",
    text: "approval.error.expired.text",
  });
  assert.equal(errorMessage("weird").title, "approval.error.server.title");
});

test("with the bank's sign-in, the customer's JWT goes with every call", async () => {
  const { impl, calls } = fakeFetch(200, CARD);
  await loadApproval(ENDPOINT, LINK, { fetchImpl: impl, authToken: "jwt-1" });
  await decideApproval(ENDPOINT, LINK, CARD, true, { fetchImpl: impl, authToken: "jwt-1" });
  assert.equal(calls[0].init.headers.Authorization, "Bearer jwt-1");
  assert.equal(calls[1].init.headers.Authorization, "Bearer jwt-1");
  const { impl: anonymous, calls: plain } = fakeFetch(200, CARD);
  await loadApproval(ENDPOINT, LINK, { fetchImpl: anonymous });
  assert.equal("Authorization" in plain[0].init.headers, false);
});

test("a missing sign-in and someone else's account have their own screens", async () => {
  for (const [status, detail, kind] of [
    [401, "sign_in_required", "sign_in"],
    [403, "not_your_request", "not_yours"],
  ]) {
    const { impl } = fakeFetch(status, { detail });
    const result = await loadApproval(ENDPOINT, LINK, { fetchImpl: impl });
    assert.equal(result.kind, kind);
    assert.equal(errorMessage(kind).title, `approval.error.${kind}.title`);
  }
});
