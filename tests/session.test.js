import { test } from "node:test";
import assert from "node:assert/strict";

import { SignInError, createSession } from "../js/core/session.js";

const NOW = Date.parse("2026-10-05T17:00:00Z");

function fakeFetch(responses, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const [status, json] = responses.shift();
    return { ok: status < 400, status, json: async () => json };
  };
}

test("without a sign-in endpoint the configured token is used", async () => {
  const session = createSession({ authToken: "fixed" }, { fetchImpl: () => assert.fail("no call") });
  assert.equal(await session.token(), "fixed");
});

test("the token comes from the sign-in, with the API key", async () => {
  const calls = [];
  const session = createSession(
    { signInEndpoint: "https://gw/v1/demo/sign-in", apiKey: "k", authToken: "stale" },
    { fetchImpl: fakeFetch([[200, { token: "fresh", expires_at: "2026-10-05T18:00:00Z" }]], calls), now: () => NOW },
  );
  assert.equal(await session.token(), "fresh");
  assert.equal(calls[0].url, "https://gw/v1/demo/sign-in?key=k");
  assert.equal(calls[0].options.method, "POST");
});

test("a valid token is reused and renewed shortly before it expires", async () => {
  let clock = NOW;
  const calls = [];
  const session = createSession(
    { signInEndpoint: "https://gw/v1/demo/sign-in" },
    {
      fetchImpl: fakeFetch(
        [
          [200, { token: "first", expires_at: "2026-10-05T18:00:00Z" }],
          [200, { token: "second", expires_at: "2026-10-05T19:00:00Z" }],
        ],
        calls,
      ),
      now: () => clock,
    },
  );
  assert.equal(await session.token(), "first");
  clock = Date.parse("2026-10-05T17:30:00Z");
  assert.equal(await session.token(), "first");
  clock = Date.parse("2026-10-05T17:59:00Z"); // inside the renewal margin
  assert.equal(await session.token(), "second");
  assert.equal(calls.length, 2);
});

test("a failed sign-in is an error, never a demo token", async () => {
  const session = createSession(
    { signInEndpoint: "https://gw/v1/demo/sign-in", authToken: "stale" },
    { fetchImpl: fakeFetch([[503, {}]]) },
  );
  await assert.rejects(session.token(), (error) => error instanceof SignInError && error.status === 503);
});
