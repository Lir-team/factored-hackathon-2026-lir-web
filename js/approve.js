/*
 * Approval page: the card behind a single-use link. Every value is written with
 * textContent (never HTML): the card comes from the API, not from this repo.
 */
import { approvalParams, decideApproval, loadApproval, statusMessage } from "./core/approval.js";
import { applyTranslations, getLocale, isLanguage, setLanguage, t } from "./i18n/index.js";

const $ = (id) => document.getElementById(id);
const endpoint = window.LIR_CONFIG?.approvalsEndpoint;

function show(message, tone) {
  const status = $("approval-status");
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = false;
  status.focus();
}

function translate(language) {
  if (isLanguage(language)) setLanguage(language);
  document.documentElement.lang = language === "pt" ? "pt-BR" : language || "es";
  document.title = t("approval.doc.title");
  applyTranslations(document);
}

function render(card) {
  $("approval-title").textContent = card.title;
  const details = $("approval-details");
  details.replaceChildren();
  for (const { label, value } of card.details) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    details.append(term, description);
  }
  const expires = new Date(card.expires_at);
  $("approval-expires").textContent = t("approval.expires", {
    time: expires.toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" }),
  });
  $("approval-loading").hidden = true;
  $("approval").hidden = false;
  settle(card);
}

/** A decided card keeps its content but loses its buttons. */
function settle(card) {
  const message = statusMessage(card);
  if (!message) return;
  $("approval-actions").hidden = true;
  show(t(message.key, message.vars), card.status === "approved" ? "ok" : "info");
}

function fail(kind) {
  $("approval-loading").hidden = true;
  show(t(`approval.error.${kind}`), "error");
}

async function main() {
  translate(new URLSearchParams(location.search).get("lang"));
  const link = approvalParams(location.search);
  // The token is a credential: keep it in memory, out of the address bar and history.
  history.replaceState(null, "", location.pathname);
  if (!link || !endpoint) return fail("not_found");

  const loaded = await loadApproval(endpoint, link);
  if (!loaded.ok) return fail(loaded.kind);
  let card = loaded.card;
  translate(card.language);
  render(card);

  const buttons = [$("approve"), $("reject")];
  for (const button of buttons) {
    button.addEventListener("click", async () => {
      for (const b of buttons) {
        b.disabled = true;
        b.setAttribute("aria-busy", String(b === button));
      }
      const decided = await decideApproval(endpoint, link, card, button.id === "approve");
      for (const b of buttons) b.removeAttribute("aria-busy");
      if (!decided.ok) {
        // Only a network failure can be retried: the others are final.
        if (decided.kind === "network") for (const b of buttons) b.disabled = false;
        return show(t(`approval.error.${decided.kind}`), "error");
      }
      card = decided.card;
      settle(card);
    });
  }
}

main();
