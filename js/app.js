/* Entry point: wires the form, the conditional steps, the live slip and submission. */
import { customer } from "./data/mock-customer.js";
import {
  categoryRule,
  resolveCard,
  statementFor,
  stepsFor,
  transactionModeFor,
} from "./core/case-rules.js";
import { buildCasePayload, randomUUID, validateCase } from "./core/case-payload.js";
import { nextCaseId, partitionServerErrors, submitCase } from "./core/submit.js";
import {
  applyTranslations,
  getHtmlLang,
  getLanguage,
  getLocale,
  isLanguage,
  setLanguage,
  storedLanguage,
  t,
} from "./i18n/index.js";
import { $, $$ } from "./ui/dom.js";
import { FIELD_ORDER, renderErrorSummary, renderFieldErrors } from "./ui/errors.js";
import { readFormState } from "./ui/form-state.js";
import {
  cardName,
  renderAnswers,
  renderCards,
  renderCategories,
  renderChannels,
  renderStatement,
} from "./ui/render.js";
import { renderSlip } from "./ui/slip.js";
import { renderSuccess, stampSlip } from "./ui/success.js";

const form = $("#case-form");
const submitButton = $('button[type="submit"][form="case-form"]');

const view = {
  statementKey: null,
  touched: new Set(), // fields that lost focus at least once
  submitted: false, // after the first submit attempt every error shows
  serverErrors: {}, // field errors returned by the backend
  sendError: null, // { kind, status } of the last failed send
  sending: false,
  caseId: randomUUID(), // the Idempotency-Key: kept across retries, rotated after a rejection
  success: null, // { payload, outcome }
};

function context() {
  const receipt = view.success
    ? { folio: view.success.outcome.folio, submitted_at: view.success.payload.submitted_at }
    : null;
  return { customer, language: getLanguage(), locale: getLocale(), receipt };
}

/** Re-render every option list from the current answers (init, reset and language change). */
function renderOptions(state) {
  renderCategories($("#category-options"), state.category);
  renderCards($("#card-options"), customer.cards, state.card_last4);
  for (const el of $$("[data-answers]", form)) {
    renderAnswers(el, el.dataset.answers, state[el.dataset.answers]);
  }
  renderChannels($("#contact-channels"), state.contact_channel);
  view.statementKey = null;
}

/** Rebuild the statement picker only when its mode, rows or language change. */
function syncStatement(state) {
  const mode = transactionModeFor(state);
  if (!mode) return;
  const rows = statementFor(state, customer);
  const ids = rows.map((row) => row.transaction_id);
  const key = [state.category, mode, getLanguage(), ids.join()].join("|");
  if (key === view.statementKey) return;
  view.statementKey = key;

  let selected = state.transaction_ids.filter((id) => ids.includes(id));
  if (mode === "single") selected = selected.slice(0, 1);
  renderStatement($("#statement-rows"), rows, {
    mode,
    selectedIds: selected,
    customer,
    locale: getLocale(),
  });
  $("#charges-title").textContent = t(`step.charges.title.${state.category}`);
  $("#charges-hint").textContent = t(`charges.hint.${mode}`);
}

/** Show the steps that apply and number them in their real sequence. */
function applySteps(state) {
  const steps = stepsFor(state);
  for (const section of $$("[data-step]", form)) {
    const index = steps.indexOf(section.dataset.step);
    section.hidden = index === -1;
    const num = $(".step__num", section);
    if (num) num.textContent = String(index + 1);
  }
  for (const el of $$("[data-only]", form)) {
    el.hidden = !el.dataset.only.split(" ").includes(state.category);
  }
}

function applyFraudAlert(state) {
  $("#fraud-alert").hidden = !categoryRule(state.category)?.fraud_suspected;
  const card = resolveCard(state, customer);
  $("#freeze-target").textContent = card
    ? t("fraud.target", { card: cardName(card) })
    : t("fraud.target_none");
}

const CONTACT_INPUT = {
  whatsapp: { type: "tel", autocomplete: "tel", inputMode: "tel" },
  phone: { type: "tel", autocomplete: "tel", inputMode: "tel" },
  telegram: { type: "text", autocomplete: "off", inputMode: "text" },
  email: { type: "email", autocomplete: "email", inputMode: "email" },
};

function applyContact(channel, { prefill }) {
  const input = $("#contact-value");
  $("#contact-value-label").textContent = t(`contact.value.${channel}`);
  Object.assign(input, CONTACT_INPUT[channel]);
  if (prefill) input.value = customer.contacts[channel] ?? "";
}

function applyCounter(state) {
  $("#description-count").textContent = t("description.count", { n: state.description.length });
}

/** Client errors for touched fields (all after a submit attempt), plus server errors. */
function applyErrors(state) {
  const { errors } = validateCase(state, { customer, now: new Date() });
  const merged = { ...view.serverErrors, ...errors };
  const shown = new Set(view.submitted ? FIELD_ORDER : view.touched);
  for (const field of Object.keys(view.serverErrors)) shown.add(field);
  renderFieldErrors(merged, shown);
  const summaryErrors = Object.fromEntries(Object.entries(merged).filter(([field]) => shown.has(field)));
  renderErrorSummary(summaryErrors, { visible: view.submitted });
}

function applySubmitRow(state) {
  $("#submit-row").hidden = !state.category || Boolean(view.success);
  submitButton.textContent = view.sending ? t("submit.sending") : t("submit.button");
  submitButton.setAttribute("aria-busy", String(view.sending));
  const sendError = $("#send-error");
  sendError.hidden = !view.sendError;
  if (view.sendError) {
    const { kind, status } = view.sendError;
    $("#send-error-text").textContent = t(`send.${kind}`, { status });
  }
}

function applySuccess() {
  form.hidden = Boolean(view.success);
  $("#success").hidden = !view.success;
  if (view.success) renderSuccess({ ...view.success, customer });
}

function update() {
  syncStatement(readFormState(form));
  const state = readFormState(form);
  applySteps(state);
  applyFraudAlert(state);
  applyCounter(state);
  applyErrors(state);
  applySubmitRow(state);
  applySuccess();
  renderSlip(state, context());
  return state;
}

async function onSubmit(event) {
  event.preventDefault();
  if (view.sending || view.success) return;

  const state = readFormState(form);
  view.submitted = true;
  view.serverErrors = {};
  view.sendError = null;
  const { valid } = validateCase(state, { customer, now: new Date() });
  if (!valid) {
    update();
    $("#error-summary").focus();
    return;
  }

  const payload = buildCasePayload(state, { customer, language: getLanguage(), uuid: () => view.caseId });
  view.sending = true;
  update();
  let outcome;
  try {
    outcome = await submitCase(payload, { endpoint: window.LIR_CONFIG?.casesEndpoint ?? null });
  } catch {
    outcome = { ok: false, kind: "network" }; // never leave the form stuck in "Sending"
  } finally {
    view.sending = false;
  }

  if (outcome.ok) {
    view.success = { payload, outcome };
    update();
    stampSlip(true);
    const success = $("#success");
    success.focus();
    success.scrollIntoView({ block: "start" });
    return;
  }

  view.caseId = nextCaseId(outcome, view.caseId, randomUUID);
  if (outcome.kind === "rejected") {
    // Show what maps to a field; anything else (or no errors at all) gets the generic line.
    const { fields, generic } = partitionServerErrors(outcome.errors, FIELD_ORDER);
    view.serverErrors = fields;
    if (generic) view.sendError = { kind: "rejected", status: outcome.status };
  } else {
    view.sendError = { kind: outcome.kind, status: outcome.status };
  }
  update();
  if (Object.keys(view.serverErrors).length > 0) $("#error-summary").focus();
  else $("#retry").focus();
}

function resetForm() {
  form.reset();
  Object.assign(view, {
    touched: new Set(),
    submitted: false,
    serverErrors: {},
    sendError: null,
    caseId: randomUUID(),
    success: null,
  });
  stampSlip(false);
  renderOptions({ contact_channel: "whatsapp" });
  applyContact("whatsapp", { prefill: true });
  update();
  $("#category-options input")?.focus();
}

/** Translate static copy, <html lang>, the title and the switch state. */
function applyLanguage() {
  document.documentElement.lang = getHtmlLang();
  document.title = t("doc.title");
  applyTranslations(document);
  for (const button of $$(".lang-switch button")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === getLanguage()));
  }
}

function onLanguageClick(event) {
  const language = event.target.closest("button[data-lang]")?.dataset.lang;
  if (!language || language === getLanguage()) return;
  setLanguage(language);
  applyLanguage();
  // Option lists carry translated labels and Intl-formatted amounts: rebuild them, keeping answers.
  const state = readFormState(form);
  renderOptions(state);
  if (state.contact_channel) applyContact(state.contact_channel, { prefill: false });
  update();
}

function init() {
  // ?lang=pt|en|es wins (handy for links and screenshots), then the saved choice.
  const params = new URLSearchParams(location.search);
  const requested = params.get("lang");
  if (isLanguage(requested)) setLanguage(requested);
  else setLanguage(storedLanguage());
  applyLanguage();
  $("#customer-name").textContent = customer.name;
  $("#customer-id").textContent = customer.customer_id;

  // Deep link: ?reason=<category> preselects a reason, e.g. from a
  // "Report this charge" link on the statement page.
  const reason = params.get("reason");
  renderOptions({ category: categoryRule(reason) ? reason : null, contact_channel: "whatsapp" });
  applyContact("whatsapp", { prefill: true });

  form.addEventListener("input", (event) => {
    delete view.serverErrors[event.target.name];
    update();
  });
  form.addEventListener("change", (event) => {
    if (event.target.name === "contact_channel") applyContact(event.target.value, { prefill: true });
    update();
  });
  form.addEventListener("focusout", (event) => {
    const name = event.target.name;
    if (!name || !FIELD_ORDER.includes(name)) return;
    // Radio and checkbox groups count as touched only when focus leaves the group.
    if (event.relatedTarget?.name === name) return;
    view.touched.add(name);
    update();
  });
  form.addEventListener("submit", onSubmit);
  $(".lang-switch").addEventListener("click", onLanguageClick);
  $("#retry").addEventListener("click", () => form.requestSubmit());
  $("#report-another").addEventListener("click", resetForm);
  update();
}

init();
