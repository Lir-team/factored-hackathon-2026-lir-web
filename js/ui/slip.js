/* The live case slip beside the form. */
import { categoryRule, selectedTransactions, resolveCards } from "../core/case-rules.js";
import { formatMoney, formatDateTime, sumByCurrency } from "../core/format.js";
import { t } from "../i18n/index.js";
import { $, h, setSlipValue } from "./dom.js";
import { cardList } from "./render.js";

/**
 * @param {object} state  formState from readFormState
 * @param {object} ctx    { customer, language, locale, receipt?: { folio, submitted_at } }
 */
export function renderSlip(state, ctx) {
  const { customer, language, locale, receipt } = ctx;
  const rule = categoryRule(state.category);
  const charges = selectedTransactions(state, customer);
  const cards = resolveCards(state, customer);
  const showCharges = charges.length > 0;

  setSlipValue($("#slip-reason"), rule ? t(`category.${state.category}.short`) : "");

  $("#slip-charges-row").hidden = !showCharges;
  $("#slip-total-row").hidden = !showCharges;
  $("#slip-charges").replaceChildren(
    ...charges.map((txn) =>
      h(
        "li",
        {},
        h("span", { class: "slip__merchant", text: txn.merchant ?? t("statement.no_merchant") }),
        h("span", { class: "slip__amount", text: formatMoney(txn.amount, txn.currency, locale) }),
      ),
    ),
  );
  setSlipValue(
    $("#slip-total"),
    sumByCurrency(charges)
      .map((total) => formatMoney(total.amount, total.currency, locale))
      .join(" + "),
  );

  const showCard = Boolean(rule && (rule.needs_card || rule.fraud_suspected || cards.length));
  $("#slip-card-row").hidden = !showCard;
  $("#slip-card-row dt").textContent = t(cards.length > 1 ? "slip.cards" : "slip.card");
  setSlipValue($("#slip-card"), cardList(cards));

  $("#slip-freeze-row").hidden = !rule?.fraud_suspected;
  setSlipValue($("#slip-freeze"), state.freeze_card_requested ? t("slip.yes") : t("slip.no"));

  const contact = state.contact_channel
    ? [t(`contact.channel.${state.contact_channel}`), state.contact_value.trim().replace(/ /g, " ")]
        .filter(Boolean)
        .join(", ")
    : "";
  setSlipValue($("#slip-contact"), contact);
  setSlipValue($("#slip-language"), t(`language.${language}`));

  setSlipValue($("#slip-folio"), receipt?.folio ?? "");
  setSlipValue(
    $("#slip-time"),
    receipt ? formatDateTime(receipt.submitted_at, locale, customer.time_zone) : "",
  );
}
