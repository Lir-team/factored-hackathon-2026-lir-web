/*
 * Send a case to the configured endpoint, or simulate it in demo mode.
 * No DOM access: the caller passes the endpoint (from window.LIR_CONFIG).
 *
 * Outcomes:
 *   { ok: true, mode: "live" | "demo", case_id, folio, status, telegram_start_url }
 *     telegram_start_url: the bot's single-use Start link, or null (always null in demo)
 *   { ok: false, kind: "rejected", status, errors }  4xx, errors: { field: code }
 *   { ok: false, kind: "server", status }            5xx or unexpected status
 *   { ok: false, kind: "network" }                   offline, CORS, timeout
 */
import { folioFor } from "./case-payload.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The Telegram Start link from a 202 body, or null. Only https://t.me/ links
 * pass: a misconfigured or hostile response must not turn the success screen
 * into a link to anywhere else.
 */
export function telegramStartUrl(value) {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const exact = url.protocol === "https:" && url.hostname === "t.me";
  return exact && !url.username && !url.password && !url.port ? url.href : null;
}

export async function submitCase(
  payload,
  { endpoint = null, authToken = null, fetchImpl = globalThis.fetch, demoDelayMs = 900, timeoutMs = 15000 } = {},
) {
  const fallbackFolio = folioFor(payload.case_id, payload.submitted_at);

  if (!endpoint) {
    await wait(demoDelayMs);
    return { ok: true, mode: "demo", case_id: payload.case_id, folio: fallbackFolio, status: "received", telegram_start_url: null };
  }

  // The timeout covers the whole exchange, body included: a stalled body read
  // must end in the same retryable "network" outcome as a stalled connection.
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    // Same case_id on every retry after a network or server failure (see nextCaseId).
    "Idempotency-Key": payload.case_id,
  };
  // The customer JWT that API Gateway checks; no token, no header.
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const exchange = async () => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });
    const body = await response.json().catch(() => null);
    return { response, body };
  };

  let response;
  let body;
  try {
    ({ response, body } = await Promise.race([exchange(), timeout]));
  } catch {
    return { ok: false, kind: "network" };
  } finally {
    clearTimeout(timer);
  }

  if (response.ok) {
    return {
      ok: true,
      mode: "live",
      case_id: body?.case_id ?? payload.case_id,
      folio: body?.folio ?? fallbackFolio,
      status: body?.status ?? "received",
      telegram_start_url: telegramStartUrl(body?.telegram_start_url),
    };
  }
  if (response.status >= 400 && response.status < 500) {
    return { ok: false, kind: "rejected", status: response.status, errors: body?.errors ?? {} };
  }
  return { ok: false, kind: "server", status: response.status };
}

/**
 * Split a rejection's `errors` map into what the form can show next to a
 * field (`fields`) and whether the generic "rejected" line is needed too:
 * true when the body had no errors, or any key or code the form can't show.
 */
export function partitionServerErrors(errors, fieldOrder) {
  const fields = {};
  let generic = false;
  for (const [field, code] of Object.entries(errors ?? {})) {
    if (fieldOrder.includes(field) && typeof code === "string" && code) fields[field] = code;
    else generic = true;
  }
  return { fields, generic: generic || Object.keys(fields).length === 0 };
}

/**
 * The case_id (Idempotency-Key) for the next attempt. Network failures and
 * 5xx keep it, so a retry is recognized as the same case; a rejection
 * rotates it, so the corrected answers are not answered with the replay of
 * the rejection.
 */
export function nextCaseId(outcome, currentId, makeId) {
  return !outcome.ok && outcome.kind === "rejected" ? makeId() : currentId;
}
