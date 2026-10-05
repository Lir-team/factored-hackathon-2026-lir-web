/*
 * Category rules shared by the UI and the payload builder.
 * Pure module: no DOM access, so it runs under `node --test`.
 */

/**
 * category -> how the case is routed and which steps it needs.
 * intent_hint uses the Lir agent's decision-layer intents.
 * transaction_mode: "multiple" (checkboxes), "single" (radio) or null (no statement step).
 */
export const CATEGORIES = Object.freeze({
  unrecognized_charge: Object.freeze({
    intent_hint: "cargo_no_reconocido",
    fraud_suspected: true,
    needs_transactions: true,
    needs_card: false,
    transaction_mode: "multiple",
  }),
  card_lost_stolen: Object.freeze({
    intent_hint: "cargo_no_reconocido",
    fraud_suspected: true,
    needs_transactions: false, // optional: only when the card was used after the loss
    needs_card: true,
    transaction_mode: "multiple",
  }),
  improper_fee: Object.freeze({
    intent_hint: "cobro_indebido",
    fraud_suspected: false,
    needs_transactions: true,
    needs_card: false,
    transaction_mode: "single",
  }),
  transaction_inquiry: Object.freeze({
    intent_hint: "consulta_movimiento",
    fraud_suspected: false,
    needs_transactions: true,
    needs_card: false,
    transaction_mode: "single",
  }),
  app_issue: Object.freeze({
    intent_hint: "otra_queja",
    fraud_suspected: false,
    needs_transactions: false,
    needs_card: false,
    transaction_mode: null,
  }),
  service_complaint: Object.freeze({
    intent_hint: "otra_queja",
    fraud_suspected: false,
    needs_transactions: false,
    needs_card: false,
    transaction_mode: null,
  }),
  other_request: Object.freeze({
    intent_hint: "fuera_de_alcance",
    fraud_suspected: false,
    needs_transactions: false,
    needs_card: false,
    transaction_mode: null,
  }),
});

/** Display order: the fraud reasons come first. */
export const CATEGORY_ORDER = Object.freeze(Object.keys(CATEGORIES));

export const CONTACT_CHANNELS = Object.freeze(["whatsapp", "telegram", "email", "phone"]);
export const ANSWERS = Object.freeze(["yes", "no", "unsure"]);

export function categoryRule(category) {
  return Object.hasOwn(CATEGORIES, category ?? "") ? CATEGORIES[category] : null;
}

/** True when the statement picker applies to the current answers. */
export function transactionsApply(state) {
  const rule = categoryRule(state.category);
  if (!rule || !rule.transaction_mode) return false;
  if (rule.needs_transactions) return true;
  return state.category === "card_lost_stolen" && Boolean(state.used_after);
}

/** "multiple", "single" or null for the statement picker. */
export function transactionModeFor(state) {
  return transactionsApply(state) ? categoryRule(state.category).transaction_mode : null;
}

/**
 * The visible steps, in order. Step numbers are derived from this list,
 * so skipped steps never leave a gap.
 */
export function stepsFor(state) {
  const rule = categoryRule(state.category);
  if (!rule) return ["reason"];
  const steps = ["reason"];
  if (rule.needs_card) steps.push("card");
  if (transactionsApply(state)) steps.push("charges");
  steps.push("details", "contact");
  return steps;
}

/** Transactions the statement picker should list for the current answers. */
export function statementFor(state, customer) {
  if (state.category === "card_lost_stolen" && state.card_last4) {
    return customer.transactions.filter((t) => t.card_last4 === state.card_last4);
  }
  return customer.transactions;
}

export function selectedTransactions(state, customer) {
  if (!transactionsApply(state)) return [];
  const ids = new Set(state.transaction_ids ?? []);
  return customer.transactions.filter((t) => ids.has(t.transaction_id));
}

/**
 * The cards a case is about: the picked card for a lost or stolen card,
 * otherwise every card behind the selected charges (once each, in statement
 * order). These are the cards a freeze request applies to.
 */
export function resolveCards(state, customer) {
  const rule = categoryRule(state.category);
  if (!rule) return [];
  const last4s = rule.needs_card
    ? [state.card_last4].filter(Boolean)
    : [...new Set(selectedTransactions(state, customer).map((t) => t.card_last4))];
  return last4s.map((last4) => customer.cards.find((c) => c.last4 === last4)).filter(Boolean);
}
