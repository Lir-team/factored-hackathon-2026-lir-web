/*
 * Approval card logic (human in the loop): read the link, load the request, send the
 * decision. No DOM access: the caller passes the endpoint (window.LIR_CONFIG) and fetch.
 *
 * The bank shows an important action (e.g. opening a dispute) and only the customer's
 * approval runs it. The link carries a single-use token: it identifies the customer for
 * this one request and stops working after the decision.
 *
 * Outcomes:
 *   { ok: true, card }                      card: the request as the API returns it
 *   { ok: false, kind }                     kind: "not_found" | "expired" | "decided" |
 *                                                  "changed" | "sign_in" | "not_yours" |
 *                                                  "server" | "network"
 */

const ERRORS_BY_DETAIL = Object.freeze({
  sign_in_required: "sign_in",
  not_your_request: "not_yours",
  not_found: "not_found",
  expired: "expired",
  not_pending: "decided",
  content_changed: "changed",
});

/** The request id and token from the page URL (`?id=APR-...&t=...`), or null. */
export function approvalParams(search) {
  const params = new URLSearchParams(search);
  const id = params.get("id");
  const token = params.get("t");
  if (!id || !token || !/^APR-[A-Z0-9]+$/.test(id)) return null;
  return { id, token };
}

async function request(url, init, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function outcome(response) {
  if (response.ok) return { ok: true, card: await response.json() };
  let detail = null;
  try {
    detail = (await response.json())?.detail ?? null;
  } catch {
    // An error without a JSON body: classified by status below.
  }
  const kind =
    ERRORS_BY_DETAIL[detail] ??
    (response.status === 404 ? "not_found" : response.status === 410 ? "expired" : "server");
  return { ok: false, kind, status: response.status };
}

/** Headers for a call; with the bank's sign-in (step-up) the customer's JWT goes too. */
function headers(extra, authToken) {
  return authToken ? { ...extra, Authorization: `Bearer ${authToken}` } : extra;
}

/** Load the card behind the link. */
export async function loadApproval(
  endpoint,
  { id, token },
  { fetchImpl = globalThis.fetch, timeoutMs = 15000, authToken = null } = {},
) {
  // The token is a credential: in a header, so no proxy or gateway logs it with the URL.
  const init = { method: "GET", headers: headers({ "X-Approval-Token": token }, authToken) };
  try {
    return await outcome(
      await request(`${endpoint}/${encodeURIComponent(id)}`, init, fetchImpl, timeoutMs),
    );
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * Send the customer's decision on the card they saw. `content_hash` binds the decision to
 * that exact content: if the request changed, the API refuses it ("changed").
 */
export async function decideApproval(
  endpoint,
  { id, token },
  card,
  approve,
  { fetchImpl = globalThis.fetch, timeoutMs = 15000, authToken = null } = {},
) {
  const body = {
    decision: approve ? "approve" : "reject",
    token,
    content_hash: card.content_hash,
  };
  try {
    const response = await request(
      `${endpoint}/${encodeURIComponent(id)}/decision`,
      {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }, authToken),
        body: JSON.stringify(body),
      },
      fetchImpl,
      timeoutMs,
    );
    return await outcome(response);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * How a decided card reads: a tone and the i18n keys of its title and text.
 * Null while it is pending (the buttons speak for themselves).
 */
export function outcomeMessage(card) {
  if (card.status === "approved") {
    const dispute = card.result?.dispute_case_id;
    return dispute
      ? { tone: "ok", title: "approval.outcome.approved.title", text: "approval.outcome.dispute.text", vars: { id: dispute } }
      : { tone: "ok", title: "approval.outcome.approved.title", text: "approval.outcome.approved.text", vars: {} };
  }
  if (card.status === "rejected") {
    return { tone: "neutral", title: "approval.outcome.rejected.title", text: "approval.outcome.rejected.text", vars: {} };
  }
  if (card.status === "expired") {
    return { tone: "neutral", title: "approval.error.expired.title", text: "approval.error.expired.text", vars: {} };
  }
  return null;
}

/** The i18n keys of the screen for a link that cannot be used. */
export function errorMessage(kind) {
  const known = ["not_found", "expired", "decided", "changed", "sign_in", "not_yours", "server", "network"];
  const key = known.includes(kind) ? kind : "server";
  return { title: `approval.error.${key}.title`, text: `approval.error.${key}.text` };
}
