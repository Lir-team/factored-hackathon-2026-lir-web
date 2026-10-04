/*
 * QR matrix to SVG path data. No DOM access: the caller passes the QR
 * factory (the vendored kazuhikoarase/qrcode-generator, global `qrcode` in
 * the browser), so a missing library simply means "no QR".
 */

/** Quiet zone around the code, in modules (the QR spec asks for 4). */
export const QR_MARGIN = 4;

/**
 * { size, path } for `text`, where `size` is the viewBox side in modules
 * (quiet zone included) and `path` draws one 1x1 square per dark module.
 * Returns null when there is no factory or the text does not fit.
 */
export function qrSvgPath(text, qrcode) {
  if (typeof qrcode !== "function" || typeof text !== "string" || !text) return null;
  let qr;
  try {
    qr = qrcode(0, "M"); // 0: smallest version that fits; M: ~15% error correction
    qr.addData(text);
    qr.make();
  } catch {
    return null;
  }
  const count = qr.getModuleCount();
  const parts = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) parts.push(`M${col + QR_MARGIN} ${row + QR_MARGIN}h1v1h-1z`);
    }
  }
  return { size: count + QR_MARGIN * 2, path: parts.join("") };
}
