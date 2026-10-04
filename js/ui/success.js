/* The confirmation state: stamped slip, folio, what happens next, technical view. */
import { pubsubAttributesFor } from "../core/case-payload.js";
import { t } from "../i18n/index.js";
import { $ } from "./dom.js";
import { cardList, cardName } from "./render.js";

export function renderSuccess({ payload, outcome, customer }) {
  const contact = payload.customer.preferred_contact;
  $("#success-folio").textContent = outcome.folio;
  // Telegram bots cannot write first: promise a Telegram message only when the
  // backend returned a Start link for the customer to open.
  const startUrl = outcome.telegram_start_url ?? null;
  const unlinked = contact.channel === "telegram" && !startUrl;
  $("#success-next-contact").textContent = unlinked
    ? t("success.next.contact.telegram_unlinked")
    : t(`success.next.contact.${contact.channel}`, { value: contact.value });
  renderTelegramHandoff(contact.channel === "telegram" ? startUrl : null);

  const cards = payload.cards
    .map((card) => customer.cards.find((c) => c.last4 === card.last4))
    .filter(Boolean);
  const freeze = $("#success-next-freeze");
  freeze.hidden = !(payload.freeze_card_requested && cards.length);
  freeze.textContent =
    cards.length > 1
      ? t("success.next.freeze_many", { cards: cardList(cards) })
      : cards.length === 1
        ? t("success.next.freeze", { card: cardName(cards[0]) })
        : "";

  $("#success-next-outcome").textContent = payload.fraud_suspected
    ? t("success.next.fraud")
    : t(unlinked ? "success.next.other_unlinked" : "success.next.other");
  $("#success-demo").hidden = outcome.mode !== "demo";

  $("#tech-payload").textContent = JSON.stringify(payload, null, 2);
  $("#tech-attributes").textContent = JSON.stringify(pubsubAttributesFor(payload), null, 2);
}

/**
 * The "Continue on Telegram" link. The URL carries a single-use token, so it
 * only ever lives in the href: never as visible text, in logs or in storage.
 */
function renderTelegramHandoff(url) {
  const handoff = $("#success-telegram");
  const link = $("#success-telegram-link");
  handoff.hidden = !url;
  if (url) link.href = url;
  else link.removeAttribute("href");
}

/** Stamp the slip once. CSS skips the motion under prefers-reduced-motion. */
export function stampSlip(on) {
  const slip = $("#slip");
  $("#slip-stamp").hidden = !on;
  slip.classList.toggle("is-stamped", on);
}
