import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CATEGORIES, buildCasePayload } from "../js/core/case-payload.js";
import { customer } from "../js/data/mock-customer.js";
import { check } from "./helpers/mini-schema.js";

const schema = JSON.parse(readFileSync(new URL("../schema/case.schema.json", import.meta.url), "utf8"));

const ctx = (language = "es") => ({
  customer,
  language,
  now: new Date("2026-10-04T16:00:00.000Z"),
  uuid: () => "3f2a9c1e-7b4d-4e8a-9c21-5d6e7f809a1b",
});

const common = {
  card_last4: null,
  incident_occurred_at: "",
  incident_location: "",
  used_after: false,
  card_in_possession: null,
  shared_credentials: null,
  transaction_ids: [],
  description: "Something went wrong and I need help with it.",
  contact_channel: "telegram",
  contact_value: "@ana_gomez_mx",
  declaration: true,
  freeze_card_requested: false,
};

/** One valid answer set per category. */
const STATES = {
  unrecognized_charge: {
    transaction_ids: ["TXN-D1-007", "TXN-D1-005"],
    card_in_possession: "unsure",
    shared_credentials: "yes",
    freeze_card_requested: true,
  },
  card_lost_stolen: {
    card_last4: "7390",
    incident_occurred_at: "2026-10-02T23:15",
    incident_location: "Coyoacán, CDMX",
    used_after: true,
    transaction_ids: ["TXN-D1-008"],
    shared_credentials: "no",
    freeze_card_requested: true,
  },
  improper_fee: { transaction_ids: ["TXN-D1-006"] },
  transaction_inquiry: { transaction_ids: ["TXN-D1-007"] },
  app_issue: {},
  service_complaint: { contact_channel: "email", contact_value: "ana.gomez@example.com" },
  other_request: { contact_channel: "phone", contact_value: "+52 55 4123 8890" },
};

test("the schema lists exactly the categories and intents of the code", () => {
  assert.deepEqual(schema.properties.category.enum, Object.keys(CATEGORIES));
  assert.deepEqual(
    [...new Set(Object.values(CATEGORIES).map((rule) => rule.intent_hint))].sort(),
    [...schema.properties.intent_hint.enum].sort(),
  );
});

for (const [category, answers] of Object.entries(STATES)) {
  test(`buildCasePayload output for ${category} is valid against the schema`, () => {
    for (const language of ["es", "pt", "en"]) {
      const payload = buildCasePayload({ ...common, category, ...answers }, ctx(language));
      assert.deepEqual(check(schema, payload), []);
    }
  });
}

test("the checker rejects payloads that break the contract", () => {
  const payload = buildCasePayload({ ...common, category: "unrecognized_charge", ...STATES.unrecognized_charge }, ctx());
  const broken = (patch) => check(schema, { ...payload, ...patch });

  assert.ok(broken({ language: "fr" }).some((e) => e.includes("$.language")));
  assert.ok(broken({ extra: 1 }).some((e) => e.includes("unexpected extra")));
  assert.ok(broken({ intent_hint: "cobro_indebido" }).some((e) => e.includes("$.intent_hint")));
  assert.ok(broken({ transactions: [] }).some((e) => e.includes("fewer than 1")));
  assert.ok(broken({ consent: false }).some((e) => e.includes("$.consent")));
  assert.ok(broken({ cards: [payload.cards[0], payload.cards[0]] }).some((e) => e.includes("duplicate items")));
  assert.ok(broken({ card: payload.cards[0] }).some((e) => e.includes("unexpected card")));
  const lost = buildCasePayload({ ...common, category: "card_lost_stolen", ...STATES.card_lost_stolen }, ctx());
  assert.ok(check(schema, { ...lost, cards: [] }).some((e) => e.includes("fewer than 1")));
  const { schema_version, ...missing } = payload;
  assert.ok(check(schema, missing).some((e) => e.includes("missing schema_version")));
});

test("a charge without a merchant (a transfer) is sent as null and passes the schema", () => {
  const transfer = { ...customer.transactions[0], transaction_id: "TXN-TRANSFER", merchant: null };
  const withTransfer = { ...customer, transactions: [transfer, ...customer.transactions] };
  const state = { ...common, category: "transaction_inquiry", transaction_ids: ["TXN-TRANSFER"] };
  const payload = buildCasePayload(state, { ...ctx(), customer: withTransfer });
  assert.equal(payload.transactions[0].merchant, null);
  assert.deepEqual(check(schema, payload), []);
  assert.ok(check(schema, { ...payload, transactions: [{ ...payload.transactions[0], merchant: "" }] }).length > 0);
});
