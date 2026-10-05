/*
 * Case payload: validation, the versioned payload a backend receives,
 * and the Pub/Sub attributes it should publish with.
 * Pure module: no DOM access, so it runs under `node --test`.
 * Contract: docs/case-contract.md and schema/case.schema.json.
 */
import {
  ANSWERS,
  CATEGORIES,
  CONTACT_CHANNELS,
  categoryRule,
  resolveCards,
  selectedTransactions,
  transactionModeFor,
  transactionsApply,
} from "./case-rules.js";

export { CATEGORIES };

export const SCHEMA_VERSION = "1.1";
export const LANGUAGES = Object.freeze(["es", "pt", "en"]);
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 1000;

export class CaseValidationError extends Error {
  constructor(errors) {
    super(`Invalid case: ${Object.keys(errors).join(", ")}`);
    this.name = "CaseValidationError";
    this.errors = errors;
  }
}

const PHONE_CHARS = /^\+?[\d\s().-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEGRAM_USER = /^@[A-Za-z0-9_]{5,32}$/;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function isPhone(value) {
  const digits = value.replace(/\D/g, "").length;
  return PHONE_CHARS.test(value) && digits >= 8 && digits <= 15;
}

function contactError(channel, value) {
  if (!value) return "required";
  if (channel === "email") return EMAIL.test(value) ? null : "invalid_email";
  if (channel === "telegram") return TELEGRAM_USER.test(value) || isPhone(value) ? null : "invalid_telegram";
  return isPhone(value) ? null : "invalid_phone";
}

/**
 * Validate the answers. Only fields that apply to the chosen category are checked.
 * @param {object} state    formState (see js/ui/form-state.js)
 * @param {object} [context] { customer, now }
 * @returns {{valid: boolean, errors: Record<string, string>}} errors map field -> code
 */
export function validateCase(state, context = {}) {
  const errors = {};
  const now = context.now ?? new Date();
  const customer = context.customer;
  const rule = categoryRule(state.category);

  if (!rule) {
    errors.category = "required";
  } else {
    if (transactionsApply(state)) {
      const ids = state.transaction_ids ?? [];
      const known = new Set(customer?.transactions.map((t) => t.transaction_id) ?? ids);
      if (ids.length === 0) errors.transaction_ids = "required";
      else if (transactionModeFor(state) === "single" && ids.length > 1) errors.transaction_ids = "too_many";
      else if (ids.some((id) => !known.has(id))) errors.transaction_ids = "unknown";
    }

    if (rule.needs_card) {
      if (!state.card_last4) errors.card_last4 = "required";
      else if (customer && !customer.cards.some((c) => c.last4 === state.card_last4)) {
        errors.card_last4 = "unknown";
      }
    }

    if (state.category === "card_lost_stolen") {
      const value = state.incident_occurred_at ?? "";
      const date = new Date(value);
      if (!value) errors.incident_occurred_at = "required";
      else if (!LOCAL_DATETIME.test(value) || Number.isNaN(date.getTime())) errors.incident_occurred_at = "invalid";
      else if (date > now) errors.incident_occurred_at = "in_future";
    }

    if (state.category === "unrecognized_charge" && !ANSWERS.includes(state.card_in_possession)) {
      errors.card_in_possession = "required";
    }
    if (rule.fraud_suspected && !ANSWERS.includes(state.shared_credentials)) {
      errors.shared_credentials = "required";
    }
  }

  const description = (state.description ?? "").trim();
  if (!description) errors.description = "required";
  else if (description.length < DESCRIPTION_MIN) errors.description = "too_short";
  else if (description.length > DESCRIPTION_MAX) errors.description = "too_long";

  if (!state.contact_channel) errors.contact_channel = "required";
  else if (!CONTACT_CHANNELS.includes(state.contact_channel)) errors.contact_channel = "invalid";
  else {
    const error = contactError(state.contact_channel, (state.contact_value ?? "").trim());
    if (error) errors.contact_value = error;
  }

  if (state.declaration !== true) errors.declaration = "required";

  return { valid: Object.keys(errors).length === 0, errors };
}

/*
 * Approximate USD rates, only for the priority hint. The server is
 * authoritative for priority; these never reach the customer.
 */
const USD_PER_UNIT = Object.freeze({ USD: 1, MXN: 0.055, COP: 0.00025, ARS: 0.00085, BRL: 0.18, EUR: 1.08 });
export const CRITICAL_FRAUD_USD = 1000;

const MEDIUM_CATEGORIES = new Set(["improper_fee", "app_issue", "service_complaint"]);

/**
 * Client-side priority *hint*: "critical" | "high" | "medium" | "low".
 * - critical: a lost or stolen card, or a fraud report with a foreign charge
 *   or a total of about USD 1,000 or more;
 * - high: any other fraud report;
 * - medium: a wrong fee, an app problem or a service complaint;
 * - low: a question about a transaction or another request.
 */
export function priorityFor(category, transactions, customer) {
  const rule = categoryRule(category);
  if (!rule) return "low";
  if (category === "card_lost_stolen") return "critical";
  if (rule.fraud_suspected) {
    const foreign = transactions.some((t) => t.country && t.country !== customer.country);
    const usd = transactions.reduce((sum, t) => sum + t.amount * (USD_PER_UNIT[t.currency] ?? 0), 0);
    return foreign || usd >= CRITICAL_FRAUD_USD ? "critical" : "high";
  }
  return MEDIUM_CATEGORIES.has(category) ? "medium" : "low";
}

/** A v4 UUID; falls back to getRandomValues where randomUUID needs a secure context. */
export function randomUUID() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();
  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Build the case payload (schema_version 1.1). Throws CaseValidationError
 * when the answers are not valid.
 * @param {object} state   formState
 * @param {object} context { customer, language, now?, uuid? }
 */
export function buildCasePayload(state, context) {
  const { customer, language } = context;
  const now = context.now ?? new Date();
  const uuid = context.uuid ?? randomUUID;

  const { valid, errors } = validateCase(state, { customer, now });
  if (!valid) throw new CaseValidationError(errors);

  const rule = categoryRule(state.category);
  const transactions = selectedTransactions(state, customer);
  const cards = resolveCards(state, customer);
  const lostCard = state.category === "card_lost_stolen";

  return {
    schema_version: SCHEMA_VERSION,
    case_id: uuid(),
    submitted_at: now.toISOString(),
    language: LANGUAGES.includes(language) ? language : "es",
    channel: "web",
    customer: {
      customer_id: customer.customer_id,
      country: customer.country,
      preferred_contact: { channel: state.contact_channel, value: state.contact_value.trim() },
    },
    category: state.category,
    intent_hint: rule.intent_hint,
    fraud_suspected: rule.fraud_suspected,
    priority_hint: priorityFor(state.category, transactions, customer),
    transactions: transactions.map((t) => ({
      transaction_id: t.transaction_id,
      amount: t.amount,
      currency: t.currency,
      merchant: t.merchant,
      occurred_at: t.occurred_at,
    })),
    cards: cards.map((card) => ({ last4: card.last4, type: card.type })),
    incident: rule.fraud_suspected
      ? {
          occurred_at: lostCard ? new Date(state.incident_occurred_at).toISOString() : null,
          location: lostCard ? state.incident_location.trim() || null : null,
          card_in_possession: lostCard ? "no" : state.card_in_possession,
          shared_credentials: state.shared_credentials,
        }
      : null,
    freeze_card_requested: rule.fraud_suspected && state.freeze_card_requested === true,
    description: state.description.trim(),
    consent: true,
  };
}

/** String-only attributes for the Pub/Sub message (attribute values must be strings). */
export function pubsubAttributesFor(payload) {
  return {
    category: payload.category,
    intent_hint: payload.intent_hint,
    fraud_suspected: String(payload.fraud_suspected),
    priority_hint: payload.priority_hint,
    country: payload.customer.country,
    language: payload.language,
    schema_version: payload.schema_version,
  };
}

/** Human-readable reference, e.g. LB-2026-3F2A9C (year of submission + first 6 hex of case_id). */
export function folioFor(caseId, submittedAt) {
  const year = String(submittedAt).slice(0, 4);
  return `LB-${year}-${caseId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
