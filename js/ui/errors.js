/* Field errors and the error summary. Messages say what to fix. */
import { hasKey, t } from "../i18n/index.js";
import { $, $$, h } from "./dom.js";

/** field -> the element that hosts its error, and what to focus from the summary. */
const FIELDS = {
  category: { host: '[data-step="reason"]', focus: "#category-options input" },
  card_last4: { host: "#card-field", focus: "#card-options input" },
  incident_occurred_at: { host: "#incident-occurred-at-field", focus: "#incident-occurred-at" },
  transaction_ids: { host: "#charges-field", focus: "#statement-rows input" },
  description: { host: "#description-field", focus: "#description" },
  card_in_possession: { host: "#possession-field", focus: '[data-answers="card_in_possession"] input' },
  shared_credentials: { host: "#credentials-field", focus: '[data-answers="shared_credentials"] input' },
  contact_channel: { host: "#channel-field", focus: "#contact-channels input" },
  contact_value: { host: "#contact-value-field", focus: "#contact-value" },
  declaration: { host: "#declaration-field", focus: "#declaration" },
};

export const FIELD_ORDER = Object.keys(FIELDS);

export function errorMessage(field, code) {
  const key = `error.${field}.${code}`;
  return hasKey(key) ? t(key) : t("error.generic");
}

function toggleToken(el, attr, token, on) {
  const tokens = new Set((el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean));
  if (on) tokens.add(token);
  else tokens.delete(token);
  if (tokens.size) el.setAttribute(attr, [...tokens].join(" "));
  else el.removeAttribute(attr);
}

/**
 * Show the errors for `fields` (others are cleared). Text inputs get
 * aria-invalid and aria-describedby; radio and checkbox groups get them
 * on their fieldset or container.
 */
export function renderFieldErrors(errors, fields) {
  for (const field of FIELD_ORDER) {
    const host = $(FIELDS[field].host);
    const message = $(`#error-${field}`);
    if (!host || !message) continue;
    const code = fields.has(field) ? errors[field] : undefined;
    message.hidden = !code;
    message.textContent = code ? errorMessage(field, code) : "";
    host.classList.toggle("has-error", Boolean(code));

    const inputs = $$("input, textarea", host);
    const target =
      $("input.input, textarea", host) ??
      (inputs.length === 1 ? inputs[0] : null) ??
      (host.matches("fieldset") ? host : $("fieldset", host)) ??
      host;
    toggleToken(target, "aria-describedby", message.id, Boolean(code));
    for (const input of inputs) {
      if (code) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }
}

/** Render the summary; returns true when it has items. */
export function renderErrorSummary(errors, { visible }) {
  const summary = $("#error-summary");
  const fields = FIELD_ORDER.filter((field) => errors[field]);
  summary.hidden = !visible || fields.length === 0;
  $("#error-summary-list").replaceChildren(
    ...fields.map((field) => {
      const link = h("a", { href: `#error-${field}`, text: errorMessage(field, errors[field]) });
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const input = $(FIELDS[field].focus);
        input?.focus();
        input?.scrollIntoView({ block: "center" });
      });
      return h("li", {}, link);
    }),
  );
  return !summary.hidden;
}
