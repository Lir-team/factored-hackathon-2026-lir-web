/*
 * The Telegram hand-off decision for the success screen. No DOM access.
 *
 * Telegram bots cannot write first, so a Telegram customer is only promised a
 * message when the backend returned a Start link to open:
 *   { kind: "linked", url }  telegram, with a Start link
 *   { kind: "unlinked" }     telegram, without one
 *   { kind: "none" }         any other channel; a Start link is ignored
 */
export function telegramHandoff({ channel, telegramStartUrl = null }) {
  if (channel !== "telegram") return { kind: "none" };
  return telegramStartUrl ? { kind: "linked", url: telegramStartUrl } : { kind: "unlinked" };
}
