/* Renderers for the option lists: categories, cards, statement rows, answers, channels. */
import { CATEGORY_ORDER, CATEGORIES, CONTACT_CHANNELS, ANSWERS } from "../core/case-rules.js";
import { formatMoney, formatDay, formatTime, countryName } from "../core/format.js";
import { t } from "../i18n/index.js";
import { h } from "./dom.js";

export function cardName(card) {
  return t("card.name", { type: t(`card.type.${card.type}`), last4: card.last4 });
}

export function renderCategories(container, selected) {
  container.replaceChildren(
    ...CATEGORY_ORDER.map((id) =>
      h(
        "label",
        { class: CATEGORIES[id].fraud_suspected ? "choice choice--fraud" : "choice" },
        h("input", { type: "radio", name: "category", value: id, checked: id === selected }),
        h(
          "span",
          { class: "choice__text" },
          h("span", { class: "choice__label", text: t(`category.${id}.label`) }),
          h("span", { class: "choice__hint", text: t(`category.${id}.hint`) }),
        ),
      ),
    ),
  );
}

export function renderCards(container, cards, selected) {
  container.replaceChildren(
    ...cards.map((card) =>
      h(
        "label",
        { class: "choice" },
        h("input", { type: "radio", name: "card_last4", value: card.last4, checked: card.last4 === selected }),
        h("span", { class: "choice__text" }, h("span", { class: "choice__label", text: cardName(card) })),
      ),
    ),
  );
}

export function renderAnswers(container, name, selected) {
  container.replaceChildren(
    ...ANSWERS.map((answer) =>
      h(
        "label",
        { class: "pill" },
        h("input", { type: "radio", name, value: answer, checked: answer === selected }),
        h("span", { text: t(`answer.${answer}`) }),
      ),
    ),
  );
}

export function renderChannels(container, selected) {
  container.replaceChildren(
    ...CONTACT_CHANNELS.map((channel) =>
      h(
        "label",
        { class: "pill" },
        h("input", { type: "radio", name: "contact_channel", value: channel, checked: channel === selected }),
        h("span", { text: t(`contact.channel.${channel}`) }),
      ),
    ),
  );
}

/**
 * Statement rows. `mode` is "multiple" (checkboxes) or "single" (radios).
 * Foreign transactions show their country; it is often the tell of a fraud.
 */
export function renderStatement(list, transactions, { mode, selectedIds, customer, locale }) {
  if (transactions.length === 0) {
    list.replaceChildren(h("li", { class: "statement__empty", text: t("statement.empty") }));
    return;
  }
  const tz = customer.time_zone;
  list.replaceChildren(
    ...transactions.map((txn) => {
      const card = customer.cards.find((c) => c.last4 === txn.card_last4);
      const meta = [t(`channel.${txn.channel}`)];
      if (txn.country !== customer.country) meta.push(countryName(txn.country, locale));
      if (card) meta.push(cardName(card));
      return h(
        "li",
        {},
        h(
          "label",
          { class: "txn" },
          h("input", {
            class: "txn__input",
            type: mode === "multiple" ? "checkbox" : "radio",
            name: "transaction_ids",
            value: txn.transaction_id,
            checked: selectedIds.includes(txn.transaction_id),
          }),
          h(
            "span",
            { class: "txn__date" },
            h("span", { class: "txn__day", text: formatDay(txn.occurred_at, locale, tz) }),
            h("span", { class: "txn__time", text: formatTime(txn.occurred_at, locale, tz) }),
          ),
          h(
            "span",
            { class: "txn__body" },
            h("span", { class: "txn__merchant", text: txn.merchant }),
            h("span", { class: "txn__meta", text: meta.join(", ") }),
          ),
          h("span", { class: "txn__amount", text: formatMoney(txn.amount, txn.currency, locale) }),
        ),
      );
    }),
  );
}
