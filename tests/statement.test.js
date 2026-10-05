import { test } from "node:test";
import assert from "node:assert/strict";

import { customer as demo } from "../js/data/mock-customer.js";
import { StatementError, loadCustomer, toCustomer } from "../js/core/statement.js";

const body = {
  customer_id: "CLI-LP2BQNTMC2F5",
  first_name: "Lucía",
  country: "AR",
  transactions: [
    { transaction_id: "TX-1", occurred_at: "2026-05-27T11:45:00", merchant: "Centro Comercial",
      amount: 139850.6, currency: "ARS", country: "AR", channel: "online", status: "Approved" },
    { transaction_id: "TX-2", occurred_at: "2026-05-10T09:00:00", merchant: null,
      amount: 2218860.05, currency: "ARS", country: "AR", channel: "app", status: "Approved" },
  ],
};

function fakeFetch(status, json, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    return { ok: status < 400, status, json: async () => json };
  };
}

test("without an endpoint or a token the page stays on the demo customer", async () => {
  assert.equal((await loadCustomer(demo, { endpoint: null, authToken: "t" })).source, "demo");
  assert.equal((await loadCustomer(demo, { endpoint: "https://gw/v1/me/transactions" })).customer, demo);
});

test("the statement is requested with the key and the sign-in token", async () => {
  const calls = [];
  const { customer, source } = await loadCustomer(demo, {
    endpoint: "https://gw/v1/me/transactions", authToken: "jwt", apiKey: "k",
    fetchImpl: fakeFetch(200, body, calls),
  });
  assert.equal(source, "api");
  assert.equal(calls[0].url, "https://gw/v1/me/transactions?limit=20&key=k");
  assert.equal(calls[0].options.headers.Authorization, "Bearer jwt");
  assert.equal(customer.customer_id, "CLI-LP2BQNTMC2F5");
  assert.equal(customer.transactions.length, 2);
});

test("API lines keep their ids and use the simulated card; contacts stay simulated", () => {
  const customer = toCustomer(body, demo);
  assert.deepEqual(customer.transactions.map((t) => t.transaction_id), ["TX-1", "TX-2"]);
  assert.ok(customer.transactions.every((t) => t.card_last4 === demo.cards[0].last4));
  assert.equal(customer.transactions[1].merchant, null);
  assert.equal(customer.name, "Lucía");
  assert.equal(customer.currency, "ARS");
  assert.deepEqual(customer.contacts, demo.contacts);
});

test("API channels are lowercased so they match the dictionary keys", () => {
  const raw = ["ATM", "POS", "App", "Transfer", "Web", null];
  const lines = raw.map((channel, i) => ({ ...body.transactions[0], transaction_id: `TX-${i}`, channel }));
  const customer = toCustomer({ ...body, transactions: lines }, demo);
  assert.deepEqual(customer.transactions.map((t) => t.channel), ["atm", "pos", "app", "transfer", "web", null]);
});

test("an expired sign-in is an error, not a silent demo statement", async () => {
  await assert.rejects(
    loadCustomer(demo, { endpoint: "https://gw/x", authToken: "old", fetchImpl: fakeFetch(401, {}) }),
    (error) => error instanceof StatementError && error.status === 401,
  );
});
