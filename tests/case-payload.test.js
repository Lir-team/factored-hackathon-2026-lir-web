import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORIES,
  buildCasePayload,
  folioFor,
  priorityFor,
  pubsubAttributesFor,
  validateCase,
  CaseValidationError,
} from "../js/core/case-payload.js";
import { customer } from "../js/data/mock-customer.js";

const NOW = new Date("2026-10-04T16:00:00.000Z");
const UUID = "3f2a9c1e-7b4d-4e8a-9c21-5d6e7f809a1b";
const ctx = (overrides = {}) => ({ customer, language: "es", now: NOW, uuid: () => UUID, ...overrides });

/** A complete, valid unrecognized-charge answer set; override per test. */
function fraudState(overrides = {}) {
  return {
    category: "unrecognized_charge",
    transaction_ids: ["TXN-20261003-88412", "TXN-20261003-88409"],
    card_last4: null,
    incident_occurred_at: "",
    incident_location: "",
    used_after: false,
    card_in_possession: "yes",
    shared_credentials: "no",
    description: "  I did not make these two online purchases last night.  ",
    contact_channel: "whatsapp",
    contact_value: "+52 55 4123 8890",
    declaration: true,
    freeze_card_requested: true,
    ...overrides,
  };
}

function simpleState(category, overrides = {}) {
  return fraudState({
    category,
    transaction_ids: [],
    card_in_possession: null,
    shared_credentials: null,
    freeze_card_requested: false,
    description: "The app closes every time I try to pay a bill.",
    ...overrides,
  });
}

test("CATEGORIES maps every category to the agent intent from the contract", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(CATEGORIES).map(([id, rule]) => [id, rule.intent_hint])),
    {
      unrecognized_charge: "cargo_no_reconocido",
      card_lost_stolen: "cargo_no_reconocido",
      improper_fee: "cobro_indebido",
      transaction_inquiry: "consulta_movimiento",
      app_issue: "otra_queja",
      service_complaint: "otra_queja",
      other_request: "fuera_de_alcance",
    },
  );
  const fraud = Object.keys(CATEGORIES).filter((id) => CATEGORIES[id].fraud_suspected);
  assert.deepEqual(fraud, ["unrecognized_charge", "card_lost_stolen"]);
});

test("validateCase requires a category first", () => {
  const result = validateCase({}, ctx());
  assert.equal(result.valid, false);
  assert.equal(result.errors.category, "required");
});

test("validateCase accepts a complete unrecognized-charge report", () => {
  assert.deepEqual(validateCase(fraudState(), ctx()), { valid: true, errors: {} });
});

test("an unrecognized charge needs a transaction and both fraud answers", () => {
  const { errors } = validateCase(
    fraudState({ transaction_ids: [], card_in_possession: null, shared_credentials: null }),
    ctx(),
  );
  assert.equal(errors.transaction_ids, "required");
  assert.equal(errors.card_in_possession, "required");
  assert.equal(errors.shared_credentials, "required");
});

test("unknown transaction ids are rejected", () => {
  const { errors } = validateCase(fraudState({ transaction_ids: ["TXN-NOPE"] }), ctx());
  assert.equal(errors.transaction_ids, "unknown");
});

test("single-transaction categories reject more than one charge", () => {
  const { errors } = validateCase(
    simpleState("improper_fee", { transaction_ids: ["TXN-20261001-64018", "TXN-20260929-49311"] }),
    ctx(),
  );
  assert.equal(errors.transaction_ids, "too_many");
});

test("a lost card needs the card and when it happened; charges only if it was used after", () => {
  const base = simpleState("card_lost_stolen", { shared_credentials: "unsure" });
  const missing = validateCase(base, ctx()).errors;
  assert.equal(missing.card_last4, "required");
  assert.equal(missing.incident_occurred_at, "required");
  assert.equal(missing.transaction_ids, undefined);
  assert.equal(missing.card_in_possession, undefined, "not asked: the card is lost");

  const complete = { ...base, card_last4: "7390", incident_occurred_at: "2026-10-03T21:30" };
  assert.equal(validateCase(complete, ctx()).valid, true);
  assert.equal(validateCase({ ...complete, used_after: true }, ctx()).errors.transaction_ids, "required");
});

test("the incident date cannot be in the future or malformed", () => {
  const state = simpleState("card_lost_stolen", { card_last4: "7390", shared_credentials: "no" });
  assert.equal(
    validateCase({ ...state, incident_occurred_at: "2026-12-01T10:00" }, ctx()).errors.incident_occurred_at,
    "in_future",
  );
  assert.equal(
    validateCase({ ...state, incident_occurred_at: "yesterday" }, ctx()).errors.incident_occurred_at,
    "invalid",
  );
});

test("the description is trimmed and must be 20 to 1000 characters", () => {
  const check = (description) => validateCase(simpleState("app_issue", { description }), ctx()).errors.description;
  assert.equal(check("   "), "required");
  assert.equal(check("   too short text   "), "too_short");
  assert.equal(check("x".repeat(1001)), "too_long");
  assert.equal(check("x".repeat(1000)), undefined);
});

test("the contact value is checked against the chosen channel", () => {
  const check = (contact_channel, contact_value) =>
    validateCase(simpleState("app_issue", { contact_channel, contact_value }), ctx()).errors;
  assert.equal(check("whatsapp", "").contact_value, "required");
  assert.equal(check("whatsapp", "55-12").contact_value, "invalid_phone");
  assert.equal(check("phone", "+57 300 555 0199").contact_value, undefined);
  assert.equal(check("email", "ana@").contact_value, "invalid_email");
  assert.equal(check("email", "ana.gomez@example.com").contact_value, undefined);
  assert.equal(check("telegram", "@ana_gomez_mx").contact_value, undefined);
  assert.equal(check("telegram", "@a").contact_value, "invalid_telegram");
  assert.equal(check(null, "x").contact_channel, "required");
  assert.equal(check("fax", "x").contact_channel, "invalid");
});

test("the declaration must be accepted", () => {
  assert.equal(validateCase(fraudState({ declaration: false }), ctx()).errors.declaration, "required");
});

test("buildCasePayload produces the versioned case for an unrecognized charge", () => {
  const payload = buildCasePayload(fraudState(), ctx());
  assert.deepEqual(Object.keys(payload).sort(), [
    "card",
    "case_id",
    "category",
    "channel",
    "consent",
    "customer",
    "description",
    "fraud_suspected",
    "freeze_card_requested",
    "incident",
    "intent_hint",
    "language",
    "priority_hint",
    "schema_version",
    "submitted_at",
    "transactions",
  ]);
  assert.equal(payload.schema_version, "1.0");
  assert.equal(payload.case_id, UUID);
  assert.equal(payload.submitted_at, "2026-10-04T16:00:00.000Z");
  assert.equal(payload.language, "es");
  assert.equal(payload.channel, "web");
  assert.deepEqual(payload.customer, {
    customer_id: "CLI-DEMO-001",
    country: "MX",
    preferred_contact: { channel: "whatsapp", value: "+52 55 4123 8890" },
  });
  assert.equal(payload.category, "unrecognized_charge");
  assert.equal(payload.intent_hint, "cargo_no_reconocido");
  assert.equal(payload.fraud_suspected, true);
  assert.equal(payload.priority_hint, "critical", "foreign online charges");
  assert.deepEqual(payload.transactions, [
    {
      transaction_id: "TXN-20261003-88412",
      amount: 1560,
      currency: "MXN",
      merchant: "PAGSEGURO *LOJAONLINE",
      occurred_at: "2026-10-03T03:12:44-06:00",
    },
    {
      transaction_id: "TXN-20261003-88409",
      amount: 3999,
      currency: "MXN",
      merchant: "SP DIGITALGOODS MADRID",
      occurred_at: "2026-10-03T02:58:10-06:00",
    },
  ]);
  assert.deepEqual(payload.card, { last4: "7390", type: "credit" });
  assert.deepEqual(payload.incident, {
    occurred_at: null,
    location: null,
    card_in_possession: "yes",
    shared_credentials: "no",
  });
  assert.equal(payload.freeze_card_requested, true);
  assert.equal(payload.description, "I did not make these two online purchases last night.");
  assert.equal(payload.consent, true);
});

test("a lost card carries the incident with an ISO timestamp and the picked card", () => {
  const payload = buildCasePayload(
    simpleState("card_lost_stolen", {
      card_last4: "4821",
      incident_occurred_at: "2026-10-03T21:30",
      incident_location: "  Metro Insurgentes, CDMX ",
      shared_credentials: "unsure",
      card_in_possession: "yes", // ignored: the card is lost
      transaction_ids: ["TXN-20261002-76980"], // ignored: used_after is false
      freeze_card_requested: true,
    }),
    ctx(),
  );
  assert.deepEqual(payload.card, { last4: "4821", type: "debit" });
  assert.deepEqual(payload.transactions, []);
  assert.equal(payload.priority_hint, "critical");
  assert.deepEqual(payload.incident, {
    occurred_at: new Date("2026-10-03T21:30").toISOString(),
    location: "Metro Insurgentes, CDMX",
    card_in_possession: "no",
    shared_credentials: "unsure",
  });
});

test("non-fraud categories drop fraud-only fields", () => {
  const payload = buildCasePayload(
    simpleState("app_issue", {
      transaction_ids: ["TXN-20261002-77105"],
      freeze_card_requested: true,
      shared_credentials: "yes",
    }),
    ctx({ language: "pt" }),
  );
  assert.equal(payload.intent_hint, "otra_queja");
  assert.equal(payload.fraud_suspected, false);
  assert.deepEqual(payload.transactions, []);
  assert.equal(payload.card, null);
  assert.equal(payload.incident, null);
  assert.equal(payload.freeze_card_requested, false);
  assert.equal(payload.language, "pt");
});

test("buildCasePayload refuses an invalid form", () => {
  assert.throws(
    () => buildCasePayload(fraudState({ declaration: false }), ctx()),
    (error) => error instanceof CaseValidationError && error.errors.declaration === "required",
  );
});

test("priorityFor is a client-side hint", () => {
  const txn = (id) => customer.transactions.find((t) => t.transaction_id === id);
  assert.equal(priorityFor("card_lost_stolen", [], customer), "critical");
  assert.equal(priorityFor("unrecognized_charge", [txn("TXN-20261002-77105")], customer), "high");
  const bigDomestic = { ...txn("TXN-20261002-77105"), amount: 25000 };
  assert.equal(priorityFor("unrecognized_charge", [bigDomestic], customer), "critical");
  assert.equal(priorityFor("unrecognized_charge", [txn("TXN-20261003-88412")], customer), "critical");
  assert.equal(priorityFor("improper_fee", [txn("TXN-20261001-64018")], customer), "medium");
  assert.equal(priorityFor("app_issue", [], customer), "medium");
  assert.equal(priorityFor("service_complaint", [], customer), "medium");
  assert.equal(priorityFor("transaction_inquiry", [txn("TXN-20261002-77105")], customer), "low");
  assert.equal(priorityFor("other_request", [], customer), "low");
});

test("pubsubAttributesFor returns string-only attributes", () => {
  const attributes = pubsubAttributesFor(buildCasePayload(fraudState(), ctx()));
  assert.deepEqual(attributes, {
    category: "unrecognized_charge",
    intent_hint: "cargo_no_reconocido",
    fraud_suspected: "true",
    priority_hint: "critical",
    country: "MX",
    language: "es",
    schema_version: "1.0",
  });
  for (const value of Object.values(attributes)) assert.equal(typeof value, "string");
});

test("folioFor derives a readable reference from the case id", () => {
  assert.equal(folioFor(UUID, "2026-10-04T16:00:00.000Z"), "LB-2026-3F2A9C");
});
