import { test } from "node:test";
import assert from "node:assert/strict";

import { telegramHandoff } from "../js/core/handoff.js";

const URL = "https://t.me/lir_bank_bot?start=abc";

test("telegram with a Start link is linked to that URL", () => {
  assert.deepEqual(telegramHandoff({ channel: "telegram", telegramStartUrl: URL }), { kind: "linked", url: URL });
});

test("telegram without a Start link is unlinked", () => {
  for (const telegramStartUrl of [null, undefined]) {
    assert.deepEqual(telegramHandoff({ channel: "telegram", telegramStartUrl }), { kind: "unlinked" });
  }
});

test("other channels get no hand-off, even with a Start link", () => {
  for (const channel of ["whatsapp", "email", "phone"]) {
    assert.deepEqual(telegramHandoff({ channel, telegramStartUrl: URL }), { kind: "none" }, channel);
  }
});

test("other channels without a Start link get no hand-off", () => {
  assert.deepEqual(telegramHandoff({ channel: "whatsapp", telegramStartUrl: null }), { kind: "none" });
});
