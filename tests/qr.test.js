import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import { QR_MARGIN, qrSvgPath } from "../js/core/qr.js";

// The vendored library is a classic script that defines a global `qrcode`.
const source = readFileSync(new URL("../js/vendor/qrcode.js", import.meta.url), "utf8");
const sandbox = {};
vm.runInNewContext(`${source}\nthis.qrcode = qrcode;`, sandbox);
const { qrcode } = sandbox;

const START_URL = "https://t.me/lir_bank_bot?start=c2luZ2xlLXVzZS10b2tlbg";

test("qrSvgPath draws the code with a quiet zone", () => {
  const qr = qrSvgPath(START_URL, qrcode);
  const reference = qrcode(0, "M");
  reference.addData(START_URL);
  reference.make();
  const count = reference.getModuleCount();
  assert.equal(qr.size, count + QR_MARGIN * 2);
  // The top-left finder pattern starts dark, shifted by the quiet zone.
  assert.ok(qr.path.startsWith(`M${QR_MARGIN} ${QR_MARGIN}h1v1h-1z`));
  const dark = qr.path.match(/M/g).length;
  let expected = 0;
  for (let r = 0; r < count; r += 1) for (let c = 0; c < count; c += 1) if (reference.isDark(r, c)) expected += 1;
  assert.equal(dark, expected);
});

test("qrSvgPath returns null without a library or text", () => {
  assert.equal(qrSvgPath(START_URL, undefined), null);
  assert.equal(qrSvgPath("", qrcode), null);
  assert.equal(qrSvgPath(null, qrcode), null);
});

test("qrSvgPath returns null when the text does not fit", () => {
  assert.equal(qrSvgPath("x".repeat(5000), qrcode), null);
});
