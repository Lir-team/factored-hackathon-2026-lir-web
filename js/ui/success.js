/* The confirmation state: stamped slip, folio, what happens next, technical view. */
import { pubsubAttributesFor } from "../core/case-payload.js";
import { telegramHandoff } from "../core/handoff.js";
import { qrSvgPath } from "../core/qr.js";
import { t } from "../i18n/index.js";
import { $ } from "./dom.js";
import { cardList, cardName } from "./render.js";

export function renderSuccess({ payload, outcome, customer }) {
  const contact = payload.customer.preferred_contact;
  $("#success-folio").textContent = outcome.folio;
  const handoff = telegramHandoff({ channel: contact.channel, telegramStartUrl: outcome.telegram_start_url });
  const unlinked = handoff.kind === "unlinked";
  $("#success-next-contact").textContent = unlinked
    ? t("success.next.contact.telegram_unlinked")
    : t(`success.next.contact.${contact.channel}`, { value: contact.value });
  renderTelegramHandoff(handoff.kind === "linked" ? handoff.url : null);

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

  // The same link as a QR for scanning from a phone (CSS shows it on wide
  // screens only). No vendored library or no fit: the button stands alone.
  const qr = url ? qrSvgPath(url, globalThis.qrcode) : null;
  $("#success-telegram-qr").hidden = !qr;
  const code = $("#success-telegram-code");
  code.setAttribute("aria-label", t("success.telegram.qr_alt"));
  if (qr) {
    code.setAttribute("viewBox", `0 0 ${qr.size} ${qr.size}`);
    $("#success-telegram-path").setAttribute("d", qr.path);
  } else {
    $("#success-telegram-path").removeAttribute("d");
  }
}

/** Stamp the slip once. CSS skips the motion under prefers-reduced-motion. */
export function stampSlip(on) {
  const slip = $("#slip");
  $("#slip-stamp").hidden = !on;
  slip.classList.toggle("is-stamped", on);
}
