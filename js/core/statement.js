/*
 * The signed-in customer's statement from the bank API (GET /v1/me/transactions).
 *
 * The customer comes from the sign-in JWT, never from the page. Without an endpoint or a
 * token the page stays in demo mode with the bundled mock customer. The dataset has no cards
 * or contact details, so those stay simulated: every statement line is shown on the
 * customer's first mock card.
 */
import { withApiKey } from "./submit.js";

export class StatementError extends Error {
  constructor(status) {
    super(`statement request failed: ${status}`);
    this.status = status;
  }
}

/** The customer the page shows: from the API when configured, else the demo customer. */
export async function loadCustomer(
  demo,
  { endpoint = null, authToken = null, apiKey = null, limit = 20, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {},
) {
  if (!endpoint || !authToken) return { customer: demo, source: "demo" };
  const url = withApiKey(`${endpoint}?limit=${limit}`, apiKey);
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${authToken}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new StatementError(response.status);
  return { customer: toCustomer(await response.json(), demo), source: "api" };
}

/** The API answer in the shape the page uses; simulated fields come from `demo`. */
export function toCustomer(body, demo) {
  const card = demo.cards[0]?.last4 ?? null;
  const transactions = body.transactions.map((t) =>
    Object.freeze({
      transaction_id: t.transaction_id,
      occurred_at: t.occurred_at,
      merchant: t.merchant,
      amount: t.amount,
      currency: t.currency,
      country: t.country,
      channel: t.channel,
      status: t.status ?? null,
      card_last4: card,
    }),
  );
  return Object.freeze({
    ...demo,
    customer_id: body.customer_id,
    name: body.first_name ?? demo.name,
    country: body.country ?? demo.country,
    currency: transactions[0]?.currency ?? demo.currency,
    transactions: Object.freeze(transactions),
  });
}
