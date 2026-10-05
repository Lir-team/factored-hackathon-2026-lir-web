import { test } from "node:test";
import assert from "node:assert/strict";

import { DICTIONARIES, LANGUAGES, getLanguage, getLocale, setLanguage, t } from "../js/i18n/index.js";
import { CATEGORY_ORDER, CONTACT_CHANNELS } from "../js/core/case-rules.js";

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("ES, PT and EN have identical key sets", () => {
  const spanish = Object.keys(DICTIONARIES.es).sort();
  for (const language of LANGUAGES) {
    assert.deepEqual(Object.keys(DICTIONARIES[language]).sort(), spanish, `${language} keys differ`);
  }
});

test("every string is non-empty and keeps the same placeholders", () => {
  for (const [key, spanish] of Object.entries(DICTIONARIES.es)) {
    for (const language of LANGUAGES) {
      const text = DICTIONARIES[language][key];
      assert.equal(typeof text, "string", `${language}.${key}`);
      assert.ok(text.trim().length > 0, `${language}.${key} is empty`);
      assert.deepEqual(placeholders(text), placeholders(spanish), `${language}.${key} placeholders`);
    }
  }
});

test("every category and channel has its copy", () => {
  for (const id of CATEGORY_ORDER) {
    for (const part of ["label", "hint", "short"]) assert.ok(`category.${id}.${part}` in DICTIONARIES.es);
  }
  for (const channel of CONTACT_CHANNELS) {
    assert.ok(`contact.channel.${channel}` in DICTIONARIES.es);
    assert.ok(`contact.value.${channel}` in DICTIONARIES.es);
    assert.ok(`success.next.contact.${channel}` in DICTIONARIES.es);
  }
});

test("every statement channel and transaction error code has its copy", () => {
  for (const channel of ["pos", "online", "atm", "app", "transfer", "web"]) {
    assert.ok(`channel.${channel}` in DICTIONARIES.es, `channel.${channel}`);
  }
  for (const code of ["required", "too_many", "unknown", "invalid"]) {
    assert.ok(`error.transaction_ids.${code}` in DICTIONARIES.es, `error.transaction_ids.${code}`);
  }
});

test("setLanguage switches lookups and Intl locale, ignoring unknown codes", () => {
  assert.equal(getLanguage(), "es");
  setLanguage("pt");
  assert.equal(t("submit.button"), "Enviar relato");
  assert.equal(getLocale(), "pt-BR");
  setLanguage("fr");
  assert.equal(getLanguage(), "pt");
  setLanguage("en");
  assert.equal(t("description.count", { n: 42 }), "42 of 1000");
  setLanguage("es");
});
