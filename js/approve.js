/*
 * Authorization screen: the request behind a single-use link. Every value is written with
 * textContent (never HTML): the card comes from the API, not from this repo.
 */
import {
  approvalParams,
  decideApproval,
  errorMessage,
  loadApproval,
  outcomeMessage,
} from "./core/approval.js";
import { createSession } from "./core/session.js";
import { applyTranslations, getLocale, isLanguage, setLanguage, t } from "./i18n/index.js";

const $ = (id) => document.getElementById(id);
const endpoint = window.LIR_CONFIG?.approvalsEndpoint;
// The customer's JWT from the bank's sign-in: required when approvals need it (step-up).
const session = createSession(window.LIR_CONFIG ?? {});
const LONG_VALUE = 32;

function translate(language) {
  if (isLanguage(language)) setLanguage(language);
  document.documentElement.lang = language === "pt" ? "pt-BR" : language || "es";
  document.title = t("approval.doc.title");
  applyTranslations(document);
}

function setStatus(status) {
  const pill = $("approval-pill");
  pill.dataset.status = status;
  pill.textContent = t(`approval.status.${status}`);
}

function render(card) {
  $("approval-title").textContent = card.title;
  $("approval-ref").textContent = card.approval_id;

  const details = $("approval-details");
  details.replaceChildren(
    ...card.details.map(({ label, value }) => {
      const row = document.createElement("div");
      // Long values (a reason) read better under their label than squeezed to the right.
      if (value.length > LONG_VALUE) row.className = "is-long";
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      row.append(term, description);
      return row;
    }),
  );

  const expires = new Date(card.expires_at);
  $("approval-expires").textContent = t("approval.expires", {
    time: expires.toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" }),
  });

  $("approval-loading").hidden = true;
  $("approval").hidden = false;
  settle(card);
}

/** A decided card keeps its details, loses its actions and says what happened. */
function settle(card) {
  setStatus(card.status);
  const message = outcomeMessage(card);
  if (!message) return;
  for (const id of ["approval-actions", "approval-consequences", "approval-expires-row", "approval-lede"]) {
    $(id).hidden = true;
  }
  const outcome = $("approval-outcome");
  outcome.dataset.tone = message.tone;
  $("approval-outcome-icon").setAttribute("href", message.tone === "ok" ? "#i-check" : "#i-x");
  $("approval-outcome-title").textContent = t(message.title);
  // Ids such as DSP-84E9A26A0C stay on one line: a non-breaking hyphen.
  const vars = Object.fromEntries(
    Object.entries(message.vars).map(([k, v]) => [k, String(v).replaceAll("-", "\u2011")]),
  );
  $("approval-outcome-text").textContent = t(message.text, vars);
  outcome.hidden = false;
  outcome.focus();
}

/** The whole screen for a link that cannot be used. */
function fail(kind) {
  const { title, text } = errorMessage(kind);
  $("approval-loading").hidden = true;
  $("approval").hidden = true;
  $("approval-error-title").textContent = t(title);
  $("approval-error-text").textContent = t(text);
  // Signing in is a step to take, not an alarm: a lock in ink instead of a red warning.
  const signIn = kind === "sign_in";
  // Optional: a cached page without these elements must still show the error.
  $("approval-error-icon")?.setAttribute("href", signIn ? "#i-lock" : "#i-alert");
  $("approval-error-svg")?.classList.toggle("outcome__icon--calm", signIn);
  const error = $("approval-error");
  error.hidden = false;
  error.focus();
}

/** A decision that could not be applied, shown inside the card. */
function refuse(kind) {
  const { title, text } = errorMessage(kind);
  const outcome = $("approval-outcome");
  outcome.dataset.tone = "error";
  $("approval-outcome-icon").setAttribute("href", "#i-alert");
  $("approval-outcome-title").textContent = t(title);
  $("approval-outcome-text").textContent = t(text);
  outcome.hidden = false;
  outcome.focus();
}

async function main() {
  translate(new URLSearchParams(location.search).get("lang"));
  const link = approvalParams(location.search);
  // The token is a credential: keep it in memory, out of the address bar and history.
  history.replaceState(null, "", location.pathname);
  if (!link || !endpoint) return fail("not_found");

  const loaded = await loadApproval(endpoint, link, { authToken: await session.token() });
  if (!loaded.ok) return fail(loaded.kind);
  let card = loaded.card;
  translate(card.language);
  render(card);

  const buttons = [$("approve"), $("reject")];
  for (const button of buttons) {
    button.addEventListener("click", async () => {
      $("approval-outcome").hidden = true;
      for (const b of buttons) {
        b.disabled = true;
        b.setAttribute("aria-busy", String(b === button));
      }
      const decided = await decideApproval(endpoint, link, card, button.id === "approve", {
        authToken: await session.token(),
      });
      for (const b of buttons) b.removeAttribute("aria-busy");
      if (!decided.ok) {
        // Only a network failure can be retried: the others are final.
        if (decided.kind === "network") for (const b of buttons) b.disabled = false;
        else $("approval-actions").hidden = true;
        return refuse(decided.kind);
      }
      card = decided.card;
      settle(card);
    });
  }
}

main();
