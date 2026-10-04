/*
 * Send a case to the configured endpoint, or simulate it in demo mode.
 * No DOM access: the caller passes the endpoint (from window.LIR_CONFIG).
 *
 * Outcomes:
 *   { ok: true, mode: "live" | "demo", case_id, folio, status }
 *   { ok: false, kind: "rejected", status, errors }  4xx, errors: { field: code }
 *   { ok: false, kind: "server", status }            5xx or unexpected status
 *   { ok: false, kind: "network" }                   offline, CORS, timeout
 */
import { folioFor } from "./case-payload.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function submitCase(
  payload,
  { endpoint = null, fetchImpl = globalThis.fetch, demoDelayMs = 900, timeoutMs = 15000 } = {},
) {
  const fallbackFolio = folioFor(payload.case_id, payload.submitted_at);

  if (!endpoint) {
    await wait(demoDelayMs);
    return { ok: true, mode: "demo", case_id: payload.case_id, folio: fallbackFolio, status: "received" };
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // Same case_id on every retry, so the backend can drop duplicates.
        "Idempotency-Key": payload.case_id,
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });
  } catch {
    return { ok: false, kind: "network" };
  } finally {
    clearTimeout(timer);
  }

  const body = await response.json().catch(() => null);

  if (response.ok) {
    return {
      ok: true,
      mode: "live",
      case_id: body?.case_id ?? payload.case_id,
      folio: body?.folio ?? fallbackFolio,
      status: body?.status ?? "received",
    };
  }
  if (response.status >= 400 && response.status < 500) {
    return { ok: false, kind: "rejected", status: response.status, errors: body?.errors ?? {} };
  }
  return { ok: false, kind: "server", status: response.status };
}
