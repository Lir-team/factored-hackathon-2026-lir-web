/* Entry point: wires the form, the conditional steps and the live slip. */
import { customer } from "./data/mock-customer.js";
import {
  categoryRule,
  resolveCard,
  statementFor,
  stepsFor,
  transactionModeFor,
} from "./core/case-rules.js";
import { applyTranslations, getLanguage, getLocale, t } from "./i18n/index.js";
import { $, $$ } from "./ui/dom.js";
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

const form = $("#case-form");
const view = { statementKey: null, receipt: null };

function context() {
  return { customer, language: getLanguage(), locale: getLocale(), receipt: view.receipt };
}

/** Re-render every option list from the current answers (init and language change). */
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
  $("#submit-row").hidden = !state.category;
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

function update() {
  syncStatement(readFormState(form));
  const state = readFormState(form);
  applySteps(state);
  applyFraudAlert(state);
  applyCounter(state);
  renderSlip(state, context());
  return state;
}

function init() {
  applyTranslations(document);
  $("#customer-name").textContent = customer.name;
  $("#customer-id").textContent = customer.customer_id;

  // Deep link: ?reason=<category> preselects a reason, e.g. from a
  // "Report this charge" link on the statement page.
  const reason = new URLSearchParams(location.search).get("reason");
  renderOptions({ category: categoryRule(reason) ? reason : null, contact_channel: "whatsapp" });
  applyContact("whatsapp", { prefill: true });

  form.addEventListener("input", update);
  form.addEventListener("change", (event) => {
    if (event.target.name === "contact_channel") applyContact(event.target.value, { prefill: true });
    update();
  });
  update();
}

init();
